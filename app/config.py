from typing import Literal, Self

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["development", "test", "production"]

_DEFAULT_DATABASE_URLS = {
    "development": "postgresql+psycopg://localhost/dish_list",
    "test": "postgresql+psycopg://localhost/dish_list_test",
}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    environment: Environment = "development"
    database_url: str = ""
    cors_origins: str = "http://localhost:5173"

    @model_validator(mode="after")
    def resolve_database_url(self) -> Self:
        if self.database_url:
            return self

        if self.environment == "production":
            raise ValueError("DATABASE_URL is required when ENVIRONMENT=production")

        self.database_url = _DEFAULT_DATABASE_URLS[self.environment]
        return self

    @property
    def cors_origin_list(self) -> list[str]:
        return [
            origin.strip() for origin in self.cors_origins.split(",") if origin.strip()
        ]


settings = Settings()
