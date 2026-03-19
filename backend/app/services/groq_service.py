import os
from typing import Any, Dict, List, Optional

from groq import Groq

GROQ_API_KEY = os.getenv("GROQ_API_KEY")
if not GROQ_API_KEY:
    raise RuntimeError("GROQ_API_KEY is not set")

client = Groq(api_key=GROQ_API_KEY)

MODEL_ID = "llama-3.3-70b-versatile"  # strong for structured understanding [web:59]


SYSTEM_PROMPT = """
You are an assistant that extracts structured job search parameters from a single user message.

Given a natural language job search query, you must output a concise JSON object with:
- parsed_role: primary role title the user is looking for (string, e.g. "Backend Engineer")
- keywords: important tech or domain keywords (array of strings, lowercase)
- seniority: one of ["intern", "junior", "mid", "senior", "lead", "any"]
- location_preference: short text like "remote", "onsite in Delhi", "hybrid Bangalore", etc.
- summary: 1–2 sentence human-readable summary of the search intent

If some fields are not explicit, infer reasonable defaults (e.g. seniority "any").
Respond with ONLY a JSON object, no extra text.
"""


def _build_messages(message: str) -> List[Dict[str, str]]:
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": message},
    ]


def parse_job_query(message: str) -> Dict[str, Any]:
    """
    Call Groq LLM to parse a free-form job search query
    into a structured JSON object.
    """
    completion = client.chat.completions.create(  # [web:54][web:59]
        model=MODEL_ID,
        messages=_build_messages(message),
        temperature=0.2,
        response_format={"type": "json_object"},
    )

    content = completion.choices[0].message.content
    # content is a JSON string due to response_format, but Groq types it as str | None
    import json

    try:
        data = json.loads(content or "{}")
    except json.JSONDecodeError:
        data = {}

    parsed_role: Optional[str] = data.get("parsed_role") or ""
    keywords: List[str] = data.get("keywords") or []
    seniority: Optional[str] = data.get("seniority") or "any"
    location_preference: Optional[str] = data.get("location_preference") or ""
    summary: Optional[str] = data.get("summary") or ""

    return {
        "parsed_role": parsed_role,
        "keywords": keywords,
        "seniority": seniority,
        "location_preference": location_preference,
        "summary": summary,
    }
