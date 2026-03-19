import os
from fastapi import Depends, Request
from fastapi_clerk_auth import ClerkConfig, ClerkHTTPBearer, HTTPAuthorizationCredentials

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

async def get_clerk_auth(
    credentials: HTTPAuthorizationCredentials = Depends(clerk_auth_guard),
):
    return credentials
