import { apiBaseUrl } from '../config'
import type { FeedResponse } from '../types/feed'

export interface FetchFeedOptions {
  limit?: number
  excludeIds?: number[]
  signal?: AbortSignal
}

export async function fetchFeed ({
  limit = 20,
  excludeIds = [],
  signal
}: FetchFeedOptions = {}): Promise<FeedResponse> {
  const params = new URLSearchParams()
  params.set('limit', String(limit))

  if (excludeIds.length > 0) {
    params.set('exclude_ids', excludeIds.join(','))
  }

  const response = await fetch(`${apiBaseUrl}/feed?${params.toString()}`, {
    signal
  })

  if (!response.ok) {
    throw new Error(`Feed request failed with status ${response.status}`)
  }

  return await response.json() as FeedResponse
}
