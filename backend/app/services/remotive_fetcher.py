import datetime as dt
from typing import List, Optional, Tuple

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job_config import JobConfig
from app.models.job_result import JobResult
from app.services.dedupe import compute_dedupe_key, filter_new_jobs

REMOTIVE_API_URL = "https://remotive.com/api/remote-jobs"


def _normalize_remotive_job(raw: dict, config_id) -> JobResult:
    title = raw.get("title") or ""
    company = raw.get("company_name") or ""
    url = raw.get("url") or ""
    location = raw.get("candidate_required_location") or "remote"
    description = raw.get("description") or ""
    created_at_str = raw.get("publication_date")

    created_at: Optional[dt.datetime] = None
    if created_at_str:
        try:
            created_at = dt.datetime.fromisoformat(created_at_str)
        except Exception:
            created_at = None

    return JobResult(
        config_id=config_id,
        title=title[:255],
        company=company[:255],
        url=url,
        source="remotive",
        location=location[:255],
        description=description,
        score=None,
        reason=None,
        created_at=created_at,
    )


def _matches_keywords_remotive(job: dict, keywords: list[str]) -> bool:
    if not keywords:
        return True
    text = " ".join(
        [
            job.get("title") or "",
            job.get("company_name") or "",
            job.get("category") or "",
            job.get("description") or "",
        ]
    ).lower()
    return all(k.lower() in text for k in keywords)


async def fetch_remotive_jobs(
    config: JobConfig,
    db: AsyncSession,
    max_jobs: int = 50,
) -> Tuple[List[JobResult], int]:
    """
    Fetch jobs from Remotive, skipping any that are already stored for this
    config (dedupe by source + title + company + URL).

    Returns:
        (inserted_jobs, skipped_count)
    """
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(REMOTIVE_API_URL)
        resp.raise_for_status()
        data = resp.json()

    jobs_raw = data.get("jobs", [])

    filtered = [
        j for j in jobs_raw if _matches_keywords_remotive(j, config.keywords or [])
    ][:max_jobs]

    # Build candidate JobResult objects (not yet added to the session).
    candidates: List[JobResult] = []
    for raw in filtered:
        jr = _normalize_remotive_job(raw, config.id)
        if not jr.url:
            continue
        jr.dedupe_key = compute_dedupe_key(jr)
        candidates.append(jr)

    # Drop any candidates that already exist in the DB for this config.
    new_jobs, skipped = await filter_new_jobs(db, config.id, candidates)

    for job in new_jobs:
        db.add(job)

    await db.flush()  # assign DB-generated IDs
    return new_jobs, skipped
