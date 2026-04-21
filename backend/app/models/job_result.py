from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.db.base import Base


class JobResult(Base):
    __tablename__ = "job_results"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    config_id = Column(
        UUID(as_uuid=True),
        ForeignKey("job_configs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title = Column(String, nullable=False)
    company = Column(String, nullable=True)
    url = Column(Text, nullable=False)
    source = Column(String, nullable=False)
    location = Column(String, nullable=True)
    description = Column(Text, nullable=True)
    score = Column(Integer, nullable=True)
    reason = Column(Text, nullable=True)

    # Per-dimension sub-scores from the LLM (0–100 each)
    skills_match = Column(Integer, nullable=True)
    seniority_match = Column(Integer, nullable=True)
    location_match = Column(Integer, nullable=True)

    # Richer metadata from JobSpy and other sources
    salary_min = Column(Integer, nullable=True)
    salary_max = Column(Integer, nullable=True)
    salary_currency = Column(String, nullable=True)
    date_posted = Column(DateTime(timezone=True), nullable=True)
    is_remote = Column(Boolean, nullable=True)
    job_type = Column(String, nullable=True)  # fulltime / parttime / contract / intern

    dedupe_key = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
