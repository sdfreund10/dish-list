import { apiBaseUrl } from '../config'
import type {
  MealPlanResponse,
  RatingResult,
  SessionCreated,
  SessionState
} from '../types/session'

export class ApiError extends Error {
  readonly status: number

  constructor (status: number) {
    super(`Request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
  }
}

async function parseResponse<T> (response: Response): Promise<T> {
  if (!response.ok) {
    throw new ApiError(response.status)
  }
  return await response.json() as T
}

export async function createSession (signal?: AbortSignal): Promise<SessionCreated> {
  const response = await fetch(`${apiBaseUrl}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    signal
  })
  return await parseResponse<SessionCreated>(response)
}

export async function fetchSessionState (
  sessionId: string,
  signal?: AbortSignal
): Promise<SessionState> {
  const response = await fetch(`${apiBaseUrl}/sessions/${sessionId}`, { signal })
  return await parseResponse<SessionState>(response)
}

export async function recordRating (
  sessionId: string,
  rating: { recipeId: number, action: 'like' | 'pass' }
): Promise<RatingResult> {
  const response = await fetch(`${apiBaseUrl}/sessions/${sessionId}/ratings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipe_id: rating.recipeId,
      action: rating.action
    })
  })
  return await parseResponse<RatingResult>(response)
}

export async function generateMealPlan (
  sessionId: string,
  signal?: AbortSignal
): Promise<MealPlanResponse> {
  const response = await fetch(`${apiBaseUrl}/sessions/${sessionId}/meal-plan`, {
    method: 'POST',
    signal
  })
  return await parseResponse<MealPlanResponse>(response)
}
