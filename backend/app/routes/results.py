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


@router.get("/{config_id}/results")
async def get_results_for_config(
    config_id: str,
    limit: int = 50,
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

    # Determine which platforms to filter by
    selected_platforms = []
    if platforms:
        # Parse comma-separated platforms from query parameter
        selected_platforms = [p.strip().lower() for p in platforms.split(",")]
    elif config.platforms:
        # Use platforms from config if available
        selected_platforms = [p.lower() for p in config.platforms]

    # Fetch jobs ordered by score desc, then created_at desc
    stmt_jobs = select(JobResult).where(JobResult.config_id == config.id)

    # Filter by platforms if specified
    if selected_platforms:
        stmt_jobs = stmt_jobs.where(JobResult.source.in_(selected_platforms))

    stmt_jobs = (
        stmt_jobs
        .order_by(JobResult.score.desc().nullslast(),
                  JobResult.created_at.desc().nullslast())
        .limit(limit)
    )
    res_jobs = await db.execute(stmt_jobs)
    jobs = list(res_jobs.scalars().all())

    def to_dict(j: JobResult):
        return {
            "id": str(j.id),
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

    return {
        "config_id": str(config.id),
        "count": len(jobs),
        "jobs": [to_dict(j) for j in jobs],
    }
