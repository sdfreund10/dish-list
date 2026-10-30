import random

from fastapi.testclient import TestClient
from sqlalchemy import delete

from app.db import SessionLocal
from app.main import app
from app.models import Recipe
from app.services.feed import distinctive_categories, order_feed

client = TestClient(app)

SOURCE_PREFIX = "feed-test-"


def _unsaved_recipe(recipe_id: int, categories: list[str]) -> Recipe:
    return Recipe(
        id=recipe_id,
        source_id=f"order-{recipe_id}",
        name=f"Recipe {recipe_id}",
        url=f"https://example.com/{recipe_id}",
        categories=categories,
        source_data={"id": f"order-{recipe_id}"},
    )


def test_distinctive_categories_intersects_allowlist() -> None:
    assert distinctive_categories(["Dinner", "Seafood", "Kid-Friendly"]) == frozenset(
        {"Seafood"}
    )
    assert distinctive_categories(["Main Course", "Lunch"]) == frozenset()
    assert distinctive_categories(None) == frozenset()
    assert distinctive_categories([]) == frozenset()


def test_order_feed_avoids_recent_distinctive_category_when_alternative_exists() -> (
    None
):
    recipes = [
        _unsaved_recipe(1, ["Seafood", "Dinner"]),
        _unsaved_recipe(2, ["Seafood", "Lunch"]),
        _unsaved_recipe(3, ["Pastas", "Dinner"]),
        _unsaved_recipe(4, ["Poultry", "Dinner"]),
        _unsaved_recipe(5, ["Curry", "Dinner"]),
        _unsaved_recipe(6, ["Salad", "Lunch"]),
    ]

    ordered = order_feed(recipes, rng=random.Random(0))

    # With two Seafood recipes and four alternatives, a correct ordering picks
    # a non-Seafood recipe immediately after the first Seafood.
    seafood_indexes = [
        index
        for index, recipe in enumerate(ordered)
        if "Seafood" in distinctive_categories(recipe.categories)
    ]
    assert len(seafood_indexes) == 2
    first_seafood = seafood_indexes[0]
    assert first_seafood < len(ordered) - 1
    assert "Seafood" not in distinctive_categories(
        ordered[first_seafood + 1].categories
    )

    for index, recipe in enumerate(ordered):
        recent: set[str] = set()
        for previous in ordered[max(0, index - 5) : index]:
            recent |= distinctive_categories(previous.categories)
        if distinctive_categories(recipe.categories).isdisjoint(recent):
            continue
        # A collision is only allowed when every remaining recipe also collides.
        assert all(
            not distinctive_categories(candidate.categories).isdisjoint(recent)
            for candidate in ordered[index:]
        )


def _clear_recipes() -> None:
    db = SessionLocal()
    try:
        db.execute(delete(Recipe))
        db.commit()
    finally:
        db.close()


def _seed_feed_recipes(count: int) -> list[Recipe]:
    category_cycle = [
        ["Seafood", "Dinner"],
        ["Pastas", "Dinner"],
        ["Poultry", "Lunch"],
        ["Curry", "Dinner"],
        ["Salad", "Lunch"],
        ["Soup", "Dinner"],
        ["Tacos", "Dinner"],
        ["Main Course", "Dinner"],
    ]
    db = SessionLocal()
    try:
        recipes: list[Recipe] = []
        for index in range(count):
            source_id = f"{SOURCE_PREFIX}{index}"
            categories = category_cycle[index % len(category_cycle)]
            recipe = Recipe(
                source_id=source_id,
                name=f"Feed Test Recipe {index}",
                url=f"https://example.com/recipes/{source_id}",
                description=f"Description {index}",
                image=f"https://example.com/images/{source_id}.jpg",
                total_min=20 + index,
                categories=categories,
                keywords=["Easy", f"Tag{index}"],
                source_data={"id": source_id, "name": f"Feed Test Recipe {index}"},
            )
            db.add(recipe)
            recipes.append(recipe)
        db.commit()
        for recipe in recipes:
            db.refresh(recipe)
        return list(recipes)
    finally:
        db.close()


def test_feed_traversal_returns_each_recipe_once() -> None:
    _clear_recipes()
    try:
        seeded = _seed_feed_recipes(23)
        our_ids = {recipe.id for recipe in seeded}

        seen: list[int] = []
        exclude: list[int] = []
        while True:
            params: dict[str, str | int] = {"limit": 7}
            if exclude:
                params["exclude_ids"] = ",".join(
                    str(recipe_id) for recipe_id in exclude
                )
            response = client.get("/feed", params=params)
            assert response.status_code == 200
            body = response.json()
            page_ids = [item["id"] for item in body["items"]]

            if not page_ids:
                assert body["remaining"] == 0
                break

            assert len(page_ids) == len(set(page_ids))
            assert set(page_ids).isdisjoint(seen)
            assert set(page_ids) <= our_ids
            seen.extend(page_ids)
            exclude.extend(page_ids)
            assert body["remaining"] == len(our_ids) - len(seen)

        assert sorted(seen) == sorted(our_ids)
    finally:
        _clear_recipes()


def test_feed_item_includes_card_fields() -> None:
    _clear_recipes()
    try:
        seeded = _seed_feed_recipes(1)
        recipe = seeded[0]

        response = client.get("/feed", params={"limit": 1})
        assert response.status_code == 200
        body = response.json()
        assert body["remaining"] == 0
        assert len(body["items"]) == 1
        item = body["items"][0]
        assert item == {
            "id": recipe.id,
            "name": recipe.name,
            "description": recipe.description,
            "image": recipe.image,
            "total_min": recipe.total_min,
            "categories": recipe.categories,
            "keywords": recipe.keywords,
        }
    finally:
        _clear_recipes()


def test_feed_rejects_limit_above_max() -> None:
    response = client.get("/feed", params={"limit": 51})
    assert response.status_code == 422


def test_feed_rejects_malformed_exclude_ids() -> None:
    response = client.get("/feed", params={"exclude_ids": "1,nope"})
    assert response.status_code == 422
