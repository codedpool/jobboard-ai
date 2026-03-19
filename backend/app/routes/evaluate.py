from fastapi import APIRouter, Depends, HTTPException
from fastapi_clerk_auth import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.auth.deps import get_clerk_auth
from app.db.session import get_db
from app.models.job_config import JobConfig
from app.models.job_result import JobResult
from app.services.job_evaluator import evaluate_job

router = APIRouter(prefix="/api/configs", tags=["evaluation"])


@router.post("/{config_id}/evaluate")
async def evaluate_jobs_for_config(
    config_id: str,
    limit: int = 20,
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

    # Select unevaluated jobs for this config
    jobs_stmt = (
        select(JobResult)
        .where(JobResult.config_id == config.id, JobResult.score.is_(None))
        .order_by(JobResult.created_at.desc().nullslast())
        .limit(limit)
    )
    jobs_result = await db.execute(jobs_stmt)
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
        except Exception:
            # For now, skip on errors and continue
            errors += 1

    await db.commit()

    return {
        "config_id": str(config.id),
        "attempted": len(jobs),
        "evaluated": evaluated,
        "errors": errors,
        "job_ids": updated_job_ids,
    }
