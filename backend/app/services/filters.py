"""Hard filters applied after fetch, before the LLM burns tokens on jobs that
obviously don't match the candidate's constraints.

The LLM's seniority sub-score is a soft signal — a senior role can still get
a 40/100 on an intern query, which used to survive our score ≥ 45 floor and
confuse users. This module rejects those up-front, by title tokens.
"""

from __future__ import annotations

import re
from typing import Iterable


_word_re = re.compile(r"[A-Za-z]+(?:[\-/][A-Za-z]+)*")

# Words that strongly identify each seniority bucket from a job TITLE.
# We check titles because descriptions are noisy ("looking for a senior" in
# the company blurb doesn't mean the role is senior).
_INTERN_POSITIVE = {
    "intern", "interns", "internship", "internships", "co-op", "coop",
    "student", "students", "new-grad", "new grad", "graduate", "graduates",
    "trainee", "apprentice", "apprenticeship", "working student",
}
_JUNIOR_POSITIVE = {
    "junior", "jr", "jr.", "entry", "entry-level", "entry level",
    "associate", "early career", "new grad", "new-grad", "graduate",
}
_MID_POSITIVE = {"mid", "mid-level", "mid level", "intermediate"}
_SENIOR_POSITIVE = {"senior", "sr", "sr.", "snr"}
_LEAD_POSITIVE = {
    "lead", "leads", "staff", "principal", "architect", "head", "chief",
    "director", "vp", "vice president", "cto", "manager",
}

# Words that DISQUALIFY a title for each bucket.
_INTERN_NEGATIVE = _SENIOR_POSITIVE | _LEAD_POSITIVE | {"experienced"}
_JUNIOR_NEGATIVE = _SENIOR_POSITIVE | _LEAD_POSITIVE | {"experienced"}
_SENIOR_NEGATIVE = _INTERN_POSITIVE | _JUNIOR_POSITIVE | {"entry-level"}
_LEAD_NEGATIVE = _INTERN_POSITIVE | _JUNIOR_POSITIVE | {"entry-level"}


def _tokens(title: str) -> set[str]:
    t = (title or "").lower()
    words = _word_re.findall(t)
    return set(words)


def _has_any(toks: set[str], phrase_set: Iterable[str]) -> bool:
    # Exact multi-word phrases are checked against the raw (lowercased) title.
    for phrase in phrase_set:
        if " " in phrase or "-" in phrase:
            continue
        if phrase in toks:
            return True
    return False


def _phrase_in(title: str, phrase_set: Iterable[str]) -> bool:
    t = (title or "").lower()
    for phrase in phrase_set:
        if " " in phrase or "-" in phrase:
            if phrase in t:
                return True
    return False


def _normalize_seniority(s: str | None) -> str:
    if not s:
        return "any"
    s = s.strip().lower()
    if s in {"intern", "internship", "co-op"}:
        return "intern"
    if s in {"junior", "jr", "entry", "entry-level", "associate", "new-grad", "new grad"}:
        return "junior"
    if s in {"mid", "mid-level", "intermediate"}:
        return "mid"
    if s in {"senior", "sr"}:
        return "senior"
    if s in {"lead", "staff", "principal", "manager", "head", "director"}:
        return "lead"
    return "any"


def title_matches_seniority(title: str, seniority: str | None) -> bool:
    """Return True if the title plausibly matches the requested seniority.

    ``any`` / unknown seniority always returns True (no filter). For explicit
    levels we apply a two-part test: the title must NOT contain disqualifying
    tokens for the level, and for the stricter levels (intern, senior+) we
    also require a positive signal so we don't keep every untyped "Engineer".
    """
    bucket = _normalize_seniority(seniority)
    if bucket == "any":
        return True

    toks = _tokens(title)

    if bucket == "intern":
        if _has_any(toks, _INTERN_NEGATIVE):
            return False
        # Intern is the strictest — positive token required.
        return _has_any(toks, _INTERN_POSITIVE) or _phrase_in(title, _INTERN_POSITIVE)

    if bucket == "junior":
        if _has_any(toks, _JUNIOR_NEGATIVE):
            return False
        # Junior allows untyped titles (e.g. "Software Engineer" without seniority)
        # because many boards list juniors without labeling them.
        return True

    if bucket == "mid":
        # Mid is permissive: exclude only explicit lead/principal roles.
        if _has_any(toks, _LEAD_POSITIVE) or _phrase_in(title, _LEAD_POSITIVE):
            return False
        return True

    if bucket == "senior":
        if _has_any(toks, _SENIOR_NEGATIVE):
            return False
        # Prefer an explicit senior marker, but accept roles with
        # lead/staff/principal (those are senior-adjacent).
        return (
            _has_any(toks, _SENIOR_POSITIVE)
            or _has_any(toks, _LEAD_POSITIVE)
            or _phrase_in(title, _SENIOR_POSITIVE)
            or _phrase_in(title, _LEAD_POSITIVE)
        )

    if bucket == "lead":
        if _has_any(toks, _LEAD_NEGATIVE):
            return False
        return _has_any(toks, _LEAD_POSITIVE) or _phrase_in(title, _LEAD_POSITIVE)

    return True
