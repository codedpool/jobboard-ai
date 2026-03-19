import datetime as dt
from typing import List, Optional

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job_config import JobConfig
from app.models.job_result import JobResult


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
) -> List[JobResult]:
    params = {}
    # We could add category filtering later if needed
    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.get(REMOTIVE_API_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    jobs_raw = data.get("jobs", [])

    filtered = [
        j for j in jobs_raw if _matches_keywords_remotive(j, config.keywords or [])
    ][:max_jobs]

    results: List[JobResult] = []
    for raw in filtered:
        jr = _normalize_remotive_job(raw, config.id)
        if not jr.url:
            continue
        results.append(jr)

    for r in results:
        db.add(r)

    await db.flush()
    return results
