import random

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Recipe

DESCRIPTIVE_CATEGORIES: frozenset[str] = frozenset(
    {
        "Seafood",
        "Pastas",
        "Poultry",
        "Beans",
        "Vegetables",
        "Noodles",
        "Grains and Rice",
        "Stir-Fry",
        "Soup",
        "Curry",
        "Salad",
        "Stew",
        "Meatballs",
        "Tacos",
        "Grain Bowl",
        "Sausages",
        "Sandwiches",
        "Steaks and Chops",
        "Egg Dish",
        "Casseroles",
        "Roast Chicken",
        "Tofu Dish",
        "Chicken Soup",
        "Chili",
        "Quesadilla",
        "Burgers",
        "Porridge",
        "Burrito",
        "Grilled Chicken",
        "Pasta Salad",
        "Pizza and Calzones",
        "Risotto",
        "Roasts",
        "Scrambled Egg",
        "Soups and Stews",
        "Tostada",
        "Dumplings",
        "Fajita",
        "French Toast",
        "Frittata",
        "Gratin",
        "Green Salad",
        "Macaroni and Cheese",
        "Pancakes",
        "Pita and Wrap",
        "Potpie",
        "Refried Bean",
        "Skewers and Kebabs",
        "Slaws",
        "Tagine",
        "Tuna Salad",
        "Vegetable Pancake",
    }
)


def distinctive_categories(categories: list[str] | None) -> frozenset[str]:
    if not categories:
        return frozenset()
    return frozenset(categories) & DESCRIPTIVE_CATEGORIES


def order_feed(
    recipes: list[Recipe],
    *,
    limit: int | None = None,
    rng: random.Random | None = None,
) -> list[Recipe]:
    """Shuffle then greedily pick for category variety within a recent window."""
    remaining = list(recipes)
    (rng or random.Random()).shuffle(remaining)

    selected: list[Recipe] = []
    while remaining:
        if limit is not None and len(selected) >= limit:
            break

        recent: set[str] = set()
        for recipe in selected[-5:]:
            recent |= distinctive_categories(recipe.categories)

        pick_index = 0
        for index, recipe in enumerate(remaining):
            if distinctive_categories(recipe.categories).isdisjoint(recent):
                pick_index = index
                break

        selected.append(remaining.pop(pick_index))

    return selected


def build_feed_page(
    db: Session,
    *,
    limit: int = 20,
    exclude_ids: list[int] | None = None,
) -> tuple[list[Recipe], int]:
    excluded = set(exclude_ids or [])
    statement = select(Recipe)
    if excluded:
        statement = statement.where(Recipe.id.not_in(excluded))

    candidates = list(db.scalars(statement).all())
    items = order_feed(candidates, limit=limit)
    remaining = len(candidates) - len(items)
    return items, remaining
