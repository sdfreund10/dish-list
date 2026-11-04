from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas.meal_plan import MealPlanRequest, MealPlanResponse
from app.services.meal_plan import RecipeNotFound, generate_meal_plan

router = APIRouter()


@router.post("/meal-plan", response_model=MealPlanResponse)
def post_meal_plan(
    body: MealPlanRequest,
    db: Annotated[Session, Depends(get_db)],
) -> MealPlanResponse:
    try:
        return generate_meal_plan(db, body.ratings)
    except RecipeNotFound as error:
        raise HTTPException(status_code=404, detail="recipe_not_found") from error
