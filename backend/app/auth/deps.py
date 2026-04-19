import os
from datetime import datetime, timezone

from fastapi import Depends, HTTPException
from fastapi_clerk_auth import (
    ClerkConfig,
    ClerkHTTPBearer,
    HTTPAuthorizationCredentials,
)

from app.db.session import AsyncSessionLocal
from app.models.user_status import UserStatus
from app.services.clerk_api import fetch_clerk_user

FRONTEND_API = os.getenv("CLERK_FRONTEND_API")
if not FRONTEND_API:
    raise RuntimeError("CLERK_FRONTEND_API is not set")

clerk_config = ClerkConfig(
    jwks_url=f"https://{FRONTEND_API}/.well-known/jwks.json"
)

clerk_auth_guard = ClerkHTTPBearer(
    config=clerk_config,
    add_state=True,  # store decoded token on request.state
)


def _utcnow():
    return datetime.now(timezone.utc)


async def get_clerk_auth(
    credentials: HTTPAuthorizationCredentials = Depends(clerk_auth_guard),
):
    """Verify Clerk JWT, upsert user_status row, and reject restricted users."""
    decoded = credentials.decoded or {}
    user_id = decoded.get("sub")
    email = decoded.get("email") or decoded.get("primary_email_address")

    if user_id:
        async with AsyncSessionLocal() as db:
            status = await db.get(UserStatus, user_id)

            if status and status.is_restricted:
                raise HTTPException(
                    status_code=403,
                    detail="Your account has been restricted. Contact support.",
                )

            now = _utcnow()
            if status is None:
                db.add(
                    UserStatus(
                        clerk_user_id=user_id,
                        email_cached=email,
                        first_seen_at=now,
                        last_seen_at=now,
                    )
                )
            else:
                status.last_seen_at = now
                if email and status.email_cached != email:
                    status.email_cached = email

            await db.commit()

    return credentials


async def require_admin(
    credentials: HTTPAuthorizationCredentials = Depends(get_clerk_auth),
) -> HTTPAuthorizationCredentials:
    """Ensure the authenticated user has publicMetadata.role == 'admin' in Clerk."""
    decoded = credentials.decoded or {}
    user_id = decoded.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    # publicMetadata may be in the JWT if a custom template includes it,
    # otherwise we fetch from Clerk's backend API.
    claims_meta = (
        decoded.get("public_metadata")
        or decoded.get("publicMetadata")
        or decoded.get("metadata")
    )
    role = (claims_meta or {}).get("role") if isinstance(claims_meta, dict) else None

    if role != "admin":
        try:
            user = await fetch_clerk_user(user_id)
        except Exception as exc:  # pragma: no cover
            raise HTTPException(
                status_code=500,
                detail=f"Failed to verify admin role: {exc}",
            )
        role = (user.get("public_metadata") or {}).get("role")

    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    return credentials
