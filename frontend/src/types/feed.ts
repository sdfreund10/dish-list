export interface FeedItem {
  id: number
  name: string
  description: string | null
  image: string | null
  total_min: number | null
  categories: string[]
  keywords: string[]
}

export interface FeedResponse {
  items: FeedItem[]
  remaining: number
}
