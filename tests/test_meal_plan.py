from fastapi.testclient import TestClient
from sqlalchemy import delete, func, select

from app.db import SessionLocal
from app.main import app
from app.models import Recipe

client = TestClient(app)


def setup_function() -> None:
    _clear()


def teardown_function() -> None:
    _clear()


def _clear() -> None:
    db = SessionLocal()
    try:
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


def _posted(recipe_id: int, action: str = "like") -> dict:
    return {"recipe_id": recipe_id, "action": action}


def _generate(ratings: list[dict]):
    return client.post("/meal-plan", json={"ratings": ratings})


def _recipe_count() -> int:
    db = SessionLocal()
    try:
        return (
            db.scalar(
                select(func.count())
                .select_from(Recipe)
                .where(Recipe.source_id.like("plan-test-%"))
            )
            or 0
        )
    finally:
        db.close()


def test_fewer_than_three_likes_is_insufficient() -> None:
    recipes = _seed_recipes(5)
    ratings = [_posted(recipe.id, "like") for recipe in recipes[:2]]
    ratings.extend(_posted(recipe.id, "pass") for recipe in recipes[2:])

    insufficient = _generate(ratings)
    assert insufficient.status_code == 200
    assert insufficient.json() == {
        "status": "insufficient_likes",
        "recipes": [],
        "like_count": 2,
        "rating_count": 5,
    }
    assert _recipe_count() == 5


def test_three_likes_generate_three_distinct_likes() -> None:
    recipes = _seed_recipes(5)
    liked = recipes[:3]
    passed = recipes[3:]
    ratings = [_posted(recipe.id, "like") for recipe in liked]
    ratings.extend(_posted(recipe.id, "pass") for recipe in passed)

    generated = _generate(ratings)
    assert generated.status_code == 200
    body = generated.json()
    liked_ids = {recipe.id for recipe in liked}
    selected_ids = [recipe["id"] for recipe in body["recipes"]]
    assert body["status"] == "generated"
    assert body["like_count"] == 3
    assert body["rating_count"] == 5
    assert len(selected_ids) == 3
    assert len(set(selected_ids)) == 3
    assert set(selected_ids) == liked_ids
    assert set(selected_ids).isdisjoint({recipe.id for recipe in passed})
    assert body["recipes"][0]["url"].startswith("https://example.com/recipes/")
    assert body["recipes"][0]["name"].startswith("Plan Recipe")
    assert _recipe_count() == 5


def test_unknown_recipe_in_posted_ratings_is_not_found() -> None:
    recipes = _seed_recipes(7)
    ratings = [_posted(recipe.id, "like") for recipe in recipes]
    ratings.append(_posted(9_999_999, "pass"))

    missing = _generate(ratings)
    assert missing.status_code == 404
    assert missing.json()["detail"] == "recipe_not_found"
    assert _recipe_count() == 7


def test_duplicate_posted_recipe_keeps_first_action() -> None:
    recipes = _seed_recipes(7)
    ratings = [_posted(recipe.id, "like") for recipe in recipes]
    ratings.append(_posted(recipes[0].id, "pass"))

    generated = _generate(ratings)
    assert generated.status_code == 200
    body = generated.json()
    assert body["status"] == "generated"
    assert body["like_count"] == 7
    assert body["rating_count"] == 7
    assert _recipe_count() == 7
