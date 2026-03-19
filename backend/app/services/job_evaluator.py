import os
from typing import Any, Dict

from groq import Groq  # already installed for parse-query
from app.models.job_config import JobConfig
from app.models.job_result import JobResult

GROQ_MODEL = os.getenv("GROQ_EVAL_MODEL", "llama-3.3-70b-versatile")

_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))


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
{job.description or "No description"}

Guidelines:
- Consider skills/keywords, seniority, location/remote fit, and any hints in description.
- Score from 0 (terrible fit) to 100 (perfect fit).
- Intern-level roles should get higher scores when seniority=intern, and lower otherwise.
- Prefer remote or matching location when location_preference is set to remote or a specific region.
- Be concise and specific in the reason, referencing exact clues from the job text.
""".strip()


def evaluate_job(config: JobConfig, job: JobResult) -> Dict[str, Any]:
    prompt = build_job_prompt(config, job)

    completion = _client.chat.completions.create(
        model=GROQ_MODEL,
        response_format={"type": "json_object"},  # JSON mode [web:154][web:165]
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a strict job matching evaluator. "
                    "Always respond with a JSON object containing: "
                    '{"score": int, "reason": string, "matches": {"skills_match": int, '
                    '"seniority_match": int, "location_match": int}}.'
                ),
            },
            {"role": "user", "content": prompt},
        ],
        temperature=0.2,
        max_tokens=256,
    )

    raw = completion.choices[0].message.content
    # Groq JSON mode guarantees valid JSON structure when used correctly. [web:154][web:165]
    import json

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
