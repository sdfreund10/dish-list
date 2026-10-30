import json
from pathlib import Path

from sqlalchemy import delete, select

from app.db import SessionLocal
from app.import_recipes import import_recipes, load_recipe_records
from app.models import Recipe


def _write_recipes(path: Path, records: list[dict]) -> None:
    path.write_text(json.dumps(records), encoding="utf-8")


def test_import_recipes_inserts_updates_skips_and_reports_failures(
    tmp_path: Path,
) -> None:
    source_ids = [
        "import-test-1",
        "import-test-2",
        "import-test-missing",
    ]
    first_pass = [
        {
            "id": "import-test-1",
            "name": "Chickpea Pasta",
            "url": "https://example.com/1",
            "author": "Ada",
            "description": None,
            "image": None,
            "yield": "4 servings",
            "prep_min": None,
            "cook_min": 20,
            "total_min": 20,
            "rating": 5,
            "rating_count": 10,
            "keywords": ["Pasta"],
            "categories": ["Dinner"],
            "cooking_method": None,
            "ingredients": ["pasta", "chickpeas"],
            "steps": ["Boil pasta."],
            "nutrition": {},
        },
        {
            "id": "import-test-2",
            "name": "Tomato Salad",
            "url": "https://example.com/2",
            "yield": ["2 servings", "4 sides"],
            "prep_min": None,
            "cook_min": None,
            "total_min": None,
            "ingredients": None,
            "steps": ["Toss tomatoes."],
            "nutrition": None,
        },
        {
            "name": "Missing id and url",
        },
    ]
    recipes_path = tmp_path / "recipes.json"
    _write_recipes(recipes_path, first_pass)

    db = SessionLocal()
    try:
        db.execute(delete(Recipe).where(Recipe.source_id.in_(source_ids)))
        db.commit()

        first_report = import_recipes(db, load_recipe_records(recipes_path))
        assert first_report.inserted == 2
        assert first_report.updated == 0
        assert first_report.skipped == 0
        assert first_report.failed == 1
        assert any("missing required fields" in item for item in first_report.failures)

        unchanged = import_recipes(db, load_recipe_records(recipes_path))
        assert unchanged.inserted == 0
        assert unchanged.updated == 0
        assert unchanged.skipped == 2
        assert unchanged.failed == 1

        updated_pass = [
            {
                **first_pass[0],
                "name": "Chickpea Pasta Updated",
                "description": "Weeknight dinner",
            },
            first_pass[1],
            first_pass[2],
        ]
        _write_recipes(recipes_path, updated_pass)
        second_report = import_recipes(db, load_recipe_records(recipes_path))
        assert second_report.inserted == 0
        assert second_report.updated == 1
        assert second_report.skipped == 1
        assert second_report.failed == 1

        recipes = {
            recipe.source_id: recipe
            for recipe in db.scalars(
                select(Recipe).where(Recipe.source_id.in_(source_ids[:2]))
            ).all()
        }
        assert recipes["import-test-1"].name == "Chickpea Pasta Updated"
        assert recipes["import-test-1"].description == "Weeknight dinner"
        assert recipes["import-test-1"].source_data["name"] == "Chickpea Pasta Updated"
        assert recipes["import-test-2"].recipe_yield == ["2 servings", "4 sides"]
        assert recipes["import-test-2"].prep_min is None
        assert recipes["import-test-2"].ingredients is None
    finally:
        db.execute(delete(Recipe).where(Recipe.source_id.in_(source_ids)))
        db.commit()
        db.close()
