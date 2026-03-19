import asyncio
from app.db.session import engine
from sqlalchemy import text

async def main():
    async with engine.connect() as conn:
        print("====== chat_threads ======")
        for row in await conn.execute(text("SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name='chat_threads';")): print(row)
        print("====== job_configs ======")
        for row in await conn.execute(text("SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name='job_configs';")): print(row)
        print("====== chat_messages ======")
        for row in await conn.execute(text("SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name='chat_messages';")): print(row)

asyncio.run(main())
