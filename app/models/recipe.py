from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Integer, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Recipe(Base):
    __tablename__ = "recipes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source_id: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    author: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image: Mapped[str | None] = mapped_column(Text, nullable=True)
    recipe_yield: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    prep_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    cook_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    rating_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    keywords: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    categories: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    cooking_method: Mapped[str | None] = mapped_column(Text, nullable=True)
    ingredients: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    steps: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    nutrition: Mapped[Any | None] = mapped_column(JSONB, nullable=True)
    source_data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
