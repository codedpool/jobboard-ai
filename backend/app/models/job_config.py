from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID, ARRAY
from sqlalchemy.sql import func
import uuid

from app.db.base import Base


class JobConfig(Base):
    __tablename__ = "job_configs"

    id = Column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id = Column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    raw_query = Column(Text, nullable=False)
    parsed_role = Column(String, nullable=True)
    keywords = Column(ARRAY(String), nullable=True)
    seniority = Column(String, nullable=True)
    location_preference = Column(String, nullable=True)
    platforms = Column(ARRAY(String), nullable=True)
    interval_minutes = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
