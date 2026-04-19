"""Thin wrapper around Clerk's Backend API for admin operations."""

import os
from typing import Optional

import httpx
from fastapi import HTTPException

CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")
CLERK_API_BASE = "https://api.clerk.com/v1"


def _require_secret() -> str:
    if not CLERK_SECRET_KEY:
        raise HTTPException(
            status_code=500,
            detail="CLERK_SECRET_KEY is not set on the backend.",
        )
    return CLERK_SECRET_KEY


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {_require_secret()}",
        "Content-Type": "application/json",
    }


async def fetch_clerk_user(user_id: str) -> dict:
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(f"{CLERK_API_BASE}/users/{user_id}", headers=_headers())
        if r.status_code == 404:
            raise HTTPException(status_code=404, detail="Clerk user not found")
        r.raise_for_status()
        return r.json()


async def list_clerk_users(
    *,
    limit: int = 50,
    offset: int = 0,
    query: Optional[str] = None,
) -> list[dict]:
    params: dict = {
        "limit": min(max(limit, 1), 100),
        "offset": max(offset, 0),
        "order_by": "-last_sign_in_at",
    }
    if query:
        params["query"] = query

    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{CLERK_API_BASE}/users", headers=_headers(), params=params
        )
        r.raise_for_status()
        return r.json()


async def count_clerk_users(query: Optional[str] = None) -> int:
    params: dict = {}
    if query:
        params["query"] = query
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(
            f"{CLERK_API_BASE}/users/count", headers=_headers(), params=params
        )
        r.raise_for_status()
        data = r.json()
        return int(data.get("total_count", 0))
