from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.groq_service import parse_job_query

router = APIRouter(prefix="/api", tags=["parse-query"])


class ParseQueryRequest(BaseModel):
    message: str


class ParseQueryResponse(BaseModel):
    parsed_role: str
    keywords: list[str]
    seniority: str
    location_preference: str
    summary: str


@router.post("/parse-query", response_model=ParseQueryResponse)
async def parse_query(payload: ParseQueryRequest):
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="message must not be empty")

    data = parse_job_query(payload.message)
    return data
