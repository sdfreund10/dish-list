from sqlalchemy import delete

from app.db import SessionLocal
from app.models import Recipe


def test_recipe_round_trips_optional_fields_and_source_data() -> None:
    source_data = {
        "id": "test-source-1",
        "name": "Test Sheet-Pan Dinner",
        "url": "https://example.com/recipes/test-source-1",
        "author": None,
        "description": None,
        "image": None,
        "yield": ["4 servings", "12 fritters"],
        "prep_min": None,
        "cook_min": None,
        "total_min": 30,
        "rating": None,
        "rating_count": None,
        "keywords": None,
        "categories": ["Dinner"],
        "cooking_method": None,
        "ingredients": ["1 onion", "2 eggs"],
        "steps": ["Chop the onion.", None, "Cook until done."],
        "nutrition": {},
    }

    db = SessionLocal()
    try:
        recipe = Recipe(
            source_id=source_data["id"],
            name=source_data["name"],
            url=source_data["url"],
            author=source_data["author"],
            description=source_data["description"],
            image=source_data["image"],
            recipe_yield=source_data["yield"],
            prep_min=source_data["prep_min"],
            cook_min=source_data["cook_min"],
            total_min=source_data["total_min"],
            rating=source_data["rating"],
            rating_count=source_data["rating_count"],
            keywords=source_data["keywords"],
            categories=source_data["categories"],
            cooking_method=source_data["cooking_method"],
            ingredients=source_data["ingredients"],
            steps=source_data["steps"],
            nutrition=source_data["nutrition"],
            source_data=source_data,
        )
        db.add(recipe)
        db.commit()
        db.refresh(recipe)

        assert isinstance(recipe.id, int)
        assert recipe.id > 0
        assert recipe.source_id == "test-source-1"
        assert recipe.recipe_yield == ["4 servings", "12 fritters"]
        assert recipe.prep_min is None
        assert recipe.cooking_method is None
        assert recipe.keywords is None
        assert recipe.steps == ["Chop the onion.", None, "Cook until done."]
        assert recipe.source_data == source_data

        reloaded = db.get(Recipe, recipe.id)
        assert reloaded is not None
        assert reloaded.source_data == source_data
        assert reloaded.recipe_yield == ["4 servings", "12 fritters"]
    finally:
        db.execute(delete(Recipe).where(Recipe.source_id == "test-source-1"))
        db.commit()
        db.close()
