import datetime as dt
import os
from typing import List, Tuple

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job_config import JobConfig
from app.models.job_result import JobResult
from app.services.dedupe import compute_dedupe_key, filter_new_jobs

GITHUB_API_URL = "https://api.github.com/search/issues"
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")  # optional but recommended


def _matches_keywords(text: str, keywords: list[str]) -> bool:
    if not keywords:
        return True
    lower = text.lower()
    return all(k.lower() in lower for k in keywords)


async def fetch_github_jobs(
    config: JobConfig,
    db: AsyncSession,
    max_jobs: int = 30,
) -> Tuple[List[JobResult], int]:
    """
    Fetch hiring issues from GitHub, skipping any that are already stored for
    this config (dedupe by source + title + company + URL).

    Returns:
        (inserted_jobs, skipped_count)
    """
    query = "label:hiring type:issue state:open"

    headers = {"Accept": "application/vnd.github+json"}
    if GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {GITHUB_TOKEN}"

    async with httpx.AsyncClient(timeout=20, headers=headers) as client:
        resp = await client.get(
            GITHUB_API_URL, params={"q": query, "per_page": max_jobs}
        )
        resp.raise_for_status()
        data = resp.json()

    # Build candidate JobResult objects (not yet added to the session).
    candidates: List[JobResult] = []
    for item in data.get("items", []):
        text = (item.get("title") or "") + "\n" + (item.get("body") or "")
        if not _matches_keywords(text, config.keywords or []):
            continue

        title = item.get("title") or ""
        url = item.get("html_url") or ""
        repo_full_name = item.get("repository_url", "").split("repos/")[-1]
        created_at_str = item.get("created_at")
        created_at = None
        if created_at_str:
            try:
                created_at = dt.datetime.fromisoformat(
                    created_at_str.replace("Z", "+00:00")
                )
            except Exception:
                pass

        jr = JobResult(
            config_id=config.id,
            title=title[:255],
            company=repo_full_name[:255],
            url=url,
            source="github",
            location="",
            description=item.get("body") or "",
            score=None,
            reason=None,
            created_at=created_at,
        )
        jr.dedupe_key = compute_dedupe_key(jr)
        candidates.append(jr)

    # Drop any candidates that already exist in the DB for this config.
    new_jobs, skipped = await filter_new_jobs(db, config.id, candidates)

    for job in new_jobs:
        db.add(job)

    await db.flush()  # assign DB-generated IDs
    return new_jobs, skipped
