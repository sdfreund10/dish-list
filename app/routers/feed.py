from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Recipe
from app.schemas.recipe import FeedItem, FeedResponse
from app.services.feed import build_feed_page

router = APIRouter()


def _parse_exclude_ids(exclude_ids: str | None) -> list[int]:
    if not exclude_ids:
        return []
    return [int(part) for part in exclude_ids.split(",") if part.strip()]


def _to_feed_item(recipe: Recipe) -> FeedItem:
    return FeedItem(
        id=recipe.id,
        name=recipe.name,
        description=recipe.description,
        image=recipe.image,
        total_min=recipe.total_min,
        categories=list(recipe.categories or []),
        keywords=list(recipe.keywords or []),
    )


@router.get("/feed", response_model=FeedResponse)
def get_feed(
    db: Annotated[Session, Depends(get_db)],
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    exclude_ids: Annotated[str | None, Query()] = None,
) -> FeedResponse:
    items, remaining = build_feed_page(
        db,
        limit=limit,
        exclude_ids=_parse_exclude_ids(exclude_ids),
    )
    return FeedResponse(
        items=[_to_feed_item(recipe) for recipe in items],
        remaining=remaining,
    )
