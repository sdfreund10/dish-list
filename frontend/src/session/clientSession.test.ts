// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  MEAL_PLAN_STORAGE_KEY,
  SESSION_STORAGE_KEY,
  appendClientRating,
  canGenerateMealPlan,
  clearStoredMealPlan,
  ensureClientSession,
  findValidStoredMealPlan,
  ratedRecipeIds,
  readClientSession,
  readStoredMealPlan,
  viewPlanButtonLabel,
  writeStoredMealPlan
} from './clientSession'
import type { MealPlanRecipe } from '../types/mealPlan'

function makeStoredRecipe (id: number): MealPlanRecipe {
  return {
    id,
    name: `Recipe ${id}`,
    description: null,
    image: null,
    total_min: null,
    rating: null,
    rating_count: null,
    categories: [],
    keywords: [],
    url: `https://example.com/${id}`,
    author: null
  }
}

describe('clientSession', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '00000000-0000-4000-8000-000000000001'
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a local anonymous session without a server round trip', () => {
    const created = ensureClientSession()
    expect(created).toEqual({
      id: '00000000-0000-4000-8000-000000000001',
      ratings: []
    })
    expect(readClientSession()).toEqual(created)
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toContain(
      '00000000-0000-4000-8000-000000000001'
    )
  })

  it('reuses the stored session on later calls', () => {
    ensureClientSession()
    vi.mocked(crypto.randomUUID).mockReturnValue(
      '00000000-0000-4000-8000-000000000002'
    )

    expect(ensureClientSession().id).toBe('00000000-0000-4000-8000-000000000001')
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1)
  })

  it('appends the first action for a recipe and ignores retries', () => {
    appendClientRating({ recipeId: 10, action: 'like' })
    const afterRetry = appendClientRating({ recipeId: 10, action: 'pass' })
    appendClientRating({ recipeId: 11, action: 'pass' })

    expect(afterRetry.ratings).toEqual([{ recipeId: 10, action: 'like' }])
    expect(ratedRecipeIds()).toEqual([10, 11])
    expect(readClientSession()?.ratings).toEqual([
      { recipeId: 10, action: 'like' },
      { recipeId: 11, action: 'pass' }
    ])
  })

  it('unlocks meal-plan generation at three likes', () => {
    expect(canGenerateMealPlan([
      { recipeId: 1, action: 'like' },
      { recipeId: 2, action: 'like' },
      { recipeId: 3, action: 'pass' }
    ])).toBe(false)

    expect(canGenerateMealPlan([
      { recipeId: 1, action: 'like' },
      { recipeId: 2, action: 'like' },
      { recipeId: 3, action: 'like' }
    ])).toBe(true)

    expect(canGenerateMealPlan([
      { recipeId: 1, action: 'like' },
      { recipeId: 2, action: 'pass' },
      { recipeId: 3, action: 'like' },
      { recipeId: 4, action: 'pass' },
      { recipeId: 5, action: 'like' }
    ])).toBe(true)
  })

  it('labels the view plan button with like progress', () => {
    expect(viewPlanButtonLabel([])).toBe('View plan (0/3)')
    expect(viewPlanButtonLabel([
      { recipeId: 1, action: 'like' },
      { recipeId: 2, action: 'pass' }
    ])).toBe('View plan (1/3)')
    expect(viewPlanButtonLabel([
      { recipeId: 1, action: 'like' },
      { recipeId: 2, action: 'like' },
      { recipeId: 3, action: 'like' }
    ])).toBe('View plan (3)')
  })

  it('stores and reuses a meal plan when ratings match the session', () => {
    const session = ensureClientSession()
    appendClientRating({ recipeId: 1, action: 'like' })
    appendClientRating({ recipeId: 2, action: 'like' })
    appendClientRating({ recipeId: 3, action: 'like' })

    writeStoredMealPlan({
      sessionId: session.id,
      ratings: readClientSession()?.ratings ?? [],
      recipes: [makeStoredRecipe(10), makeStoredRecipe(11), makeStoredRecipe(12)]
    })

    expect(localStorage.getItem(MEAL_PLAN_STORAGE_KEY)).toContain('"sessionId"')
    expect(readStoredMealPlan()?.recipes.length).toBe(3)
    expect(findValidStoredMealPlan()?.recipes.map(recipe => recipe.id)).toEqual([10, 11, 12])
  })

  it('drops a stored meal plan after ratings change', () => {
    ensureClientSession()
    appendClientRating({ recipeId: 1, action: 'like' })
    appendClientRating({ recipeId: 2, action: 'like' })
    appendClientRating({ recipeId: 3, action: 'like' })

    const session = readClientSession()
    writeStoredMealPlan({
      sessionId: session?.id ?? '',
      ratings: session?.ratings ?? [],
      recipes: [makeStoredRecipe(1), makeStoredRecipe(2), makeStoredRecipe(3)]
    })

    appendClientRating({ recipeId: 4, action: 'pass' })

    expect(findValidStoredMealPlan()).toBeNull()
    expect(readStoredMealPlan()).toBeNull()
  })

  it('ignores a stored meal plan for a different session id', () => {
    ensureClientSession()
    writeStoredMealPlan({
      sessionId: 'other-session',
      ratings: [],
      recipes: [makeStoredRecipe(1), makeStoredRecipe(2), makeStoredRecipe(3)]
    })

    expect(findValidStoredMealPlan()).toBeNull()
    clearStoredMealPlan()
    expect(readStoredMealPlan()).toBeNull()
  })
})
