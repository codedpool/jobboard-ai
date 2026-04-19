"""Per-user search quota logic."""

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user_status import (
    FREE_SEARCH_QUOTA,
    PLAN_FREE,
    PLAN_TRIAL,
    PLAN_UNLIMITED,
    TRIAL_SEARCH_QUOTA,
    UserStatus,
)

PAYMENT_FORM_URL = "https://forms.gle/8zy2rTX2QAJPtheY6"


def _utcnow():
    return datetime.now(timezone.utc)


@dataclass
class QuotaDecision:
    allowed: bool
    plan: str
    searches_used: int
    searches_limit: Optional[int]  # None = unlimited
    plan_expires_at: Optional[datetime]
    reason: Optional[str] = None  # "quota_exceeded" when denied

    @property
    def remaining(self) -> Optional[int]:
        if self.searches_limit is None:
            return None
        return max(0, self.searches_limit - self.searches_used)


def _as_aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _effective_plan(status: UserStatus, now: datetime) -> str:
    """Return the active plan, expiring time-bound plans as needed."""
    exp = _as_aware(status.plan_expires_at)
    if status.plan in (PLAN_TRIAL, PLAN_UNLIMITED) and exp and now >= exp:
        return PLAN_FREE
    return status.plan or PLAN_FREE


async def _ensure_status(db: AsyncSession, user_id: str, email: Optional[str]) -> UserStatus:
    status = await db.get(UserStatus, user_id)
    if status is None:
        now = _utcnow()
        status = UserStatus(
            clerk_user_id=user_id,
            email_cached=email,
            first_seen_at=now,
            last_seen_at=now,
        )
        db.add(status)
        await db.flush()
    return status


async def peek_quota(
    db: AsyncSession,
    *,
    user_id: str,
    email: Optional[str] = None,
) -> QuotaDecision:
    """Report current quota without consuming."""
    status = await _ensure_status(db, user_id, email)
    now = _utcnow()
    plan = _effective_plan(status, now)

    if plan == PLAN_UNLIMITED:
        return QuotaDecision(
            allowed=True,
            plan=PLAN_UNLIMITED,
            searches_used=status.plan_searches_used,
            searches_limit=None,
            plan_expires_at=_as_aware(status.plan_expires_at),
        )

    if plan == PLAN_TRIAL:
        used = status.plan_searches_used
        allowed = used < TRIAL_SEARCH_QUOTA
        return QuotaDecision(
            allowed=allowed,
            plan=PLAN_TRIAL,
            searches_used=used,
            searches_limit=TRIAL_SEARCH_QUOTA,
            plan_expires_at=_as_aware(status.plan_expires_at),
            reason=None if allowed else "quota_exceeded",
        )

    # Free plan
    used = status.free_searches_used
    allowed = used < FREE_SEARCH_QUOTA
    return QuotaDecision(
        allowed=allowed,
        plan=PLAN_FREE,
        searches_used=used,
        searches_limit=FREE_SEARCH_QUOTA,
        plan_expires_at=None,
        reason=None if allowed else "quota_exceeded",
    )


async def consume_search(
    db: AsyncSession,
    *,
    user_id: str,
    email: Optional[str] = None,
) -> QuotaDecision:
    """Check quota; if allowed, increment and return the post-consume state."""
    status = await _ensure_status(db, user_id, email)
    now = _utcnow()
    plan = _effective_plan(status, now)

    if plan == PLAN_UNLIMITED:
        status.plan_searches_used = (status.plan_searches_used or 0) + 1
        await db.flush()
        return QuotaDecision(
            allowed=True,
            plan=PLAN_UNLIMITED,
            searches_used=status.plan_searches_used,
            searches_limit=None,
            plan_expires_at=_as_aware(status.plan_expires_at),
        )

    if plan == PLAN_TRIAL:
        used = status.plan_searches_used or 0
        if used >= TRIAL_SEARCH_QUOTA:
            return QuotaDecision(
                allowed=False,
                plan=PLAN_TRIAL,
                searches_used=used,
                searches_limit=TRIAL_SEARCH_QUOTA,
                plan_expires_at=_as_aware(status.plan_expires_at),
                reason="quota_exceeded",
            )
        status.plan_searches_used = used + 1
        await db.flush()
        return QuotaDecision(
            allowed=True,
            plan=PLAN_TRIAL,
            searches_used=status.plan_searches_used,
            searches_limit=TRIAL_SEARCH_QUOTA,
            plan_expires_at=_as_aware(status.plan_expires_at),
        )

    # Free plan (or expired plan reverting to free)
    used = status.free_searches_used or 0
    if used >= FREE_SEARCH_QUOTA:
        return QuotaDecision(
            allowed=False,
            plan=PLAN_FREE,
            searches_used=used,
            searches_limit=FREE_SEARCH_QUOTA,
            plan_expires_at=None,
            reason="quota_exceeded",
        )
    status.free_searches_used = used + 1
    await db.flush()
    return QuotaDecision(
        allowed=True,
        plan=PLAN_FREE,
        searches_used=status.free_searches_used,
        searches_limit=FREE_SEARCH_QUOTA,
        plan_expires_at=None,
    )
