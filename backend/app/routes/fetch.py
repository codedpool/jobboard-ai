import asyncio
import logging
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi_clerk_auth import HTTPAuthorizationCredentials
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_clerk_auth
from app.db.session import AsyncSessionLocal, get_db
from app.models.job_config import JobConfig
from app.models.job_result import JobResult
from app.services.quota import PAYMENT_FORM_URL, consume_search
from app.services.hn_fetcher import fetch_hn_jobs
from app.services.jobspy_fetcher import fetch_jobspy_jobs
from app.services.remoteok_fetcher import fetch_remoteok_jobs

# JobSpy covers these four boards under one umbrella fetcher.
_JOBSPY_SITES = {"linkedin", "indeed", "google", "glassdoor"}

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
    _shared_db: AsyncSession,  # unused — kept for signature stability
) -> Tuple[List[JobResult], int, Optional[str]]:
    """Run one fetcher with its own AsyncSession.

    Fetchers flush writes to persist dedupe keys before the next fetcher looks
    them up. Sharing a single session across fetchers running under
    ``asyncio.gather()`` causes "Session is already flushing" races, so each
    fetcher gets an isolated session and commits independently. Because we
    build the session with ``expire_on_commit=False``, the returned ORM
    instances are still safe to read after the session closes.
    """
    import time

    logger.info(f"Fetching jobs from {platform}...")
    start = time.time()
    try:
        async with AsyncSessionLocal() as own_db:
            try:
                results, skipped = await fetch_func(config, own_db)
                await own_db.commit()
            except Exception:
                await own_db.rollback()
                raise
        elapsed = time.time() - start
        logger.info(
            f"✓ {platform} completed in {elapsed:.2f}s: {len(results)} jobs, {skipped} skipped"
        )
        return results, skipped, None
    except Exception as e:
        elapsed = time.time() - start
        error_msg = f"{platform} failed after {elapsed:.2f}s: {e}"
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

    email = credentials.decoded.get("email") or credentials.decoded.get("primary_email_address")

    # Load config and ensure it belongs to this user
    result = await db.execute(select(JobConfig).where(JobConfig.id == config_id))
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(status_code=404, detail="Config not found")

    if config.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not your config")

    # Enforce per-user search quota before running expensive fetch work.
    decision = await consume_search(db, user_id=user_id, email=email)
    if not decision.allowed:
        await db.commit()
        raise HTTPException(
            status_code=402,
            detail={
                "code": "quota_exceeded",
                "plan": decision.plan,
                "searches_used": decision.searches_used,
                "searches_limit": decision.searches_limit,
                "payment_url": PAYMENT_FORM_URL,
                "message": (
                    "You've used all your free job searches. "
                    "Fill out this short form to continue: "
                    f"{PAYMENT_FORM_URL}"
                ),
            },
        )

    # Determine which platforms to fetch from. We surface JobSpy's sub-sites
    # (linkedin/indeed/google/glassdoor) as if they were first-class platforms
    # so the existing platform picker keeps working unchanged.
    NEW_DEFAULTS = ["linkedin", "indeed", "google", "glassdoor", "remoteok", "hn"]
    LEGACY_ONLY = {"remoteok", "remotive", "github", "hn", "yc"}

    selected_platforms: list[str] = []
    if platforms:
        # Explicit per-request override from the picker dialog always wins.
        selected_platforms = [p.strip().lower() for p in platforms.split(",")]
    elif config.platforms:
        stored = [p.lower() for p in config.platforms]
        # Migrate pre-JobSpy configs on the fly: if every stored platform is a
        # legacy-only source, fall back to the new defaults so the user gets
        # JobSpy coverage without having to re-create their agent.
        if set(stored) <= LEGACY_ONLY:
            logger.info(
                f"Upgrading legacy-only platforms {stored!r} → JobSpy-inclusive defaults"
            )
            selected_platforms = list(NEW_DEFAULTS)
        else:
            selected_platforms = stored
    else:
        selected_platforms = list(NEW_DEFAULTS)

    all_known = ["linkedin", "indeed", "google", "glassdoor", "remoteok", "hn"]
    counts = {p: 0 for p in all_known}
    skipped = {p: 0 for p in all_known}

    tasks = []
    platform_order: list[str] = []

    # JobSpy — run one call covering whichever of its sites the user picked.
    selected_jobspy = [s for s in selected_platforms if s in _JOBSPY_SITES]
    if selected_jobspy:
        platform_order.append("jobspy")
        sites_for_task = list(selected_jobspy)  # snapshot for the closure

        async def _jobspy_fetch(cfg, task_db):
            return await fetch_jobspy_jobs(cfg, task_db, sites=sites_for_task)

        tasks.append(
            _fetch_platform_safe(
                "jobspy:" + ",".join(sites_for_task),
                _jobspy_fetch,
                config,
                db,
            )
        )

    if "remoteok" in selected_platforms:
        tasks.append(_fetch_platform_safe("remoteok", fetch_remoteok_jobs, config, db))
        platform_order.append("remoteok")

    if "hn" in selected_platforms or "hackernews" in selected_platforms:
        tasks.append(_fetch_platform_safe("hn", fetch_hn_jobs, config, db))
        platform_order.append("hn")

    # Run all fetchers in parallel
    logger.info(f"Starting parallel fetch for: {', '.join(platform_order)}")
    results = await asyncio.gather(*tasks)

    # Aggregate results. JobSpy returns jobs with a per-row `source` (the actual
    # board), so we bucket its counts by `source` rather than by the umbrella
    # platform name.
    all_results: List[JobResult] = []
    for idx, (platform_results, platform_skipped, error_msg) in enumerate(results):
        platform_name = platform_order[idx]
        if platform_name == "jobspy":
            for job in platform_results:
                src = (job.source or "").lower()
                if src in counts:
                    counts[src] += 1
            # We don't know the per-site skip split; attribute to "linkedin"
            # as a proxy since it's the dominant source. (Informational only.)
            if platform_skipped and "linkedin" in counts:
                skipped["linkedin"] += platform_skipped
        else:
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
