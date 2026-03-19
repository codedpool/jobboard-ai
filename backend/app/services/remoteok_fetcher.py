import datetime as dt
from typing import List, Tuple

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job_config import JobConfig
from app.models.job_result import JobResult
from app.services.dedupe import compute_dedupe_key, filter_new_jobs

REMOTEOK_API_URL = "https://remoteok.com/api"


def _normalize_remoteok_job(raw: dict, config_id) -> JobResult:
    title = raw.get("position") or raw.get("title") or ""
    company = raw.get("company") or ""
    url = raw.get("url") or raw.get("apply_url") or ""
    location = raw.get("location") or "remote"
    description = raw.get("description") or ""
    created_at_str = raw.get("date") or raw.get("created_at")

    created_at = None
    if created_at_str:
        try:
            created_at = dt.datetime.fromisoformat(
                created_at_str.replace("Z", "+00:00")
            )
        except Exception:
            created_at = None

    return JobResult(
        config_id=config_id,
        title=title[:255],
        company=company[:255],
        url=url,
        source="remoteok",
        location=location[:255],
        description=description,
        score=None,
        reason=None,
        created_at=created_at,
    )


def _matches_keywords(job: dict, keywords: list[str]) -> bool:
    if not keywords:
        return True
    text = " ".join(
        [
            job.get("position") or "",
            job.get("title") or "",
            job.get("company") or "",
            job.get("tags") and " ".join(job.get("tags")) or "",
            job.get("description") or "",
        ]
    ).lower()
    return all(k.lower() in text for k in keywords)


async def fetch_remoteok_jobs(
    config: JobConfig,
    db: AsyncSession,
    max_jobs: int = 50,
) -> Tuple[List[JobResult], int]:
    """
    Fetch jobs from RemoteOK, skipping any that are already stored for this
    config (dedupe by source + title + company + URL).

    Returns:
        (inserted_jobs, skipped_count)
    """
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(
            REMOTEOK_API_URL, headers={"Accept": "application/json"}
        )
        resp.raise_for_status()
        data = resp.json()

    # First element is often API metadata — skip non-dict items.
    jobs_raw = [j for j in data if isinstance(j, dict)]

    filtered = [j for j in jobs_raw if _matches_keywords(j, config.keywords or [])][
        :max_jobs
    ]

    # Build candidate JobResult objects (not yet added to the session).
    candidates: List[JobResult] = []
    for raw in filtered:
        jr = _normalize_remoteok_job(raw, config.id)
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
