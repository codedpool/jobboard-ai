import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.deps import get_clerk_auth
from app.db.session import get_db
from app.models.job_config import JobConfig
from fastapi_clerk_auth import HTTPAuthorizationCredentials

router = APIRouter(prefix="/api", tags=["configs"])


class CreateConfigRequest(BaseModel):
    raw_query: str
    parsed_role: Optional[str] = None
    keywords: Optional[List[str]] = []
    seniority: Optional[str] = "any"
    location_preference: Optional[str] = ""
    platforms: Optional[List[str]] = []
    interval_minutes: Optional[int] = 60


class ConfigResponse(BaseModel):
    id: str
    user_id: str
    raw_query: str
    parsed_role: Optional[str]
    keywords: Optional[List[str]]
    seniority: Optional[str]
    location_preference: Optional[str]
    platforms: Optional[List[str]]
    interval_minutes: Optional[int]

    class Config:
        from_attributes = True


@router.post("/configs", response_model=ConfigResponse)
async def create_config(
    payload: CreateConfigRequest,
    credentials: HTTPAuthorizationCredentials = Depends(get_clerk_auth),
    db: AsyncSession = Depends(get_db),
):
    user_id = credentials.decoded.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: no sub claim")

    config = JobConfig(
        id=uuid.uuid4(),
        user_id=user_id,
        raw_query=payload.raw_query,
        parsed_role=payload.parsed_role,
        keywords=payload.keywords,
        seniority=payload.seniority,
        location_preference=payload.location_preference,
        platforms=payload.platforms,
        interval_minutes=payload.interval_minutes,
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)

    return ConfigResponse(
        id=str(config.id),
        user_id=str(config.user_id),
        raw_query=config.raw_query,
        parsed_role=config.parsed_role,
        keywords=config.keywords,
        seniority=config.seniority,
        location_preference=config.location_preference,
        platforms=config.platforms,
        interval_minutes=config.interval_minutes,
    )


@router.get("/configs", response_model=List[ConfigResponse])
async def list_configs(
    credentials: HTTPAuthorizationCredentials = Depends(get_clerk_auth),
    db: AsyncSession = Depends(get_db),
):
    user_id = credentials.decoded.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: no sub claim")

    result = await db.execute(
        select(JobConfig)
        .where(JobConfig.user_id == user_id)
        .order_by(JobConfig.created_at.desc())
    )
    configs = result.scalars().all()

    return [
        ConfigResponse(
            id=str(c.id),
            user_id=str(c.user_id),
            raw_query=c.raw_query,
            parsed_role=c.parsed_role,
            keywords=c.keywords,
            seniority=c.seniority,
            location_preference=c.location_preference,
            platforms=c.platforms,
            interval_minutes=c.interval_minutes,
        )
        for c in configs
    ]


@router.delete("/configs/{config_id}")
async def delete_config(
    config_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(get_clerk_auth),
    db: AsyncSession = Depends(get_db),
):
    user_id = credentials.decoded.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: no sub claim")

    result = await db.execute(
        select(JobConfig).where(
            JobConfig.id == config_id,
            JobConfig.user_id == user_id,
        )
    )
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(status_code=404, detail="Config not found")

    await db.delete(config)
    await db.commit()

    return {"message": "Config deleted successfully"}
