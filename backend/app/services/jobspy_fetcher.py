"""JobSpy fetcher — wraps the sync `python-jobspy` library into our async
pipeline. Fans out across LinkedIn, Indeed, Google and Glassdoor in a single
call (JobSpy handles the per-site concurrency internally).

Runs in a worker thread via ``asyncio.to_thread`` so it never blocks the event
loop. Individual sites can fail (rate-limits, layout changes) without taking
down the whole fetch — JobSpy returns an empty DataFrame for failed sites.
"""

import asyncio
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Iterable, List, Optional, Tuple

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job_config import JobConfig
from app.models.job_result import JobResult
from app.services.dedupe import filter_new_jobs

logger = logging.getLogger(__name__)

# Sites JobSpy supports. LinkedIn/Indeed are most valuable; Google/Glassdoor
# are aggregators that broaden coverage. Override via env.
DEFAULT_SITES = [
    s.strip()
    for s in os.getenv("JOBSPY_SITES", "linkedin,indeed,google,glassdoor").split(",")
    if s.strip()
]

# Per-site result cap. JobSpy default is low; 15 each is a good budget.
RESULTS_PER_SITE = int(os.getenv("JOBSPY_RESULTS_PER_SITE", "15"))

# Hours of look-back. "Posted in the last 72 hours" by default.
HOURS_OLD = int(os.getenv("JOBSPY_HOURS_OLD", "168"))  # 7 days

# Proxies: comma-separated "http://host:port" URLs. Optional.
_proxy_env = os.getenv("JOBSPY_PROXIES", "").strip()
PROXIES: Optional[List[str]] = (
    [p.strip() for p in _proxy_env.split(",") if p.strip()] if _proxy_env else None
)

# Overall wall-clock cap for the whole JobSpy call.
JOBSPY_TIMEOUT_S = int(os.getenv("JOBSPY_TIMEOUT_S", "30"))


def _location_hint(config: JobConfig) -> str:
    pref = (config.location_preference or "").strip().lower()
    if not pref or pref == "remote":
        return ""
    return config.location_preference


def _is_remote_pref(config: JobConfig) -> bool:
    pref = (config.location_preference or "").lower()
    return "remote" in pref


def _build_search_term(config: JobConfig) -> str:
    """Turn the parsed config back into a short search string. JobSpy wants a
    concise term, not a sentence — keep it under ~8 tokens."""
    role = (config.parsed_role or "").strip()
    if role:
        return role[:80]
    # Fall back to first 6 keywords.
    kws = [k for k in (config.keywords or []) if k][:6]
    if kws:
        return " ".join(kws)[:80]
    return (config.raw_query or "jobs")[:80]


def _sync_scrape(config: JobConfig, sites: List[str]) -> list[dict]:
    """Call jobspy.scrape_jobs in the calling thread and return plain dicts.

    Importing jobspy is deferred to this function so the backend still boots
    cleanly if the dependency is missing.
    """
    try:
        from jobspy import scrape_jobs  # type: ignore
    except ImportError as e:
        logger.warning("python-jobspy not installed; JobSpy fetcher is a no-op: %s", e)
        return []

    kwargs: dict = dict(
        site_name=sites,
        search_term=_build_search_term(config),
        results_wanted=RESULTS_PER_SITE,
        hours_old=HOURS_OLD,
        country_indeed="usa",
        description_format="markdown",
        verbose=0,
    )
    loc = _location_hint(config)
    if loc:
        kwargs["location"] = loc
    if _is_remote_pref(config):
        kwargs["is_remote"] = True
    if PROXIES:
        kwargs["proxies"] = PROXIES

    try:
        df = scrape_jobs(**kwargs)
    except Exception as e:
        logger.warning("JobSpy scrape failed entirely: %s", e)
        return []

    if df is None or df.empty:
        return []

    # Convert DataFrame → list[dict] with JSON-safe values.
    rows = df.to_dict(orient="records")
    return rows


def _coerce_int(v) -> Optional[int]:
    if v is None:
        return None
    try:
        if isinstance(v, float) and (v != v):  # NaN
            return None
        return int(v)
    except (TypeError, ValueError):
        return None


def _coerce_str(v) -> Optional[str]:
    if v is None:
        return None
    try:
        if isinstance(v, float) and (v != v):  # NaN
            return None
    except Exception:
        pass
    s = str(v).strip()
    return s or None


def _coerce_bool(v) -> Optional[bool]:
    if v is None:
        return None
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        try:
            if v != v:  # NaN
                return None
        except Exception:
            pass
        return bool(v)
    s = str(v).strip().lower()
    if s in ("true", "yes", "1"):
        return True
    if s in ("false", "no", "0"):
        return False
    return None


def _coerce_dt(v) -> Optional[datetime]:
    if v is None:
        return None
    if isinstance(v, datetime):
        return v if v.tzinfo else v.replace(tzinfo=timezone.utc)
    try:
        from pandas import Timestamp  # type: ignore
        if isinstance(v, Timestamp):
            py = v.to_pydatetime()
            return py if py.tzinfo else py.replace(tzinfo=timezone.utc)
    except Exception:
        pass
    try:
        s = str(v).strip()
        if not s:
            return None
        # Accept plain "2025-04-19" as well.
        if len(s) == 10:
            return datetime.fromisoformat(s).replace(tzinfo=timezone.utc)
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        return None


def _row_to_job(row: dict, config_id) -> Optional[JobResult]:
    url = _coerce_str(row.get("job_url") or row.get("job_url_direct") or row.get("url"))
    title = _coerce_str(row.get("title"))
    if not url or not title:
        return None

    source = _coerce_str(row.get("site")) or "jobspy"
    company = _coerce_str(row.get("company"))
    location = _coerce_str(row.get("location"))
    description = _coerce_str(row.get("description"))

    # JobSpy returns min/max/interval. We normalise to yearly integers.
    min_amount = _coerce_int(row.get("min_amount"))
    max_amount = _coerce_int(row.get("max_amount"))
    interval = (_coerce_str(row.get("interval")) or "").lower()
    if min_amount is not None or max_amount is not None:
        # Convert hourly/weekly/monthly to yearly for display consistency.
        factor = {"hourly": 40 * 52, "weekly": 52, "monthly": 12, "yearly": 1}.get(
            interval, 1
        )
        if min_amount is not None and factor != 1 and min_amount < 5000:
            min_amount = min_amount * factor
        if max_amount is not None and factor != 1 and max_amount < 5000:
            max_amount = max_amount * factor

    salary_currency = _coerce_str(row.get("currency"))

    job_type = _coerce_str(row.get("job_type"))
    is_remote = _coerce_bool(row.get("is_remote"))
    date_posted = _coerce_dt(row.get("date_posted"))

    return JobResult(
        id=uuid.uuid4(),
        config_id=config_id,
        title=title[:500],
        company=company,
        url=url,
        source=source.lower(),
        location=location,
        description=description,
        salary_min=min_amount,
        salary_max=max_amount,
        salary_currency=salary_currency,
        is_remote=is_remote,
        job_type=job_type,
        date_posted=date_posted,
    )


async def fetch_jobspy_jobs(
    config: JobConfig,
    db: AsyncSession,
    sites: Optional[Iterable[str]] = None,
) -> Tuple[List[JobResult], int]:
    """Run JobSpy in a worker thread and persist the new, deduped jobs.

    Returns the tuple expected by fetch.py: (inserted_jobs, skipped_count).
    """
    site_list = list(sites) if sites else list(DEFAULT_SITES)
    if not site_list:
        return [], 0

    try:
        rows = await asyncio.wait_for(
            asyncio.to_thread(_sync_scrape, config, site_list),
            timeout=JOBSPY_TIMEOUT_S,
        )
    except asyncio.TimeoutError:
        logger.warning("JobSpy timed out after %ss", JOBSPY_TIMEOUT_S)
        return [], 0

    if not rows:
        return [], 0

    candidates: List[JobResult] = []
    for r in rows:
        try:
            job = _row_to_job(r, config.id)
        except Exception as e:
            logger.debug("Skipping malformed JobSpy row: %s", e)
            continue
        if job is not None:
            candidates.append(job)

    new_jobs, skipped = await filter_new_jobs(db, config.id, candidates)
    for job in new_jobs:
        db.add(job)
    if new_jobs:
        await db.flush()

    logger.info(
        "JobSpy: %d rows fetched, %d inserted, %d deduped (%s)",
        len(rows), len(new_jobs), skipped, ",".join(site_list),
    )
    return new_jobs, skipped
