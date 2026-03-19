from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from fastapi_clerk_auth import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_clerk_auth
from app.db.session import get_db
from app.models.job_config import JobConfig
from app.models.job_result import JobResult
from app.services.remoteok_fetcher import fetch_remoteok_jobs
from app.services.remotive_fetcher import fetch_remotive_jobs

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
    credentials: HTTPAuthorizationCredentials = Depends(get_clerk_auth),
    db: AsyncSession = Depends(get_db),
):
    user_id = credentials.decoded.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: no sub claim")

    # Load config and ensure it belongs to this user
    result = await db.execute(
        select(JobConfig).where(JobConfig.id == config_id)
    )
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(status_code=404, detail="Config not found")

    if config.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not your config")

    all_results: List[JobResult] = []

    # Phase 6.1: RemoteOK
    remoteok_results = await fetch_remoteok_jobs(config, db)
    all_results.extend(remoteok_results)

    # Phase 6.2: Remotive
    remotive_results = await fetch_remotive_jobs(config, db)
    all_results.extend(remotive_results)

    # Commit everything
    await db.commit()

    return {
        "config_id": str(config.id),
        "counts": {
            "remoteok": len(remoteok_results),
            "remotive": len(remotive_results),
            # further sources in later subphases
        },
        "total_inserted": len(all_results),
        "jobs": [_job_result_to_dict(j) for j in all_results],
    }
