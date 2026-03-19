from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy import text

from app.db.base import Base


async def init_models(engine: AsyncEngine) -> None:
    async with engine.begin() as conn:
        # Optional: ensure Neon uses the right schema; adjust if needed
        await conn.execute(text("CREATE SCHEMA IF NOT EXISTS public"))
        await conn.run_sync(Base.metadata.create_all)
