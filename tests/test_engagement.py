from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.db import SessionLocal
from app.main import app
from app.models import Rating, Recipe, SwipeSession

client = TestClient(app)


def setup_function() -> None:
    _clear()


def teardown_function() -> None:
    _clear()


def _clear() -> None:
    db = SessionLocal()
    try:
        db.execute(delete(Rating))
        db.execute(delete(SwipeSession))
        db.execute(delete(Recipe).where(Recipe.source_id.like("plan-test-%")))
        db.commit()
    finally:
        db.close()


def _seed_recipes(count: int) -> list[Recipe]:
    db = SessionLocal()
    try:
        recipes: list[Recipe] = []
        for index in range(count):
            source_id = f"plan-test-{index}"
            recipe = Recipe(
                source_id=source_id,
                name=f"Plan Recipe {index}",
                url=f"https://example.com/recipes/{source_id}",
                author=f"Author {index}",
                description=f"Description {index}",
                image=f"https://example.com/images/{source_id}.jpg",
                total_min=25 + index,
                rating=4,
                rating_count=80 + index,
                categories=["Dinner", "Soup"] if index == 0 else ["Dinner"],
                keywords=["Quick", f"Tag{index}"],
                source_data={"id": source_id},
            )
            db.add(recipe)
            recipes.append(recipe)
        db.commit()
        for recipe in recipes:
            db.refresh(recipe)
        return recipes
    finally:
        db.close()


def _create_session() -> str:
    response = client.post("/sessions")
    assert response.status_code == 200
    body = response.json()
    assert body["state"]["eligible"] is False
    return body["id"]


def _rate(session_id: str, recipe_id: int, action: str = "like") -> dict:
    response = client.post(
        f"/sessions/{session_id}/ratings",
        json={"recipe_id": recipe_id, "action": action},
    )
    assert response.status_code == 200
    return response.json()


def test_unknown_session_is_not_found() -> None:
    missing = uuid4()
    assert client.get(f"/sessions/{missing}").status_code == 404
    assert (
        client.post(
            f"/sessions/{missing}/ratings",
            json={"recipe_id": 1, "action": "like"},
        ).status_code
        == 404
    )


def test_duplicate_rating_does_not_inflate_counts() -> None:
    recipes = _seed_recipes(1)
    session_id = _create_session()

    first = _rate(session_id, recipes[0].id, "like")
    second = _rate(session_id, recipes[0].id, "pass")

    assert first["session"]["rating_count"] == 1
    assert first["session"]["like_count"] == 1
    assert second["action"] == "like"
    assert second["session"]["rating_count"] == 1
    assert second["session"]["like_count"] == 1


def test_six_likes_and_nine_ratings_stay_locked() -> None:
    recipes = _seed_recipes(9)
    session_id = _create_session()

    for recipe in recipes[:6]:
        body = _rate(session_id, recipe.id, "like")
    for recipe in recipes[6:]:
        body = _rate(session_id, recipe.id, "pass")

    assert body["session"]["rating_count"] == 9
    assert body["session"]["like_count"] == 6
    assert body["session"]["eligible"] is False


def test_seven_likes_unlock() -> None:
    recipes = _seed_recipes(9)
    session_id = _create_session()
    liked = recipes[:7]
    passed = recipes[7:]

    for recipe in liked[:6]:
        _rate(session_id, recipe.id, "like")
    unlocked = _rate(session_id, liked[6].id, "like")
    for recipe in passed:
        _rate(session_id, recipe.id, "pass")

    assert unlocked["session"]["eligible"] is True
    assert unlocked["session"]["like_count"] == 7
    state = client.get(f"/sessions/{session_id}")
    assert state.status_code == 200
    assert state.json()["eligible"] is True


def test_ten_ratings_unlock() -> None:
    recipes = _seed_recipes(12)
    session_id = _create_session()

    for recipe in recipes[:2]:
        _rate(session_id, recipe.id, "like")
    for recipe in recipes[2:9]:
        _rate(session_id, recipe.id, "pass")
    crossing = _rate(session_id, recipes[9].id, "pass")

    assert crossing["session"]["rating_count"] == 10
    assert crossing["session"]["like_count"] == 2
    assert crossing["session"]["eligible"] is True
