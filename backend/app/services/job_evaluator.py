import asyncio
import json
import logging
import os
import random
import re
from typing import Any, Dict, List, Sequence

from groq import AsyncGroq, Groq

from app.models.job_config import JobConfig
from app.models.job_result import JobResult

logger = logging.getLogger(__name__)

GROQ_MODEL = os.getenv("GROQ_EVAL_MODEL", "llama-3.3-70b-versatile")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")

# With batch-of-5 scoring we only send ~30 jobs through the LLM per search, so
# we can afford a richer description window for better accuracy.
MAX_DESC_CHARS = 1500
MAX_RETRIES = 3
DEFAULT_BATCH_SIZE = 5

_RETRY_AFTER_RE = re.compile(r"try again in\s*([\d.]+)\s*(ms|s)", re.IGNORECASE)

if not GROQ_API_KEY:
    logger.warning("GROQ_API_KEY environment variable is not set")

_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None
_async_client = AsyncGroq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None


# ─── Prompts ────────────────────────────────────────────────────────────────

_SINGLE_SYSTEM_PROMPT = (
    "You are a strict job matching evaluator. "
    "Always respond with a JSON object containing: "
    '{"score": int, "reason": string, "matches": {"skills_match": int, '
    '"seniority_match": int, "location_match": int}}.'
)

_BATCH_SYSTEM_PROMPT = (
    "You are a rigorous job-matching evaluator. You receive a candidate's "
    "preferences and up to 5 job postings identified by numeric indices. "
    "Score each posting relative to the others so the differences are "
    "meaningful — if one posting is clearly closer to the candidate's stack "
    "and seniority than another, its scores should reflect that.\n\n"
    "Score each of these dimensions 0–100:\n"
    "  • skills_match    — how well the required stack/keywords overlap\n"
    "  • seniority_match — is the level (intern/junior/mid/senior/staff) right\n"
    "  • location_match  — does location/remote policy fit the preference\n\n"
    "Overall `score` should be a weighted blend (skills 45%, seniority 25%, "
    "location 20%, generic signal 10%). The `reason` must be ONE sentence "
    "citing the single strongest clue from the job text (max 140 chars).\n\n"
    "Respond with EXACTLY this JSON shape and no extra text:\n"
    '{"evaluations": [{"id": <int>, "score": <int>, "reason": "<string>", '
    '"matches": {"skills_match": <int>, "seniority_match": <int>, '
    '"location_match": <int>}}, ...]}\n'
    "Include one entry per input job, in any order, using the integer id you "
    "were given."
)


# ─── Helpers ────────────────────────────────────────────────────────────────

def _trim_desc(desc: str | None) -> str:
    if not desc:
        return "No description"
    desc = desc.strip()
    if len(desc) <= MAX_DESC_CHARS:
        return desc
    return desc[:MAX_DESC_CHARS].rsplit(" ", 1)[0] + "…"


def _candidate_block(config: JobConfig) -> str:
    keywords = ", ".join(config.keywords or [])
    platforms = ", ".join(config.platforms or [])
    return (
        f"Candidate preferences:\n"
        f"- Role: {config.parsed_role or config.raw_query}\n"
        f"- Keywords / tech stack: {keywords or 'none specified'}\n"
        f"- Seniority: {config.seniority or 'unspecified'}\n"
        f"- Location preference: {config.location_preference or 'unspecified'}\n"
        f"- Platforms of interest: {platforms or 'unspecified'}"
    )


def build_job_prompt(config: JobConfig, job: JobResult) -> str:
    """Single-job prompt kept for the legacy sync path."""
    return f"""
{_candidate_block(config)}

Job posting:
- Source: {job.source}
- Title: {job.title}
- Company: {job.company or "Unknown"}
- Location: {job.location or "Unknown"}
- URL: {job.url}
- Description:
{_trim_desc(job.description)}

Guidelines:
- Score 0 (terrible fit) to 100 (perfect fit).
- Intern-level roles score higher when seniority=intern, lower otherwise.
- Remote-friendly wins when location_preference mentions remote.
- Cite the strongest clue from the job text in one concise sentence.
""".strip()


def _build_batch_prompt(config: JobConfig, jobs: Sequence[JobResult]) -> str:
    blocks = []
    for idx, job in enumerate(jobs):
        blocks.append(
            f"[id={idx}]\n"
            f"Title: {job.title}\n"
            f"Company: {job.company or 'Unknown'}\n"
            f"Source: {job.source}\n"
            f"Location: {job.location or 'Unknown'}\n"
            f"Description: {_trim_desc(job.description)}"
        )
    joined = "\n\n---\n\n".join(blocks)
    return f"{_candidate_block(config)}\n\nJobs to evaluate:\n\n{joined}"


def _parse_single(raw: str) -> Dict[str, Any]:
    data = json.loads(raw)
    score = int(data.get("score", 0))
    reason = str(data.get("reason", "")).strip()
    matches = data.get("matches") or {}
    return _shape_result(score, reason, matches)


def _shape_result(score: int, reason: str, matches: dict) -> Dict[str, Any]:
    skills = int(matches.get("skills_match", score))
    sen = int(matches.get("seniority_match", score))
    loc = int(matches.get("location_match", score))
    return {
        "score": max(0, min(100, score)),
        "reason": reason or "No reason provided by evaluator.",
        "matches": {
            "skills_match": max(0, min(100, skills)),
            "seniority_match": max(0, min(100, sen)),
            "location_match": max(0, min(100, loc)),
        },
    }


def _parse_batch(raw: str, expected: int) -> Dict[int, Dict[str, Any]]:
    data = json.loads(raw)
    out: Dict[int, Dict[str, Any]] = {}
    for item in data.get("evaluations", []) or []:
        try:
            idx = int(item.get("id"))
        except (TypeError, ValueError):
            continue
        if idx < 0 or idx >= expected:
            continue
        score = int(item.get("score", 0))
        reason = str(item.get("reason", "")).strip()
        matches = item.get("matches") or {}
        out[idx] = _shape_result(score, reason, matches)
    return out


# ─── Rate limit handling ────────────────────────────────────────────────────

def _retry_after_seconds(err: Exception) -> float | None:
    response = getattr(err, "response", None)
    if response is not None:
        try:
            header = response.headers.get("retry-after")
            if header:
                return float(header)
        except Exception:
            pass
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


async def _call_groq_with_retries(messages, *, max_tokens: int) -> str:
    """Shared rate-limit-aware call wrapper. Returns the raw JSON string."""
    if _async_client is None:
        raise ValueError("GROQ_API_KEY environment variable is not set")

    last_err: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            completion = await _async_client.chat.completions.create(
                model=GROQ_MODEL,
                response_format={"type": "json_object"},
                messages=messages,
                temperature=0.2,
                max_tokens=max_tokens,
            )
            return completion.choices[0].message.content or "{}"
        except Exception as e:
            last_err = e
            if not _is_rate_limited(e) or attempt == MAX_RETRIES - 1:
                raise
            delay = _retry_after_seconds(e) or (0.6 * (2 ** attempt))
            delay = min(delay + random.uniform(0.1, 0.4), 8.0)
            logger.warning(
                f"Groq 429, retry {attempt + 1}/{MAX_RETRIES - 1} in {delay:.2f}s"
            )
            await asyncio.sleep(delay)

    raise last_err  # type: ignore[misc]


# ─── Public API ─────────────────────────────────────────────────────────────

async def evaluate_job_async(config: JobConfig, job: JobResult) -> Dict[str, Any]:
    """Score a single job (fallback path; batch is preferred)."""
    prompt = build_job_prompt(config, job)
    try:
        raw = await _call_groq_with_retries(
            messages=[
                {"role": "system", "content": _SINGLE_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            max_tokens=220,
        )
        return _parse_single(raw)
    except Exception as e:
        logger.error(f"Groq API error for job {job.id}: {e}")
        raise


async def evaluate_jobs_batch_async(
    config: JobConfig,
    jobs: Sequence[JobResult],
) -> List[Dict[str, Any] | None]:
    """Score up to DEFAULT_BATCH_SIZE jobs in a single Groq call.

    Returns a list aligned with the input order. Entries for which the LLM
    didn't return a result (rare, happens if the model omits one) are ``None``
    and the caller can fall back to single-job evaluation for those.
    """
    if not jobs:
        return []

    prompt = _build_batch_prompt(config, jobs)
    raw = await _call_groq_with_retries(
        messages=[
            {"role": "system", "content": _BATCH_SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        max_tokens=160 * len(jobs) + 60,  # ~160 tokens per evaluation
    )

    by_idx = _parse_batch(raw, expected=len(jobs))
    return [by_idx.get(i) for i in range(len(jobs))]


# ─── Legacy sync single-job evaluator (kept for any non-async caller) ───────

def evaluate_job(config: JobConfig, job: JobResult) -> Dict[str, Any]:
    if not GROQ_API_KEY or _client is None:
        raise ValueError("GROQ_API_KEY environment variable is not set")

    prompt = build_job_prompt(config, job)
    try:
        completion = _client.chat.completions.create(
            model=GROQ_MODEL,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": _SINGLE_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            max_tokens=256,
        )
    except Exception as e:
        logger.error(f"Groq API error for job {job.id}: {e}")
        raise

    return _parse_single(completion.choices[0].message.content)
