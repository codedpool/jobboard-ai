from fastapi import APIRouter, Depends, Request
from fastapi_clerk_auth import HTTPAuthorizationCredentials

from app.auth.deps import get_clerk_auth

router = APIRouter(prefix="/api", tags=["me"])


@router.get("/me")
async def get_me(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(get_clerk_auth),
):
    decoded = credentials.decoded or {}
    # Clerk JWT: 'sub' is the user ID, 'email' usually lives in 'email' or 'primary_email_address'
    user_id = decoded.get("sub")
    email = decoded.get("email") or decoded.get("primary_email_address")

    return {
        "user_id": user_id,
        "email": email,
    }
