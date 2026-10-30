from pydantic import BaseModel, Field


class FeedItem(BaseModel):
    id: int
    name: str
    description: str | None
    image: str | None
    total_min: int | None
    categories: list[str] = Field(default_factory=list)
    keywords: list[str] = Field(default_factory=list)

    model_config = {"from_attributes": True}


class FeedResponse(BaseModel):
    items: list[FeedItem]
    remaining: int
