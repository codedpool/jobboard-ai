from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy import text

from app.db.base import Base


# Forward-only column additions. Safe to run on every startup — Postgres's
# "ADD COLUMN IF NOT EXISTS" is idempotent.
_COLUMN_PATCHES: list[str] = [
    "ALTER TABLE user_status ADD COLUMN IF NOT EXISTS plan VARCHAR NOT NULL DEFAULT 'free'",
    "ALTER TABLE user_status ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMPTZ",
    "ALTER TABLE user_status ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ",
    "ALTER TABLE user_status ADD COLUMN IF NOT EXISTS plan_granted_by VARCHAR",
    "ALTER TABLE user_status ADD COLUMN IF NOT EXISTS plan_searches_used INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE user_status ADD COLUMN IF NOT EXISTS free_searches_used INTEGER NOT NULL DEFAULT 0",
]


async def init_models(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS public"))
        await conn.run_sync(Base.metadata.create_all)
        for stmt in _COLUMN_PATCHES:
            await conn.execute(text(stmt))
