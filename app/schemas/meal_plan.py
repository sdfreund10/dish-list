from typing import Literal

from pydantic import BaseModel

from app.schemas.recipe import FeedItem


class PostedRating(BaseModel):
    recipe_id: int
    action: Literal["like", "pass"]


class MealPlanRequest(BaseModel):
    ratings: list[PostedRating]


class MealPlanRecipe(FeedItem):
    url: str
    author: str | None = None


class MealPlanResponse(BaseModel):
    status: Literal["generated", "insufficient_likes"]
    recipes: list[MealPlanRecipe]
    like_count: int
    rating_count: int
