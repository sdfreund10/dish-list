"""Anonymous session ratings and unlock eligibility."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Rating, Recipe, SwipeSession
from app.schemas.session import SessionState

UNLOCK_RATING_COUNT = 10
UNLOCK_LIKE_COUNT = 7


class SessionNotFound(Exception):
    pass


class RecipeNotFound(Exception):
    pass


def is_eligible(rating_count: int, like_count: int) -> bool:
    return rating_count >= UNLOCK_RATING_COUNT or like_count >= UNLOCK_LIKE_COUNT


def create_session(db: Session) -> SwipeSession:
    swipe_session = SwipeSession(client_metadata={})
    db.add(swipe_session)
    db.commit()
    db.refresh(swipe_session)
    return swipe_session


def get_swipe_session(db: Session, session_id: UUID) -> SwipeSession:
    swipe_session = db.get(SwipeSession, session_id)
    if swipe_session is None:
        raise SessionNotFound
    return swipe_session


def session_state(db: Session, session_id: UUID) -> SessionState:
    get_swipe_session(db, session_id)
    return _state_from_ratings(_ratings_for(db, session_id))


def record_rating(
    db: Session,
    session_id: UUID,
    recipe_id: int,
    action: str,
) -> tuple[str, SessionState]:
    get_swipe_session(db, session_id)
    if db.get(Recipe, recipe_id) is None:
        raise RecipeNotFound

    existing = db.scalar(
        select(Rating).where(
            Rating.session_id == session_id,
            Rating.recipe_id == recipe_id,
        )
    )
    if existing is not None:
        return existing.action, session_state(db, session_id)

    db.add(Rating(session_id=session_id, recipe_id=recipe_id, action=action))
    db.commit()
    return action, session_state(db, session_id)


def _ratings_for(db: Session, session_id: UUID) -> list[Rating]:
    return list(
        db.scalars(
            select(Rating)
            .where(Rating.session_id == session_id)
            .order_by(Rating.created_at, Rating.id)
        ).all()
    )


def _state_from_ratings(ratings: list[Rating]) -> SessionState:
    liked_recipe_ids = [
        rating.recipe_id for rating in ratings if rating.action == "like"
    ]
    rating_count = len(ratings)
    like_count = len(liked_recipe_ids)
    return SessionState(
        rating_count=rating_count,
        like_count=like_count,
        liked_recipe_ids=liked_recipe_ids,
        eligible=is_eligible(rating_count, like_count),
    )
