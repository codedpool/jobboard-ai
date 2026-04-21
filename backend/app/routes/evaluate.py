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
from app.services.filters import title_matches_seniority
from app.services.job_evaluator import (
    DEFAULT_BATCH_SIZE,
    evaluate_job_async,
    evaluate_jobs_batch_async,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/configs", tags=["evaluation"])

# Parallel Groq calls per request. Each call now scores BATCH_SIZE jobs at
# once, so effective throughput is CONCURRENCY × BATCH_SIZE jobs/second.
EVAL_CONCURRENCY = int(os.getenv("GROQ_EVAL_CONCURRENCY", "3"))
EVAL_BATCH_SIZE = int(os.getenv("GROQ_EVAL_BATCH_SIZE", str(DEFAULT_BATCH_SIZE)))


def _chunks(seq, size):
    for i in range(0, len(seq), size):
        yield seq[i : i + size]


async def _score_batch(
    sem: asyncio.Semaphore,
    config: JobConfig,
    batch: list[JobResult],
) -> list[tuple[JobResult, Optional[dict]]]:
    """Score one batch. If the batch call fails entirely, fall back to
    single-job scoring so one bad batch doesn't tank the whole request."""
    async with sem:
        try:
            results = await evaluate_jobs_batch_async(config, batch)
        except Exception as e:
            logger.warning(f"Batch eval failed ({e}); falling back to singletons.")
            results = [None] * len(batch)

        # Fill any missing slots via single-job evaluation.
        out: list[tuple[JobResult, Optional[dict]]] = []
        for job, res in zip(batch, results):
            if res is None:
                try:
                    res = await evaluate_job_async(config, job)
                except Exception as e:
                    logger.error(f"Single eval failed for job {job.id}: {e}")
                    res = None
            out.append((job, res))
        return out


@router.post("/{config_id}/evaluate")
async def evaluate_jobs_for_config(
    config_id: str,
    limit: int = 30,
    platforms: Optional[str] = Query(None),
    credentials: HTTPAuthorizationCredentials = Depends(get_clerk_auth),
    db: AsyncSession = Depends(get_db),
):
    user_id = credentials.decoded.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: no sub claim")

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

    # Pull the freshest unevaluated jobs first.
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

    # Hard seniority filter BEFORE the LLM so we don't waste tokens (or score
    # floor) on senior roles returned for an intern query.
    prefilter_count = len(jobs)
    jobs = [j for j in jobs if title_matches_seniority(j.title or "", config.seniority)]
    seniority_filtered = prefilter_count - len(jobs)
    if seniority_filtered:
        logger.info(
            f"Seniority filter dropped {seniority_filtered}/{prefilter_count} "
            f"jobs (seniority={config.seniority})"
        )

    if not jobs:
        return {
            "config_id": str(config.id),
            "attempted": 0,
            "evaluated": 0,
            "errors": 0,
            "job_ids": [],
            "elapsed_ms": 0,
            "seniority_filtered": seniority_filtered,
        }

    start = time.perf_counter()
    sem = asyncio.Semaphore(max(1, EVAL_CONCURRENCY))
    batches = list(_chunks(jobs, EVAL_BATCH_SIZE))
    logger.info(
        f"Evaluating {len(jobs)} jobs for config {config.id} in "
        f"{len(batches)} batches of ≤{EVAL_BATCH_SIZE} "
        f"with concurrency={EVAL_CONCURRENCY}"
    )

    grouped = await asyncio.gather(*(_score_batch(sem, config, b) for b in batches))

    evaluated = 0
    errors = 0
    updated_job_ids: list[str] = []

    for group in grouped:
        for job, res in group:
            if res is None:
                errors += 1
                continue
            job.score = res["score"]
            job.reason = res["reason"]
            matches = res.get("matches") or {}
            job.skills_match = matches.get("skills_match")
            job.seniority_match = matches.get("seniority_match")
            job.location_match = matches.get("location_match")
            evaluated += 1
            updated_job_ids.append(str(job.id))

    await db.commit()

    elapsed_ms = int((time.perf_counter() - start) * 1000)
    logger.info(
        f"✓ evaluated {evaluated}/{len(jobs)} jobs "
        f"({errors} errors) in {elapsed_ms}ms via batch-of-{EVAL_BATCH_SIZE}"
    )

    return {
        "config_id": str(config.id),
        "attempted": len(jobs),
        "evaluated": evaluated,
        "errors": errors,
        "job_ids": updated_job_ids,
        "elapsed_ms": elapsed_ms,
        "seniority_filtered": seniority_filtered,
    }
