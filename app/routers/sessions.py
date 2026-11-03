from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.session import (
    RatingRequest,
    RatingResult,
    SessionCreated,
    SessionState,
)
from app.services.engagement import (
    RecipeNotFound,
    SessionNotFound,
    create_session,
    record_rating,
    session_state,
)

router = APIRouter()


def _missing_session(error: SessionNotFound) -> None:
    raise HTTPException(status_code=404, detail="session_not_found") from error


@router.post("/sessions", response_model=SessionCreated)
def post_session(db: Annotated[Session, Depends(get_db)]) -> SessionCreated:
    swipe_session = create_session(db)
    return SessionCreated(
        id=swipe_session.id,
        state=SessionState(
            rating_count=0,
            like_count=0,
            liked_recipe_ids=[],
            eligible=False,
        ),
    )


@router.get("/sessions/{session_id}", response_model=SessionState)
def get_session(
    session_id: UUID,
    db: Annotated[Session, Depends(get_db)],
) -> SessionState:
    try:
        return session_state(db, session_id)
    except SessionNotFound as error:
        _missing_session(error)


@router.post("/sessions/{session_id}/ratings", response_model=RatingResult)
def post_rating(
    session_id: UUID,
    body: RatingRequest,
    db: Annotated[Session, Depends(get_db)],
) -> RatingResult:
    """Persist a Like or Pass.

    The first action for a session and recipe is stored. A retry returns that
    rating and does not increment counts, including when the retry names a
    different action.
    """
    try:
        action, state = record_rating(db, session_id, body.recipe_id, body.action)
    except SessionNotFound as error:
        _missing_session(error)
    except RecipeNotFound as error:
        raise HTTPException(status_code=404, detail="recipe_not_found") from error
    return RatingResult(
        recipe_id=body.recipe_id,
        action=_stored_action(action),
        session=state,
    )


def _stored_action(action: str) -> Literal["like", "pass"]:
    if action == "like":
        return "like"
    if action == "pass":
        return "pass"
    raise HTTPException(status_code=500, detail="stored_rating_action_invalid")
