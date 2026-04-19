import asyncio
import json
import logging
import os
import random
import re
from typing import Any, Dict

from groq import AsyncGroq, Groq

from app.models.job_config import JobConfig
from app.models.job_result import JobResult

logger = logging.getLogger(__name__)

GROQ_MODEL = os.getenv("GROQ_EVAL_MODEL", "llama-3.3-70b-versatile")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

# Keep the description trimmed: most job postings repeat "perks / EEO boilerplate"
# after the first ~800 chars. Cutting it saves 50–80% of tokens per call and
# keeps us under Groq's 30k TPM free-tier limit without hurting accuracy.
MAX_DESC_CHARS = 800
MAX_RETRIES = 3

_RETRY_AFTER_RE = re.compile(r"try again in\s*([\d.]+)\s*(ms|s)", re.IGNORECASE)

if not GROQ_API_KEY:
    logger.warning("GROQ_API_KEY environment variable is not set")

# Keep the sync client for legacy callers; all new code paths use the async one
# because the sync client blocks FastAPI's event loop.
_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None
_async_client = AsyncGroq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None


_SYSTEM_PROMPT = (
    "You are a strict job matching evaluator. "
    "Always respond with a JSON object containing: "
    '{"score": int, "reason": string, "matches": {"skills_match": int, '
    '"seniority_match": int, "location_match": int}}.'
)


def _trim_desc(desc: str | None) -> str:
    if not desc:
        return "No description"
    desc = desc.strip()
    if len(desc) <= MAX_DESC_CHARS:
        return desc
    return desc[:MAX_DESC_CHARS].rsplit(" ", 1)[0] + "…"


def build_job_prompt(config: JobConfig, job: JobResult) -> str:
    keywords = ", ".join(config.keywords or [])
    platforms = ", ".join(config.platforms or [])
    return f"""
You are an assistant that scores how well a job matches a candidate's preferences.

Candidate preferences (from config):
- Role: {config.parsed_role or config.raw_query}
- Keywords / tech stack: {keywords or "none specified"}
- Seniority: {config.seniority or "unspecified"}
- Location preference: {config.location_preference or "unspecified"}
- Platforms: {platforms or "unspecified"}

Job posting:
- Source: {job.source}
- Title: {job.title}
- Company: {job.company or "Unknown"}
- Location: {job.location or "Unknown"}
- URL: {job.url}
- Description:
{_trim_desc(job.description)}

Guidelines:
- Consider skills/keywords, seniority, location/remote fit, and any hints in description.
- Score from 0 (terrible fit) to 100 (perfect fit).
- Intern-level roles should get higher scores when seniority=intern, and lower otherwise.
- Prefer remote or matching location when location_preference is set to remote or a specific region.
- Be concise and specific in the reason, referencing exact clues from the job text.
""".strip()


def _parse_completion(raw: str) -> Dict[str, Any]:
    data = json.loads(raw)

    score = int(data.get("score", 0))
    reason = str(data.get("reason", "")).strip()

    matches = data.get("matches") or {}
    skills_match = int(matches.get("skills_match", score))
    seniority_match = int(matches.get("seniority_match", score))
    location_match = int(matches.get("location_match", score))

    return {
        "score": max(0, min(100, score)),
        "reason": reason or "No reason provided by evaluator.",
        "matches": {
            "skills_match": max(0, min(100, skills_match)),
            "seniority_match": max(0, min(100, seniority_match)),
            "location_match": max(0, min(100, location_match)),
        },
    }


def _retry_after_seconds(err: Exception) -> float | None:
    """Pull the suggested delay out of Groq's rate-limit error message."""
    # Prefer a Retry-After header if the SDK exposes it.
    response = getattr(err, "response", None)
    if response is not None:
        header = None
        try:
            header = response.headers.get("retry-after")
        except Exception:
            header = None
        if header:
            try:
                return float(header)
            except (TypeError, ValueError):
                pass

    # Fallback: parse Groq's human-readable "try again in 1.39s / 514ms" hint.
    m = _RETRY_AFTER_RE.search(str(err))
    if not m:
        return None
    value = float(m.group(1))
    if m.group(2).lower() == "ms":
        value /= 1000
    return value


def _is_rate_limited(err: Exception) -> bool:
    status = getattr(err, "status_code", None)
    if status == 429:
        return True
    msg = str(err).lower()
    return "429" in msg or "rate_limit" in msg or "rate limit" in msg


async def evaluate_job_async(config: JobConfig, job: JobResult) -> Dict[str, Any]:
    """Score a single job using AsyncGroq — safe to call under asyncio.gather.

    Retries up to ``MAX_RETRIES`` times on 429 rate-limit responses, sleeping
    for the delay Groq recommends (plus a small jitter) before each retry.
    """
    if not GROQ_API_KEY or _async_client is None:
        raise ValueError("GROQ_API_KEY environment variable is not set")

    prompt = build_job_prompt(config, job)

    last_err: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            completion = await _async_client.chat.completions.create(
                model=GROQ_MODEL,
                response_format={"type": "json_object"},
                messages=[
                    {"role": "system", "content": _SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.2,
                max_tokens=220,
            )
            return _parse_completion(completion.choices[0].message.content)
        except Exception as e:
            last_err = e
            if not _is_rate_limited(e) or attempt == MAX_RETRIES - 1:
                logger.error(f"Groq API error for job {job.id}: {e}")
                raise

            delay = _retry_after_seconds(e) or (0.6 * (2 ** attempt))
            delay = min(delay + random.uniform(0.1, 0.4), 8.0)
            logger.warning(
                f"Groq 429 for job {job.id}, retry {attempt + 1}/{MAX_RETRIES - 1} in {delay:.2f}s"
            )
            await asyncio.sleep(delay)

    # Unreachable — the loop either returns or re-raises — but keep mypy happy.
    raise last_err  # type: ignore[misc]


def evaluate_job(config: JobConfig, job: JobResult) -> Dict[str, Any]:
    """Synchronous fallback. Retained for non-async callers; new code should use
    ``evaluate_job_async`` which does not block the event loop."""
    if not GROQ_API_KEY or _client is None:
        raise ValueError("GROQ_API_KEY environment variable is not set")

    prompt = build_job_prompt(config, job)

    try:
        completion = _client.chat.completions.create(
            model=GROQ_MODEL,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            max_tokens=256,
        )
    except Exception as e:
        logger.error(f"Groq API error for job {job.id}: {e}")
        raise

    return _parse_completion(completion.choices[0].message.content)
