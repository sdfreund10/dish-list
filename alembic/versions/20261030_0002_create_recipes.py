"""Create recipes table.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-30

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


JSONB = postgresql.JSONB(astext_type=sa.Text())


def upgrade() -> None:
    op.create_table(
        "recipes",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("source_id", sa.Text(), nullable=False),
        sa.Column("name", sa.Text(), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("author", sa.Text(), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("image", sa.Text(), nullable=True),
        sa.Column("recipe_yield", JSONB, nullable=True),
        sa.Column("prep_min", sa.Integer(), nullable=True),
        sa.Column("cook_min", sa.Integer(), nullable=True),
        sa.Column("total_min", sa.Integer(), nullable=True),
        sa.Column("rating", sa.Integer(), nullable=True),
        sa.Column("rating_count", sa.Integer(), nullable=True),
        sa.Column("keywords", JSONB, nullable=True),
        sa.Column("categories", JSONB, nullable=True),
        sa.Column("cooking_method", sa.Text(), nullable=True),
        sa.Column("ingredients", JSONB, nullable=True),
        sa.Column("steps", JSONB, nullable=True),
        sa.Column("nutrition", JSONB, nullable=True),
        sa.Column("source_data", JSONB, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("source_id"),
    )


def downgrade() -> None:
    op.drop_table("recipes")
