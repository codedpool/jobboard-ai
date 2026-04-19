import asyncio
import logging
import os
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi_clerk_auth import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.auth.deps import get_clerk_auth
from app.db.session import get_db
from app.models.job_config import JobConfig
from app.models.job_result import JobResult
from app.services.job_evaluator import evaluate_job_async

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/configs", tags=["evaluation"])

# Tune-able: how many concurrent Groq calls per request.
# On the free tier (30k TPM), 5 concurrent calls stays under the token budget
# even when all jobs have long descriptions. Bump via GROQ_EVAL_CONCURRENCY.
EVAL_CONCURRENCY = int(os.getenv("GROQ_EVAL_CONCURRENCY", "5"))


async def _score_one(
    sem: asyncio.Semaphore,
    config: JobConfig,
    job: JobResult,
) -> tuple[JobResult, Optional[dict], Optional[str]]:
    """Return (job, result, error). Errors are captured, not raised,
    so one failure doesn't abort the whole batch."""
    async with sem:
        try:
            result = await evaluate_job_async(config, job)
            return job, result, None
        except Exception as exc:
            return job, None, str(exc)


@router.post("/{config_id}/evaluate")
async def evaluate_jobs_for_config(
    config_id: str,
    limit: int = 20,
    platforms: Optional[str] = Query(None),
    credentials: HTTPAuthorizationCredentials = Depends(get_clerk_auth),
    db: AsyncSession = Depends(get_db),
):
    user_id = credentials.decoded.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: no sub claim")

    # Ensure config belongs to this user
    config_stmt = select(JobConfig).where(
        JobConfig.id == config_id, JobConfig.user_id == user_id
    )
    config_result = await db.execute(config_stmt)
    config = config_result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")

    # Determine which platforms to evaluate for
    selected_platforms: list[str] = []
    if platforms:
        selected_platforms = [p.strip().lower() for p in platforms.split(",")]
    elif config.platforms:
        selected_platforms = [p.lower() for p in config.platforms]

    # Select unevaluated jobs for this config
    jobs_query = (
        select(JobResult)
        .where(JobResult.config_id == config.id, JobResult.score.is_(None))
        .order_by(JobResult.created_at.desc().nullslast())
    )
    if selected_platforms:
        jobs_query = jobs_query.where(JobResult.source.in_(selected_platforms))
    jobs_query = jobs_query.limit(limit)

    jobs_result = await db.execute(jobs_query)
    jobs = list(jobs_result.scalars().all())

    if not jobs:
        return {
            "config_id": str(config.id),
            "attempted": 0,
            "evaluated": 0,
            "errors": 0,
            "job_ids": [],
            "elapsed_ms": 0,
        }

    start = time.perf_counter()
    sem = asyncio.Semaphore(max(1, EVAL_CONCURRENCY))
    logger.info(
        f"Evaluating {len(jobs)} jobs for config {config.id} "
        f"with concurrency={EVAL_CONCURRENCY}"
    )

    outcomes = await asyncio.gather(
        *(_score_one(sem, config, job) for job in jobs),
        return_exceptions=False,
    )

    evaluated = 0
    errors = 0
    updated_job_ids: list[str] = []

    for job, result, error in outcomes:
        if error or result is None:
            logger.error(f"Failed to evaluate job {job.id}: {error}")
            errors += 1
            continue
        job.score = result["score"]
        job.reason = result["reason"]
        evaluated += 1
        updated_job_ids.append(str(job.id))

    await db.commit()

    elapsed_ms = int((time.perf_counter() - start) * 1000)
    logger.info(
        f"✓ evaluated {evaluated}/{len(jobs)} jobs "
        f"({errors} errors) in {elapsed_ms}ms"
    )

    return {
        "config_id": str(config.id),
        "attempted": len(jobs),
        "evaluated": evaluated,
        "errors": errors,
        "job_ids": updated_job_ids,
        "elapsed_ms": elapsed_ms,
    }
