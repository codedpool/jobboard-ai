from typing import List, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job_config import JobConfig
from app.models.job_result import JobResult


async def fetch_yc_jobs(
    config: JobConfig,
    db: AsyncSession,
    max_jobs: int = 50,
) -> Tuple[List[JobResult], int]:
    # NOTE: YC job board is JS-rendered; we would need a headless browser
    # or an external API (e.g. Apify YC jobs actor) to scrape it reliably.
    # For now, we keep the hook but return an empty list with zero skipped.
    return [], 0
