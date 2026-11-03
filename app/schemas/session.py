from typing import Literal
from uuid import UUID

from pydantic import BaseModel

from app.schemas.recipe import FeedItem


class SessionState(BaseModel):
    rating_count: int
    like_count: int
    liked_recipe_ids: list[int]
    eligible: bool


class SessionCreated(BaseModel):
    id: UUID
    state: SessionState


class RatingRequest(BaseModel):
    recipe_id: int
    action: Literal["like", "pass"]


class RatingResult(BaseModel):
    recipe_id: int
    action: Literal["like", "pass"]
    session: SessionState


class MealPlanRecipe(FeedItem):
    url: str
    author: str | None = None


class MealPlanResponse(BaseModel):
    status: Literal["generated", "insufficient_likes"]
    recipes: list[MealPlanRecipe]
    like_count: int
    rating_count: int
