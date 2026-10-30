from dataclasses import dataclass

from app.services.feed import distinctive_categories, order_feed


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
