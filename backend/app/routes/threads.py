import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi_clerk_auth import HTTPAuthorizationCredentials
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_clerk_auth
from app.db.session import get_db
from app.models.chat import ChatThread, ChatMessage

router = APIRouter(prefix="/api", tags=["threads"])


# ─── Schemas ────────────────────────────────────────────────────────────────

class CreateThreadRequest(BaseModel):
    title: Optional[str] = None


class ThreadResponse(BaseModel):
    id: str
    user_id: str
    title: Optional[str]
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class CreateMessageRequest(BaseModel):
    role: str   # "user" | "assistant"
    content: str


class MessageResponse(BaseModel):
    id: str
    thread_id: str
    role: str
    content: str
    created_at: str

    class Config:
        from_attributes = True


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _thread_to_resp(t: ChatThread) -> ThreadResponse:
    return ThreadResponse(
        id=str(t.id),
        user_id=str(t.user_id),
        title=t.title,
        created_at=t.created_at.isoformat() if t.created_at else "",
        updated_at=t.updated_at.isoformat() if t.updated_at else "",
    )


def _message_to_resp(m: ChatMessage) -> MessageResponse:
    return MessageResponse(
        id=str(m.id),
        thread_id=str(m.thread_id),
        role=m.role,
        content=m.content,
        created_at=m.created_at.isoformat() if m.created_at else "",
    )


# ─── Thread CRUD ─────────────────────────────────────────────────────────────

@router.get("/threads", response_model=List[ThreadResponse])
async def list_threads(
    credentials: HTTPAuthorizationCredentials = Depends(get_clerk_auth),
    db: AsyncSession = Depends(get_db),
):
    user_id = credentials.decoded.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    result = await db.execute(
        select(ChatThread)
        .where(ChatThread.user_id == user_id)
        .order_by(ChatThread.updated_at.desc())
    )
    threads = result.scalars().all()
    return [_thread_to_resp(t) for t in threads]


@router.post("/threads", response_model=ThreadResponse, status_code=201)
async def create_thread(
    payload: CreateThreadRequest,
    credentials: HTTPAuthorizationCredentials = Depends(get_clerk_auth),
    db: AsyncSession = Depends(get_db),
):
    user_id = credentials.decoded.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    thread = ChatThread(
        id=uuid.uuid4(),
        user_id=user_id,
        title=payload.title,
    )
    db.add(thread)
    await db.commit()
    await db.refresh(thread)
    return _thread_to_resp(thread)


@router.delete("/threads/{thread_id}", status_code=204)
async def delete_thread(
    thread_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(get_clerk_auth),
    db: AsyncSession = Depends(get_db),
):
    user_id = credentials.decoded.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    thread = await db.get(ChatThread, uuid.UUID(thread_id))
    if not thread or thread.user_id != user_id:
        raise HTTPException(status_code=404, detail="Thread not found")

    await db.delete(thread)
    await db.commit()
    return None


# ─── Message CRUD ─────────────────────────────────────────────────────────────

@router.get("/threads/{thread_id}/messages", response_model=List[MessageResponse])
async def list_messages(
    thread_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(get_clerk_auth),
    db: AsyncSession = Depends(get_db),
):
    user_id = credentials.decoded.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Verify the thread belongs to this user
    thread = await db.get(ChatThread, uuid.UUID(thread_id))
    if not thread or thread.user_id != user_id:
        raise HTTPException(status_code=404, detail="Thread not found")

    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.thread_id == uuid.UUID(thread_id))
        .order_by(ChatMessage.created_at.asc())
    )
    messages = result.scalars().all()
    return [_message_to_resp(m) for m in messages]


@router.post(
    "/threads/{thread_id}/messages",
    response_model=MessageResponse,
    status_code=201,
)
async def create_message(
    thread_id: str,
    payload: CreateMessageRequest,
    credentials: HTTPAuthorizationCredentials = Depends(get_clerk_auth),
    db: AsyncSession = Depends(get_db),
):
    user_id = credentials.decoded.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Verify thread ownership
    thread = await db.get(ChatThread, uuid.UUID(thread_id))
    if not thread or thread.user_id != user_id:
        raise HTTPException(status_code=404, detail="Thread not found")

    if payload.role not in ("user", "assistant"):
        raise HTTPException(status_code=400, detail="role must be 'user' or 'assistant'")

    message = ChatMessage(
        id=uuid.uuid4(),
        thread_id=uuid.UUID(thread_id),
        role=payload.role,
        content=payload.content,
    )
    db.add(message)

    # Touch the thread's updated_at timestamp
    from sqlalchemy.sql import func as sqlfunc
    from sqlalchemy import update
    await db.execute(
        update(ChatThread)
        .where(ChatThread.id == uuid.UUID(thread_id))
        .values(updated_at=sqlfunc.now())
    )

    await db.commit()
    await db.refresh(message)
    return _message_to_resp(message)
