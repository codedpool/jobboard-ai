from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi_clerk_auth import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_clerk_auth
from app.db.session import get_db
from app.models.job_config import JobConfig
from app.models.job_result import JobResult
from app.services.github_fetcher import fetch_github_jobs
from app.services.hn_fetcher import fetch_hn_jobs
from app.services.remoteok_fetcher import fetch_remoteok_jobs
from app.services.remotive_fetcher import fetch_remotive_jobs
from app.services.yc_fetcher import fetch_yc_jobs

router = APIRouter(prefix="/api", tags=["fetch"])


def _job_result_to_dict(j: JobResult) -> Dict[str, Any]:
    return {
        "id": str(j.id),
        "config_id": str(j.config_id),
        "title": j.title,
        "company": j.company,
        "url": j.url,
        "source": j.source,
        "location": j.location,
        "description": j.description,
        "score": j.score,
        "reason": j.reason,
        "created_at": j.created_at.isoformat() if j.created_at else None,
    }


@router.post("/configs/{config_id}/fetch")
async def fetch_jobs_for_config(
    config_id: str,
    platforms: Optional[str] = Query(None),
    credentials: HTTPAuthorizationCredentials = Depends(get_clerk_auth),
    db: AsyncSession = Depends(get_db),
):
    user_id = credentials.decoded.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: no sub claim")

    # Load config and ensure it belongs to this user
    result = await db.execute(select(JobConfig).where(JobConfig.id == config_id))
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(status_code=404, detail="Config not found")

    if config.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not your config")

    # Determine which platforms to fetch from
    selected_platforms = []
    if platforms:
        # Parse comma-separated platforms from query parameter
        selected_platforms = [p.strip().lower() for p in platforms.split(",")]
    elif config.platforms:
        # Use platforms from config if available
        selected_platforms = [p.lower() for p in config.platforms]
    else:
        # Default to all platforms
        selected_platforms = ["remoteok", "remotive", "github", "hn", "yc"]

    all_results: List[JobResult] = []
    counts = {}
    skipped = {}

    # Initialize all counts/skipped to 0
    for p in ["remoteok", "remotive", "hn", "github", "yc"]:
        counts[p] = 0
        skipped[p] = 0

    # ── RemoteOK ────────────────────────────────────────────────────────────────
    if "remoteok" in selected_platforms:
        remoteok_results, remoteok_skipped = await fetch_remoteok_jobs(config, db)
        all_results.extend(remoteok_results)
        counts["remoteok"] = len(remoteok_results)
        skipped["remoteok"] = remoteok_skipped
    else:
        remoteok_skipped = 0

    # ── Remotive ────────────────────────────────────────────────────────────────
    if "remotive" in selected_platforms:
        remotive_results, remotive_skipped = await fetch_remotive_jobs(config, db)
        all_results.extend(remotive_results)
        counts["remotive"] = len(remotive_results)
        skipped["remotive"] = remotive_skipped
    else:
        remotive_skipped = 0

    # ── HN "Who's Hiring" ───────────────────────────────────────────────────────
    if "hn" in selected_platforms or "hackernews" in selected_platforms:
        hn_results, hn_skipped = await fetch_hn_jobs(config, db)
        all_results.extend(hn_results)
        counts["hn"] = len(hn_results)
        skipped["hn"] = hn_skipped
    else:
        hn_skipped = 0

    # ── GitHub hiring issues ─────────────────────────────────────────────────────
    if "github" in selected_platforms:
        github_results, github_skipped = await fetch_github_jobs(config, db)
        all_results.extend(github_results)
        counts["github"] = len(github_results)
        skipped["github"] = github_skipped
    else:
        github_skipped = 0

    # ── YC job board (stub – best-effort, non-blocking) ──────────────────────────
    yc_skipped = 0
    if "yc" in selected_platforms or "ycombinator" in selected_platforms:
        try:
            yc_results, yc_skipped = await fetch_yc_jobs(config, db)
            all_results.extend(yc_results)
            counts["yc"] = len(yc_results)
            skipped["yc"] = yc_skipped
        except Exception:
            pass

    await db.commit()

    total_skipped = sum(skipped.values())

    return {
        "config_id": str(config.id),
        "counts": counts,
        "skipped": skipped,
        "total_inserted": len(all_results),
        "total_skipped": total_skipped,
        "jobs": [_job_result_to_dict(j) for j in all_results],
    }
