import type { FeedItem } from './feed'

export interface SessionState {
  rating_count: number
  like_count: number
  liked_recipe_ids: number[]
  eligible: boolean
}

export interface SessionCreated {
  id: string
  state: SessionState
}

export interface RatingResult {
  recipe_id: number
  action: 'like' | 'pass'
  session: SessionState
}

export interface PlanRecipe extends FeedItem {
  url: string
  author: string | null
}

export interface MealPlanResponse {
  status: 'generated' | 'insufficient_likes'
  recipes: PlanRecipe[]
  like_count: number
  rating_count: number
}
