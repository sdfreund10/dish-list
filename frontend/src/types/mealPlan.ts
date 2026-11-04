import type { FeedItem } from './feed'

export interface MealPlanRecipe extends FeedItem {
  url: string
  author: string | null
}

export interface MealPlanResponse {
  status: 'generated' | 'insufficient_likes'
  recipes: MealPlanRecipe[]
  like_count: number
  rating_count: number
}
