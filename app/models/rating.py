from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Integer,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Rating(Base):
    """One Like or Pass per session and recipe. The first accepted action wins."""

    __tablename__ = "ratings"
    __table_args__ = (
        UniqueConstraint("session_id", "recipe_id", name="uq_rating_session_recipe"),
        CheckConstraint("action IN ('like', 'pass')", name="ck_rating_action"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[UUID] = mapped_column(
        ForeignKey("swipe_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    recipe_id: Mapped[int] = mapped_column(
        ForeignKey("recipes.id", ondelete="CASCADE"),
        nullable=False,
    )
    action: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
