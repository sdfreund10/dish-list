"""Idempotent import of recipes from recipes.json."""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import Recipe

DEFAULT_RECIPES_PATH = Path("data/recipes.json")
REQUIRED_FIELDS = ("id", "name", "url")


@dataclass
class ImportReport:
    inserted: int = 0
    updated: int = 0
    skipped: int = 0
    failed: int = 0
    failures: list[str] = field(default_factory=list)


def load_recipe_records(path: Path) -> list[dict[str, Any]]:
    payload = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(payload, list):
        raise ValueError(f"Expected a JSON array in {path}")
    return payload


def recipe_values_from_record(record: dict[str, Any]) -> dict[str, Any]:
    missing = [name for name in REQUIRED_FIELDS if not record.get(name)]
    if missing:
        raise ValueError(f"missing required fields: {', '.join(missing)}")

    return {
        "source_id": str(record["id"]),
        "name": record["name"],
        "url": record["url"],
        "author": record.get("author"),
        "description": record.get("description"),
        "image": record.get("image"),
        "recipe_yield": record.get("yield"),
        "prep_min": record.get("prep_min"),
        "cook_min": record.get("cook_min"),
        "total_min": record.get("total_min"),
        "rating": record.get("rating"),
        "rating_count": record.get("rating_count"),
        "keywords": record.get("keywords"),
        "categories": record.get("categories"),
        "cooking_method": record.get("cooking_method"),
        "ingredients": record.get("ingredients"),
        "steps": record.get("steps"),
        "nutrition": record.get("nutrition"),
        "source_data": record,
    }


def apply_recipe_values(recipe: Recipe, values: dict[str, Any]) -> None:
    for key, value in values.items():
        setattr(recipe, key, value)


def import_recipes(session: Session, records: list[dict[str, Any]]) -> ImportReport:
    report = ImportReport()
    existing_by_source_id = {
        recipe.source_id: recipe for recipe in session.scalars(select(Recipe)).all()
    }

    for index, record in enumerate(records):
        try:
            values = recipe_values_from_record(record)
        except ValueError as error:
            report.failed += 1
            record_id = record.get("id", f"index {index}")
            report.failures.append(f"record {record_id}: {error}")
            continue

        existing = existing_by_source_id.get(values["source_id"])
        if existing is None:
            recipe = Recipe(**values)
            session.add(recipe)
            existing_by_source_id[values["source_id"]] = recipe
            report.inserted += 1
            continue

        if existing.source_data == values["source_data"]:
            report.skipped += 1
            continue

        apply_recipe_values(existing, values)
        report.updated += 1

    session.commit()
    return report


def format_report(report: ImportReport) -> str:
    lines = [
        f"inserted={report.inserted}",
        f"updated={report.updated}",
        f"skipped={report.skipped}",
        f"failed={report.failed}",
    ]
    for failure in report.failures:
        lines.append(f"failure: {failure}")
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Import recipes from recipes.json")
    parser.add_argument(
        "path",
        nargs="?",
        type=Path,
        default=DEFAULT_RECIPES_PATH,
        help=f"Path to recipes JSON (default: {DEFAULT_RECIPES_PATH})",
    )
    args = parser.parse_args(argv)

    try:
        records = load_recipe_records(args.path)
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"failed to load {args.path}: {error}", file=sys.stderr)
        return 1

    session = SessionLocal()
    try:
        report = import_recipes(session, records)
    finally:
        session.close()

    print(format_report(report))
    return 1 if report.failed else 0


def cli() -> None:
    raise SystemExit(main())


if __name__ == "__main__":
    cli()
