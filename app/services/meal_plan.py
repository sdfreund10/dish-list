"""Random meal selection from posted ratings."""

import random

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Recipe
from app.schemas.meal_plan import (
    MealPlanRecipe,
    MealPlanResponse,
    PostedRating,
)

MEAL_PLAN_SIZE = 3


class RecipeNotFound(Exception):
    pass


def generate_meal_plan(
    db: Session,
    ratings: list[PostedRating],
    rng: random.Random | None = None,
) -> MealPlanResponse:
    unique = _first_action_per_recipe(ratings)
    _require_known_recipes(db, [rating.recipe_id for rating in unique])

    liked_recipe_ids = [
        rating.recipe_id for rating in unique if rating.action == "like"
    ]
    rating_count = len(unique)
    like_count = len(liked_recipe_ids)

    liked = _liked_recipes(db, liked_recipe_ids)
    if len(liked) < MEAL_PLAN_SIZE:
        return MealPlanResponse(
            status="insufficient_likes",
            recipes=[],
            like_count=like_count,
            rating_count=rating_count,
        )

    chosen = (rng or random.Random()).sample(liked, MEAL_PLAN_SIZE)
    return MealPlanResponse(
        status="generated",
        recipes=[_plan_recipe(recipe) for recipe in chosen],
        like_count=like_count,
        rating_count=rating_count,
    )


def _first_action_per_recipe(ratings: list[PostedRating]) -> list[PostedRating]:
    seen: set[int] = set()
    unique: list[PostedRating] = []
    for rating in ratings:
        if rating.recipe_id in seen:
            continue
        seen.add(rating.recipe_id)
        unique.append(rating)
    return unique


def _require_known_recipes(db: Session, recipe_ids: list[int]) -> None:
    if not recipe_ids:
        return
    found = set(db.scalars(select(Recipe.id).where(Recipe.id.in_(recipe_ids))).all())
    if len(found) != len(set(recipe_ids)):
        raise RecipeNotFound


def _liked_recipes(db: Session, recipe_ids: list[int]) -> list[Recipe]:
    if not recipe_ids:
        return []
    recipes = db.scalars(select(Recipe).where(Recipe.id.in_(recipe_ids))).all()
    by_id = {recipe.id: recipe for recipe in recipes}
    return [by_id[recipe_id] for recipe_id in recipe_ids if recipe_id in by_id]


def _plan_recipe(recipe: Recipe) -> MealPlanRecipe:
    return MealPlanRecipe(
        id=recipe.id,
        name=recipe.name,
        description=recipe.description,
        image=recipe.image,
        total_min=recipe.total_min,
        rating=recipe.rating,
        rating_count=recipe.rating_count,
        categories=list(recipe.categories or []),
        keywords=list(recipe.keywords or []),
        url=recipe.url,
        author=recipe.author,
    )
