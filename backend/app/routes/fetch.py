import asyncio
import logging
from typing import Any, Dict, List, Optional, Tuple

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

logger = logging.getLogger(__name__)
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


async def _fetch_platform_safe(
    platform: str,
    fetch_func,
    config: JobConfig,
    db: AsyncSession,
) -> Tuple[List[JobResult], int, Optional[str]]:
    """
    Safely fetch jobs from a single platform with error handling.
    Returns (results, skipped_count, error_message).
    """
    try:
        logger.info(f"Fetching jobs from {platform}...")
        import time
        start = time.time()
        results, skipped = await fetch_func(config, db)
        elapsed = time.time() - start
        logger.info(f"✓ {platform} completed in {elapsed:.2f}s: {len(results)} jobs, {skipped} skipped")
        return results, skipped, None
    except Exception as e:
        error_msg = f"{platform} failed: {str(e)}"
        logger.warning(error_msg, exc_info=True)
        return [], 0, error_msg


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

    # Initialize all counts/skipped to 0
    counts = {}
    skipped = {}
    for p in ["remoteok", "remotive", "hn", "github", "yc"]:
        counts[p] = 0
        skipped[p] = 0

    # Create parallel fetch tasks for selected platforms
    tasks = []
    platform_order = []

    if "remoteok" in selected_platforms:
        tasks.append(_fetch_platform_safe("remoteok", fetch_remoteok_jobs, config, db))
        platform_order.append("remoteok")

    if "remotive" in selected_platforms:
        tasks.append(_fetch_platform_safe("remotive", fetch_remotive_jobs, config, db))
        platform_order.append("remotive")

    if "hn" in selected_platforms or "hackernews" in selected_platforms:
        tasks.append(_fetch_platform_safe("hn", fetch_hn_jobs, config, db))
        platform_order.append("hn")

    if "github" in selected_platforms:
        tasks.append(_fetch_platform_safe("github", fetch_github_jobs, config, db))
        platform_order.append("github")

    if "yc" in selected_platforms or "ycombinator" in selected_platforms:
        tasks.append(_fetch_platform_safe("yc", fetch_yc_jobs, config, db))
        platform_order.append("yc")

    # Run all fetchers in parallel
    logger.info(f"Starting parallel fetch for: {', '.join(platform_order)}")
    results = await asyncio.gather(*tasks)

    # Aggregate results
    all_results: List[JobResult] = []
    for idx, (platform_results, platform_skipped, error_msg) in enumerate(results):
        platform_name = platform_order[idx]
        counts[platform_name] = len(platform_results)
        skipped[platform_name] = platform_skipped
        all_results.extend(platform_results)

    await db.commit()

    total_skipped = sum(skipped.values())

    logger.info(f"Fetch complete: {len(all_results)} total jobs, {total_skipped} skipped")
    return {
        "config_id": str(config.id),
        "counts": counts,
        "skipped": skipped,
        "total_inserted": len(all_results),
        "total_skipped": total_skipped,
        "jobs": [_job_result_to_dict(j) for j in all_results],
    }
