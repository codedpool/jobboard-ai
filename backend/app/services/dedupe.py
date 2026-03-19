import hashlib
import re
from typing import Any, List, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job_result import JobResult

_whitespace_re = re.compile(r"\s+")


def _normalize(text: str) -> str:
    """Lowercase, strip, and collapse internal whitespace."""
    return _whitespace_re.sub(" ", (text or "").strip().lower())


def compute_dedupe_key(job: JobResult) -> str:
    """
    Compute a stable SHA-256 fingerprint for a job posting.

    The key is built from four fields that together uniquely identify a
    posting regardless of minor formatting differences:
        source | title | company | url
    """
    base = (
        f"{job.source}"
        f"|{_normalize(job.title)}"
        f"|{_normalize(job.company or '')}"
        f"|{(job.url or '').strip().lower()}"
    )
    return hashlib.sha256(base.encode("utf-8")).hexdigest()


async def filter_new_jobs(
    db: AsyncSession,
    config_id: Any,
    candidates: List[JobResult],
) -> Tuple[List[JobResult], int]:
    """
    Given a list of *candidate* JobResult objects (not yet persisted), return
    only the ones whose dedupe_key does not already exist for this config.

    Uses a single IN-query so the cost is one round-trip regardless of how
    many candidates there are.

    Returns:
        (new_jobs, skipped_count)
        - new_jobs: subset of candidates that are genuinely new
        - skipped_count: number of candidates that were duplicates
    """
    if not candidates:
        return [], 0

    # Build the set of keys we want to check.
    key_to_job: dict[str, JobResult] = {}
    for job in candidates:
        if not job.dedupe_key:
            job.dedupe_key = compute_dedupe_key(job)
        # Last-write-wins if two candidates share the same key (edge case).
        key_to_job[job.dedupe_key] = job

    all_keys = list(key_to_job.keys())

    # One query to find which of these keys are already in the DB.
    stmt = select(JobResult.dedupe_key).where(
        JobResult.config_id == config_id,
        JobResult.dedupe_key.in_(all_keys),
    )
    result = await db.execute(stmt)
    existing_keys: set[str] = {row[0] for row in result.all()}

    new_jobs = [job for job in candidates if job.dedupe_key not in existing_keys]
    skipped = len(candidates) - len(new_jobs)

    return new_jobs, skipped
