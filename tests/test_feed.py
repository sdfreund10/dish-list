from dataclasses import dataclass

from fastapi.testclient import TestClient
from sqlalchemy import delete, select

from app.db import SessionLocal
from app.main import app
from app.models import Recipe
from app.services.feed import distinctive_categories, order_feed

client = TestClient(app)

SOURCE_PREFIX = "feed-test-"


@dataclass
class FakeRecipe:
    id: int
    categories: list[str] | None


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
    # Fixed shuffle order: Seafood, Seafood, Pastas, Poultry, Curry, Salad.
    # After first Seafood, skip the second Seafood while Pastas is available.
    recipes = [
        FakeRecipe(1, ["Seafood", "Dinner"]),
        FakeRecipe(2, ["Seafood", "Lunch"]),
        FakeRecipe(3, ["Pastas", "Dinner"]),
        FakeRecipe(4, ["Poultry", "Dinner"]),
        FakeRecipe(5, ["Curry", "Dinner"]),
        FakeRecipe(6, ["Salad", "Lunch"]),
    ]

    ordered = order_feed(recipes, rng=_FixedShuffle())

    assert [recipe.id for recipe in ordered] == [1, 3, 4, 5, 6, 2]
    assert ordered[0].categories == ["Seafood", "Dinner"]
    # Second pick skips the other Seafood (still in window) for Pastas.
    assert "Seafood" not in (ordered[1].categories or [])


class _FixedShuffle:
    """Deterministic stand-in for random.Random.shuffle — leave list as-is."""

    def shuffle(self, x: list[FakeRecipe]) -> None:
        return None


def _delete_feed_test_recipes() -> None:
    db = SessionLocal()
    try:
        db.execute(delete(Recipe).where(Recipe.source_id.startswith(SOURCE_PREFIX)))
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
    _delete_feed_test_recipes()
    try:
        seeded = _seed_feed_recipes(23)
        our_ids = {recipe.id for recipe in seeded}

        db = SessionLocal()
        try:
            all_ids = set(db.scalars(select(Recipe.id)).all())
        finally:
            db.close()
        foreign_ids = all_ids - our_ids

        seen: list[int] = []
        exclude = list(foreign_ids)
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
        _delete_feed_test_recipes()


def test_feed_item_includes_card_fields() -> None:
    _delete_feed_test_recipes()
    try:
        seeded = _seed_feed_recipes(1)
        recipe = seeded[0]

        db = SessionLocal()
        try:
            foreign = [
                recipe_id
                for recipe_id in db.scalars(select(Recipe.id)).all()
                if recipe_id != recipe.id
            ]
        finally:
            db.close()

        params: dict[str, str | int] = {"limit": 1}
        if foreign:
            params["exclude_ids"] = ",".join(str(recipe_id) for recipe_id in foreign)

        response = client.get("/feed", params=params)
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
        _delete_feed_test_recipes()


def test_feed_rejects_limit_above_max() -> None:
    response = client.get("/feed", params={"limit": 51})
    assert response.status_code == 422


def test_feed_rejects_malformed_exclude_ids() -> None:
    response = client.get("/feed", params={"exclude_ids": "1,nope"})
    assert response.status_code == 422
