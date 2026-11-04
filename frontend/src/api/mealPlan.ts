import { apiBaseUrl } from '../config'
import type { ClientRating } from '../session/clientSession'
import type { MealPlanResponse } from '../types/mealPlan'

export async function generateMealPlan (
  ratings: ClientRating[],
  signal?: AbortSignal
): Promise<MealPlanResponse> {
  const response = await fetch(`${apiBaseUrl}/meal-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ratings: ratings.map(rating => ({
        recipe_id: rating.recipeId,
        action: rating.action
      }))
    }),
    signal
  })

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Meal plan request failed: unknown recipe')
    }
    throw new Error(`Meal plan request failed with status ${response.status}`)
  }

  return await response.json() as MealPlanResponse
}
