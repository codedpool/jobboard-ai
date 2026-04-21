import math
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi_clerk_auth import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.auth.deps import get_clerk_auth
from app.db.session import get_db
from app.models.job_config import JobConfig
from app.models.job_result import JobResult

router = APIRouter(prefix="/api/configs", tags=["results"])


# ─── Ranking helpers ────────────────────────────────────────────────────────

DEFAULT_MIN_SCORE = 45       # confidence threshold: drop results below this
FRESHNESS_GRACE_DAYS = 7     # no penalty within the first week
FRESHNESS_HALF_LIFE = 30     # after the grace, exp decay with this half-ish-life
FRESHNESS_FLOOR = 0.5        # a job is never worth less than 50% of its raw score


def _age_days(created_at) -> float:
    if not created_at:
        return 0.0
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    delta = datetime.now(timezone.utc) - created_at
    return max(0.0, delta.total_seconds() / 86400.0)


def _freshness(age_days: float) -> float:
    """Multiplicative bump in [FRESHNESS_FLOOR, 1.0] based on age."""
    if age_days <= FRESHNESS_GRACE_DAYS:
        return 1.0
    decayed = math.exp(-(age_days - FRESHNESS_GRACE_DAYS) / FRESHNESS_HALF_LIFE)
    return max(FRESHNESS_FLOOR, decayed)


def _effective_score(job: JobResult) -> float:
    base = job.score if job.score is not None else 0
    # Prefer date_posted (external truth) over our ingestion time when we have it.
    when = job.date_posted or job.created_at
    return base * _freshness(_age_days(when))


# ─── Response shaping ───────────────────────────────────────────────────────

def _to_dict(j: JobResult) -> dict:
    return {
        "id": str(j.id),
        "title": j.title,
        "company": j.company,
        "url": j.url,
        "source": j.source,
        "location": j.location,
        "description": j.description,
        "score": j.score,
        "effective_score": round(_effective_score(j), 2),
        "reason": j.reason,
        "matches": {
            "skills_match": j.skills_match,
            "seniority_match": j.seniority_match,
            "location_match": j.location_match,
        },
        "salary_min": j.salary_min,
        "salary_max": j.salary_max,
        "salary_currency": j.salary_currency,
        "date_posted": j.date_posted.isoformat() if j.date_posted else None,
        "is_remote": j.is_remote,
        "job_type": j.job_type,
        "created_at": j.created_at.isoformat() if j.created_at else None,
    }


# ─── Route ──────────────────────────────────────────────────────────────────

@router.get("/{config_id}/results")
async def get_results_for_config(
    config_id: str,
    limit: int = 50,
    min_score: int = Query(DEFAULT_MIN_SCORE, ge=0, le=100),
    platforms: Optional[str] = Query(None),
    credentials: HTTPAuthorizationCredentials = Depends(get_clerk_auth),
    db: AsyncSession = Depends(get_db),
):
    user_id = credentials.decoded.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: no sub claim")

    # Ensure config belongs to this user
    stmt_config = select(JobConfig).where(
        JobConfig.id == config_id,
        JobConfig.user_id == user_id,
    )
    res_config = await db.execute(stmt_config)
    config = res_config.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")

    selected_platforms: list[str] = []
    if platforms:
        selected_platforms = [p.strip().lower() for p in platforms.split(",")]
    elif config.platforms:
        selected_platforms = [p.lower() for p in config.platforms]

    stmt_jobs = select(JobResult).where(JobResult.config_id == config.id)
    if selected_platforms:
        stmt_jobs = stmt_jobs.where(JobResult.source.in_(selected_platforms))

    # Apply the confidence floor on the DB side so we don't pull garbage into
    # memory. Jobs that haven't been scored yet (score IS NULL) are also excluded.
    stmt_jobs = stmt_jobs.where(
        JobResult.score.is_not(None),
        JobResult.score >= min_score,
    ).limit(500)  # hard cap before in-memory re-ranking

    res_jobs = await db.execute(stmt_jobs)
    jobs = list(res_jobs.scalars().all())

    # Re-rank by effective score (raw LLM score × freshness).
    jobs.sort(
        key=lambda j: (_effective_score(j), j.created_at or datetime.min.replace(tzinfo=timezone.utc)),
        reverse=True,
    )
    jobs = jobs[:limit]

    return {
        "config_id": str(config.id),
        "count": len(jobs),
        "min_score": min_score,
        "jobs": [_to_dict(j) for j in jobs],
    }
