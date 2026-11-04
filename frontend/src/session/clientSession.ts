import type { MealPlanRecipe } from '../types/mealPlan'

export type RatingAction = 'like' | 'pass'

export interface ClientRating {
  recipeId: number
  action: RatingAction
}

export interface ClientSession {
  id: string
  ratings: ClientRating[]
}

export interface StoredMealPlan {
  sessionId: string
  ratings: ClientRating[]
  recipes: MealPlanRecipe[]
}

export const SESSION_STORAGE_KEY = 'dish-list.session'
export const MEAL_PLAN_STORAGE_KEY = 'dish-list.meal-plan'

export function ensureClientSession (): ClientSession {
  const existing = readClientSession()
  if (existing != null) return existing

  const created: ClientSession = {
    id: crypto.randomUUID(),
    ratings: []
  }
  writeClientSession(created)
  return created
}

export function readClientSession (): ClientSession | null {
  const raw = sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (raw == null) return null

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isClientSession(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

export function appendClientRating (rating: ClientRating): ClientSession {
  const session = ensureClientSession()
  if (session.ratings.some(existing => existing.recipeId === rating.recipeId)) {
    return session
  }

  const next: ClientSession = {
    ...session,
    ratings: [...session.ratings, rating]
  }
  writeClientSession(next)
  clearStoredMealPlan()
  return next
}

export function readStoredMealPlan (): StoredMealPlan | null {
  const raw = localStorage.getItem(MEAL_PLAN_STORAGE_KEY)
  if (raw == null) return null

  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isStoredMealPlan(parsed)) return null
    return parsed
  } catch {
    return null
  }
}

export function writeStoredMealPlan (plan: StoredMealPlan): void {
  localStorage.setItem(MEAL_PLAN_STORAGE_KEY, JSON.stringify(plan))
}

export function clearStoredMealPlan (): void {
  localStorage.removeItem(MEAL_PLAN_STORAGE_KEY)
}

export function findValidStoredMealPlan (): StoredMealPlan | null {
  const session = readClientSession()
  if (session == null) return null

  const stored = readStoredMealPlan()
  if (stored == null) return null
  if (stored.sessionId !== session.id) return null
  if (!ratingsMatch(stored.ratings, session.ratings)) return null
  if (stored.recipes.length === 0) return null

  return stored
}

export function ratingsMatch (left: ClientRating[], right: ClientRating[]): boolean {
  if (left.length !== right.length) return false

  return left.every((rating, index) => {
    const other = right[index]
    return (
      rating.recipeId === other.recipeId &&
      rating.action === other.action
    )
  })
}

export function ratedRecipeIds (session: ClientSession = ensureClientSession()): number[] {
  return session.ratings.map(rating => rating.recipeId)
}

export const MEAL_PLAN_LIKE_THRESHOLD = 3

export function countLikes (ratings: ClientRating[]): number {
  return ratings.filter(rating => rating.action === 'like').length
}

export function canGenerateMealPlan (ratings: ClientRating[]): boolean {
  return countLikes(ratings) >= MEAL_PLAN_LIKE_THRESHOLD
}

export function viewPlanButtonLabel (ratings: ClientRating[]): string {
  const likes = countLikes(ratings)
  if (canGenerateMealPlan(ratings)) {
    return `View plan (${likes})`
  }
  return `View plan (${likes}/${MEAL_PLAN_LIKE_THRESHOLD})`
}

function writeClientSession (session: ClientSession): void {
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
}

function isClientSession (value: unknown): value is ClientSession {
  if (value == null || typeof value !== 'object') return false
  const session = value as Partial<ClientSession>
  return (
    typeof session.id === 'string' &&
    session.id.length > 0 &&
    Array.isArray(session.ratings) &&
    session.ratings.every(isClientRating)
  )
}

function isClientRating (value: unknown): value is ClientRating {
  if (value == null || typeof value !== 'object') return false
  const rating = value as Partial<ClientRating>
  return (
    typeof rating.recipeId === 'number' &&
    (rating.action === 'like' || rating.action === 'pass')
  )
}

function isStoredMealPlan (value: unknown): value is StoredMealPlan {
  if (value == null || typeof value !== 'object') return false
  const plan = value as Partial<StoredMealPlan>
  return (
    typeof plan.sessionId === 'string' &&
    plan.sessionId.length > 0 &&
    Array.isArray(plan.ratings) &&
    plan.ratings.every(isClientRating) &&
    Array.isArray(plan.recipes) &&
    plan.recipes.every(isMealPlanRecipe)
  )
}

function isMealPlanRecipe (value: unknown): value is MealPlanRecipe {
  if (value == null || typeof value !== 'object') return false
  const recipe = value as Partial<MealPlanRecipe>
  return (
    typeof recipe.id === 'number' &&
    typeof recipe.name === 'string' &&
    typeof recipe.url === 'string' &&
    (recipe.author === null || typeof recipe.author === 'string') &&
    (recipe.description === null || typeof recipe.description === 'string') &&
    (recipe.image === null || typeof recipe.image === 'string') &&
    (recipe.total_min === null || typeof recipe.total_min === 'number') &&
    (recipe.rating === null || typeof recipe.rating === 'number') &&
    (recipe.rating_count === null || typeof recipe.rating_count === 'number') &&
    Array.isArray(recipe.categories) &&
    Array.isArray(recipe.keywords)
  )
}
