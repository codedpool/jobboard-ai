import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi_clerk_auth import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.auth.deps import get_clerk_auth
from app.db.session import get_db
from app.models.job_config import JobConfig
from app.models.job_result import JobResult
from app.services.job_evaluator import evaluate_job

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/configs", tags=["evaluation"])


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
    config_stmt = select(JobConfig).where(JobConfig.id == config_id, JobConfig.user_id == user_id)
    config_result = await db.execute(config_stmt)
    config = config_result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")

    # Determine which platforms to evaluate for
    selected_platforms = []
    if platforms:
        # Parse comma-separated platforms from query parameter
        selected_platforms = [p.strip().lower() for p in platforms.split(",")]
    elif config.platforms:
        # Use platforms from config if available
        selected_platforms = [p.lower() for p in config.platforms]

    # Select unevaluated jobs for this config
    jobs_query = (
        select(JobResult)
        .where(JobResult.config_id == config.id, JobResult.score.is_(None))
        .order_by(JobResult.created_at.desc().nullslast())
    )

    # Filter by platforms if specified
    if selected_platforms:
        jobs_query = jobs_query.where(JobResult.source.in_(selected_platforms))

    jobs_query = jobs_query.limit(limit)
    jobs_result = await db.execute(jobs_query)
    jobs = list(jobs_result.scalars().all())

    evaluated = 0
    errors = 0
    updated_job_ids = []

    for job in jobs:
        try:
            result = evaluate_job(config, job)
            job.score = result["score"]
            job.reason = result["reason"]
            evaluated += 1
            updated_job_ids.append(str(job.id))
        except Exception as e:
            logger.error(f"Failed to evaluate job {job.id}: {str(e)}", exc_info=True)
            errors += 1

    await db.commit()

    return {
        "config_id": str(config.id),
        "attempted": len(jobs),
        "evaluated": evaluated,
        "errors": errors,
        "job_ids": updated_job_ids,
    }
