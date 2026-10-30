from app.config import Settings


def test_development_defaults_to_dish_list_database() -> None:
    settings = Settings(environment="development", database_url="")

    assert settings.environment == "development"
    assert settings.database_url == "postgresql+psycopg://localhost/dish_list"


def test_test_environment_defaults_to_dish_list_test_database() -> None:
    settings = Settings(environment="test", database_url="")

    assert settings.environment == "test"
    assert settings.database_url == "postgresql+psycopg://localhost/dish_list_test"


def test_explicit_database_url_wins() -> None:
    settings = Settings(
        environment="test",
        database_url="postgresql+psycopg://localhost/custom",
    )

    assert settings.database_url == "postgresql+psycopg://localhost/custom"
