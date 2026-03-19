import datetime as dt
from typing import List, Optional, Tuple

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job_config import JobConfig
from app.models.job_result import JobResult
from app.services.dedupe import compute_dedupe_key, filter_new_jobs

HN_SEARCH_URL = "https://hn.algolia.com/api/v1/search_by_date"
HN_ITEMS_URL = "https://hn.algolia.com/api/v1/search"


async def _get_latest_hiring_story_id() -> Optional[int]:
    async with httpx.AsyncClient(timeout=15) as client:
        params = {
            "query": "Ask HN: Who is hiring",
            "tags": "story",
            "hitsPerPage": 10,
            "page": 0,
        }
        resp = await client.get(HN_SEARCH_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    hits = data.get("hits", [])
    if not hits:
        return None

    hits_sorted = sorted(hits, key=lambda h: h.get("created_at_i", 0), reverse=True)
    for h in hits_sorted:
        title = (h.get("title") or "").lower()
        if "who is hiring" in title:
            return int(h["objectID"])
    return int(hits_sorted[0]["objectID"])


def _matches_keywords(text: str, keywords: list[str]) -> bool:
    if not keywords:
        return True
    lower = text.lower()
    return any(k.lower() in lower for k in keywords)


async def fetch_hn_jobs(
    config: JobConfig,
    db: AsyncSession,
    max_jobs: int = 50,
) -> Tuple[List[JobResult], int]:
    """
    Fetch jobs from the latest HN "Who is Hiring?" thread, skipping any that
    are already stored for this config (dedupe by source + title + company + URL).

    Returns:
        (inserted_jobs, skipped_count)
    """
    story_id = await _get_latest_hiring_story_id()
    if not story_id:
        return [], 0

    async with httpx.AsyncClient(timeout=20) as client:
        # Use numericFilters on the /search endpoint, not /search_by_date
        params = {
            "tags": "comment",
            "numericFilters": f"parent_id={story_id}",
            "hitsPerPage": max_jobs,
            "page": 0,
        }
        resp = await client.get(HN_ITEMS_URL, params=params)
        resp.raise_for_status()
        data = resp.json()

    # Build candidate JobResult objects (not yet added to the session).
    candidates: List[JobResult] = []
    for hit in data.get("hits", []):
        text_html = hit.get("comment_text") or ""
        text_plain = (
            text_html.replace("<p>", "\n")
            .replace("</p>", "")
            .replace("<i>", "")
            .replace("</i>", "")
            .replace("&#x27;", "'")
            .replace("&amp;", "&")
            .replace("&gt;", ">")
            .replace("&lt;", "<")
        )

        if not _matches_keywords(text_plain, config.keywords or []):
            continue

        title = f"HN: {hit.get('author', 'Anonymous')} hiring"
        url = f"https://news.ycombinator.com/item?id={hit.get('objectID')}"
        created_at_str = hit.get("created_at")
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
            company="",
            url=url,
            source="hn",
            location="",
            description=text_plain,
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
