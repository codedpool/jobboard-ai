import hashlib
import re
from typing import Any, List, Tuple
from urllib.parse import urlparse

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.job_result import JobResult

_ws_re = re.compile(r"\s+")
_punct_re = re.compile(r"[^a-z0-9\s]")
# Trailing location/remote decorators we strip from titles to help cross-source
# matches: "Senior Engineer - Remote (US)" and "Senior Engineer | Remote" should
# collapse to the same key.
_trail_decor_re = re.compile(
    r"\s*[-–|()\[\]]+\s*(remote|hybrid|on[\- ]site|onsite|anywhere|wfh|us|eu|europe|usa|united states|uk|canada|apac|emea|global|worldwide)\s*.*$",
    re.IGNORECASE,
)
# Seniority tokens are normalised so "Sr.", "Senior", "Sr" collapse together.
_sr_tokens = {
    "sr": "senior",
    "sr.": "senior",
    "jr": "junior",
    "jr.": "junior",
    "ii": "",
    "iii": "",
    "iv": "",
}


def _normalize_title(text: str) -> str:
    if not text:
        return ""
    t = text.strip().lower()
    # Strip trailing location/remote descriptors.
    t = _trail_decor_re.sub("", t)
    # Remove punctuation so "full-stack" and "full stack" match.
    t = _punct_re.sub(" ", t)
    # Normalise seniority abbreviations token-by-token.
    tokens = [_sr_tokens.get(tok, tok) for tok in t.split() if tok]
    tokens = [tok for tok in tokens if tok]
    return _ws_re.sub(" ", " ".join(tokens)).strip()


def _normalize_company(text: str) -> str:
    if not text:
        return ""
    t = text.strip().lower()
    # Drop common suffixes/entity types
    t = re.sub(r"\b(inc|llc|ltd|gmbh|co|corp|corporation|company|sa|bv|plc)\b\.?", "", t)
    t = _punct_re.sub(" ", t)
    return _ws_re.sub(" ", t).strip()


# Known job-board URL patterns that carry a canonical posting ID. Extracting the
# ID lets the same posting match across LinkedIn variants (mobile, desktop, feed).
_URL_ID_PATTERNS = [
    (re.compile(r"linkedin\.com/jobs/view/(\d+)"), "linkedin"),
    (re.compile(r"linkedin\.com/jobs/.*?currentJobId=(\d+)"), "linkedin"),
    (re.compile(r"indeed\.com/.*?jk=([a-f0-9]+)"), "indeed"),
    (re.compile(r"glassdoor\.com/.*?jobListingId=(\d+)"), "glassdoor"),
    (re.compile(r"glassdoor\.com/.*?job-listing/.+?-JV_KO\d+,\d+_IC\d+_KE\d+,\d+\.htm"), "glassdoor"),
    (re.compile(r"remoteok\.com/remote-jobs/(\d+)"), "remoteok"),
    (re.compile(r"ycombinator\.com/companies/([^/]+)/jobs/([^/?#]+)"), "yc"),
]


def _canonical_url_key(url: str) -> str | None:
    """If the URL matches a known board pattern, return '<board>:<id>'. Else None."""
    if not url:
        return None
    for pat, board in _URL_ID_PATTERNS:
        m = pat.search(url)
        if m:
            return f"{board}:{m.group(m.lastindex or 1)}"
    return None


def _url_host_path(url: str) -> str:
    """Fallback: host + path (no query, no fragment)."""
    if not url:
        return ""
    try:
        p = urlparse(url.lower().strip())
        return f"{p.netloc}{p.path}"
    except Exception:
        return url.lower().strip()


def compute_dedupe_key(job: JobResult) -> str:
    """
    Compute a stable SHA-256 fingerprint that's shared across sources when the
    posting is really the same role at the same company.

    Priority (cross-source collapse is the point — URL IDs differ per board):
      1. Normalised (title, company) tuple. The SAME Acme "Senior Software
         Engineer" role on LinkedIn + Indeed will collide here and collapse
         into a single card.
      2. Canonical board ID (e.g. "linkedin:3912345") when company is missing
         but we recognise the URL pattern.
      3. Host+path of the URL as a last-resort fallback for niche boards.
    """
    t = _normalize_title(job.title or "")
    c = _normalize_company(job.company or "")

    if t and c:
        base = f"tc|{t}|{c}"
    else:
        canonical = _canonical_url_key(job.url or "")
        if canonical:
            base = canonical
        else:
            base = f"u|{_url_host_path(job.url or '')}|{t}"

    return hashlib.sha256(base.encode("utf-8")).hexdigest()


def pick_richer(a: JobResult, b: JobResult) -> JobResult:
    """When two dedupe-equivalent candidates come in the same batch, keep the
    one with more useful metadata (longer description, salary, explicit remote
    flag, etc.)."""
    def richness(j: JobResult) -> int:
        score = 0
        if j.description:
            score += min(len(j.description), 4000)
        if j.salary_min or j.salary_max:
            score += 500
        if j.is_remote is True:
            score += 100
        if j.location:
            score += 50
        if j.date_posted:
            score += 50
        return score

    return a if richness(a) >= richness(b) else b


async def filter_new_jobs(
    db: AsyncSession,
    config_id: Any,
    candidates: List[JobResult],
) -> Tuple[List[JobResult], int]:
    """
    Given a list of *candidate* JobResult objects (not yet persisted), return
    only the ones whose dedupe_key does not already exist for this config.
    Also collapses duplicates within the batch itself, keeping the richest one.
    """
    if not candidates:
        return [], 0

    # Dedupe within the batch, preferring the richer copy.
    key_to_job: dict[str, JobResult] = {}
    for job in candidates:
        if not job.dedupe_key:
            job.dedupe_key = compute_dedupe_key(job)
        existing = key_to_job.get(job.dedupe_key)
        key_to_job[job.dedupe_key] = pick_richer(existing, job) if existing else job

    all_keys = list(key_to_job.keys())

    # One query to find which of these keys are already in the DB.
    stmt = select(JobResult.dedupe_key).where(
        JobResult.config_id == config_id,
        JobResult.dedupe_key.in_(all_keys),
    )
    result = await db.execute(stmt)
    existing_keys: set[str] = {row[0] for row in result.all()}

    new_jobs = [j for k, j in key_to_job.items() if k not in existing_keys]
    skipped = len(candidates) - len(new_jobs)

    return new_jobs, skipped
