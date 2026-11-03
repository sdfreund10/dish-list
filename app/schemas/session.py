from typing import Literal
from uuid import UUID

from pydantic import BaseModel


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
