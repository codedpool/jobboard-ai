from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi_clerk_auth import HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_clerk_auth, require_admin
from app.db.session import get_db
from app.models.chat import ChatThread
from app.models.job_config import JobConfig
from app.models.user_status import (
    FREE_SEARCH_QUOTA,
    PLAN_FREE,
    PLAN_TRIAL,
    PLAN_UNLIMITED,
    TRIAL_DURATION_DAYS,
    TRIAL_SEARCH_QUOTA,
    UNLIMITED_DURATION_DAYS,
    UserStatus,
)
from app.services.clerk_api import count_clerk_users, list_clerk_users

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _utcnow():
    return datetime.now(timezone.utc)


# ─── Schemas ─────────────────────────────────────────────────────────────────

class AdminUser(BaseModel):
    id: str
    email: Optional[str] = None
    name: Optional[str] = None
    image_url: Optional[str] = None
    created_at: Optional[str] = None
    last_sign_in_at: Optional[str] = None
    role: Optional[str] = None

    is_restricted: bool = False
    restricted_at: Optional[str] = None
    restricted_reason: Optional[str] = None
    restricted_by: Optional[str] = None
    last_seen_at: Optional[str] = None

    thread_count: int = 0
    config_count: int = 0

    # Plan / quota
    plan: str = PLAN_FREE
    plan_started_at: Optional[str] = None
    plan_expires_at: Optional[str] = None
    searches_used: int = 0
    searches_limit: Optional[int] = FREE_SEARCH_QUOTA


class AdminUserList(BaseModel):
    users: List[AdminUser]
    total: int
    limit: int
    offset: int


class RestrictRequest(BaseModel):
    reason: Optional[str] = None


class GrantPlanRequest(BaseModel):
    plan: str  # "trial" | "unlimited" | "free"


class AdminMeResponse(BaseModel):
    is_admin: bool
    user_id: str


class AdminStats(BaseModel):
    total_users: int
    restricted_users: int
    active_last_7d: int


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _iso(dt) -> Optional[str]:
    if not dt:
        return None
    if isinstance(dt, (int, float)):
        try:
            return datetime.fromtimestamp(dt / 1000, tz=timezone.utc).isoformat()
        except Exception:
            return None
    try:
        return dt.isoformat()
    except Exception:
        return None


def _email_of(clerk_user: dict) -> Optional[str]:
    primary_id = clerk_user.get("primary_email_address_id")
    for e in clerk_user.get("email_addresses") or []:
        if e.get("id") == primary_id:
            return e.get("email_address")
    # fallback: first email
    emails = clerk_user.get("email_addresses") or []
    if emails:
        return emails[0].get("email_address")
    return None


def _name_of(clerk_user: dict) -> Optional[str]:
    fn = clerk_user.get("first_name") or ""
    ln = clerk_user.get("last_name") or ""
    full = f"{fn} {ln}".strip()
    return full or clerk_user.get("username") or None


def _effective_plan_view(status: Optional[UserStatus]) -> dict:
    """Return plan/quota info as they would appear right now (expiry-aware)."""
    if status is None:
        return {
            "plan": PLAN_FREE,
            "plan_started_at": None,
            "plan_expires_at": None,
            "searches_used": 0,
            "searches_limit": FREE_SEARCH_QUOTA,
        }

    now = datetime.now(timezone.utc)
    plan = status.plan or PLAN_FREE
    expires = status.plan_expires_at
    if expires and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)

    expired = plan in (PLAN_TRIAL, PLAN_UNLIMITED) and expires and now >= expires
    if expired:
        return {
            "plan": PLAN_FREE,
            "plan_started_at": None,
            "plan_expires_at": None,
            "searches_used": int(status.free_searches_used or 0),
            "searches_limit": FREE_SEARCH_QUOTA,
        }

    if plan == PLAN_UNLIMITED:
        return {
            "plan": PLAN_UNLIMITED,
            "plan_started_at": _iso(status.plan_started_at),
            "plan_expires_at": _iso(status.plan_expires_at),
            "searches_used": int(status.plan_searches_used or 0),
            "searches_limit": None,
        }
    if plan == PLAN_TRIAL:
        return {
            "plan": PLAN_TRIAL,
            "plan_started_at": _iso(status.plan_started_at),
            "plan_expires_at": _iso(status.plan_expires_at),
            "searches_used": int(status.plan_searches_used or 0),
            "searches_limit": TRIAL_SEARCH_QUOTA,
        }
    return {
        "plan": PLAN_FREE,
        "plan_started_at": None,
        "plan_expires_at": None,
        "searches_used": int(status.free_searches_used or 0),
        "searches_limit": FREE_SEARCH_QUOTA,
    }


def _admin_user_from(
    clerk_user: dict,
    status: Optional[UserStatus],
    *,
    thread_count: int = 0,
    config_count: int = 0,
) -> AdminUser:
    uid = clerk_user.get("id")
    meta = clerk_user.get("public_metadata") or {}
    plan_view = _effective_plan_view(status)
    return AdminUser(
        id=uid,
        email=_email_of(clerk_user),
        name=_name_of(clerk_user),
        image_url=clerk_user.get("image_url"),
        created_at=_iso(clerk_user.get("created_at")),
        last_sign_in_at=_iso(clerk_user.get("last_sign_in_at")),
        role=meta.get("role"),
        is_restricted=bool(status and status.is_restricted),
        restricted_at=_iso(status.restricted_at) if status else None,
        restricted_reason=status.restricted_reason if status else None,
        restricted_by=status.restricted_by if status else None,
        last_seen_at=_iso(status.last_seen_at) if status else None,
        thread_count=thread_count,
        config_count=config_count,
        **plan_view,
    )


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.get("/me", response_model=AdminMeResponse)
async def admin_me(
    credentials: HTTPAuthorizationCredentials = Depends(require_admin),
):
    decoded = credentials.decoded or {}
    return AdminMeResponse(is_admin=True, user_id=decoded.get("sub") or "")


@router.get("/stats", response_model=AdminStats)
async def admin_stats(
    _: HTTPAuthorizationCredentials = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    total = await count_clerk_users()

    restricted_q = await db.execute(
        select(func.count()).select_from(UserStatus).where(UserStatus.is_restricted.is_(True))
    )
    restricted = int(restricted_q.scalar() or 0)

    from datetime import timedelta
    cutoff = _utcnow() - timedelta(days=7)
    active_q = await db.execute(
        select(func.count())
        .select_from(UserStatus)
        .where(UserStatus.last_seen_at >= cutoff)
    )
    active = int(active_q.scalar() or 0)

    return AdminStats(
        total_users=total,
        restricted_users=restricted,
        active_last_7d=active,
    )


@router.get("/users", response_model=AdminUserList)
async def list_users(
    q: Optional[str] = Query(None, description="search by name or email"),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    _: HTTPAuthorizationCredentials = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    clerk_users = await list_clerk_users(limit=limit, offset=offset, query=q)
    total = await count_clerk_users(query=q)

    user_ids = [u.get("id") for u in clerk_users if u.get("id")]
    if not user_ids:
        return AdminUserList(users=[], total=total, limit=limit, offset=offset)

    # Batch load status + counts
    status_q = await db.execute(
        select(UserStatus).where(UserStatus.clerk_user_id.in_(user_ids))
    )
    status_by_id = {s.clerk_user_id: s for s in status_q.scalars().all()}

    thread_q = await db.execute(
        select(ChatThread.user_id, func.count(ChatThread.id))
        .where(ChatThread.user_id.in_(user_ids))
        .group_by(ChatThread.user_id)
    )
    thread_counts = {uid: int(cnt) for uid, cnt in thread_q.all()}

    config_q = await db.execute(
        select(JobConfig.user_id, func.count(JobConfig.id))
        .where(JobConfig.user_id.in_(user_ids))
        .group_by(JobConfig.user_id)
    )
    config_counts = {uid: int(cnt) for uid, cnt in config_q.all()}

    results: List[AdminUser] = []
    for u in clerk_users:
        uid = u.get("id")
        s = status_by_id.get(uid)
        results.append(
            _admin_user_from(
                u,
                s,
                thread_count=thread_counts.get(uid, 0),
                config_count=config_counts.get(uid, 0),
            )
        )

    return AdminUserList(users=results, total=total, limit=limit, offset=offset)


@router.post("/users/{user_id}/restrict", response_model=AdminUser)
async def restrict_user(
    user_id: str,
    payload: RestrictRequest,
    credentials: HTTPAuthorizationCredentials = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    admin_id = (credentials.decoded or {}).get("sub") or ""
    if user_id == admin_id:
        raise HTTPException(status_code=400, detail="You cannot restrict your own account.")

    # Make sure they exist in Clerk (also fetches fresh email)
    from app.services.clerk_api import fetch_clerk_user
    clerk_user = await fetch_clerk_user(user_id)

    status = await db.get(UserStatus, user_id)
    now = _utcnow()

    if status is None:
        status = UserStatus(
            clerk_user_id=user_id,
            email_cached=_email_of(clerk_user),
            first_seen_at=now,
            last_seen_at=now,
        )
        db.add(status)

    status.is_restricted = True
    status.restricted_at = now
    status.restricted_reason = (payload.reason or "").strip() or None
    status.restricted_by = admin_id
    await db.commit()
    await db.refresh(status)

    return _admin_user_from(clerk_user, status)


@router.post("/users/{user_id}/unrestrict", response_model=AdminUser)
async def unrestrict_user(
    user_id: str,
    _: HTTPAuthorizationCredentials = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.services.clerk_api import fetch_clerk_user
    clerk_user = await fetch_clerk_user(user_id)

    status = await db.get(UserStatus, user_id)
    if status is None:
        raise HTTPException(status_code=404, detail="User has no status record")

    status.is_restricted = False
    status.restricted_at = None
    status.restricted_reason = None
    status.restricted_by = None
    await db.commit()
    await db.refresh(status)

    return _admin_user_from(clerk_user, status)


@router.post("/users/{user_id}/plan", response_model=AdminUser)
async def grant_plan(
    user_id: str,
    payload: GrantPlanRequest,
    credentials: HTTPAuthorizationCredentials = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Grant a plan to a user.

    - ``trial``     → 25 searches, 7 days from now
    - ``unlimited`` → unlimited searches, 90 days from now
    - ``free``      → revoke to default plan (10 lifetime searches, carry counter)
    """
    admin_id = (credentials.decoded or {}).get("sub") or ""
    plan = (payload.plan or "").lower()
    if plan not in (PLAN_FREE, PLAN_TRIAL, PLAN_UNLIMITED):
        raise HTTPException(status_code=400, detail="Invalid plan")

    from app.services.clerk_api import fetch_clerk_user
    clerk_user = await fetch_clerk_user(user_id)

    status = await db.get(UserStatus, user_id)
    now = _utcnow()
    if status is None:
        status = UserStatus(
            clerk_user_id=user_id,
            email_cached=_email_of(clerk_user),
            first_seen_at=now,
            last_seen_at=now,
        )
        db.add(status)

    if plan == PLAN_TRIAL:
        status.plan = PLAN_TRIAL
        status.plan_started_at = now
        status.plan_expires_at = now + timedelta(days=TRIAL_DURATION_DAYS)
        status.plan_searches_used = 0
        status.plan_granted_by = admin_id
    elif plan == PLAN_UNLIMITED:
        status.plan = PLAN_UNLIMITED
        status.plan_started_at = now
        status.plan_expires_at = now + timedelta(days=UNLIMITED_DURATION_DAYS)
        status.plan_searches_used = 0
        status.plan_granted_by = admin_id
    else:  # revoke to free
        status.plan = PLAN_FREE
        status.plan_started_at = None
        status.plan_expires_at = None
        status.plan_searches_used = 0
        status.plan_granted_by = admin_id

    await db.commit()
    await db.refresh(status)
    return _admin_user_from(clerk_user, status)
