import asyncio
from app.db.session import AsyncSessionLocal
from app.models.chat import ChatThread
import uuid

async def main():
    async with AsyncSessionLocal() as session:
        thread = ChatThread(
            id=uuid.uuid4(),
            user_id="test_user",
            title="test title",
        )
        session.add(thread)
        await session.commit()
        await session.refresh(thread)
        
        # Now context manager exits:
        await session.commit()

asyncio.run(main())
