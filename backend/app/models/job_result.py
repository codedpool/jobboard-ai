from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
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
    dedupe_key = Column(String(255), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
