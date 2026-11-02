import { useCallback, useEffect, useRef, useState } from 'react'

import { fetchFeed } from '../api/feed'
import type { FeedItem } from '../types/feed'

export const SWIPE_DECK_PAGE_SIZE = 15
export const SWIPE_DECK_PREFETCH_THRESHOLD = 5

export type SwipeAction = 'like' | 'pass'

export interface SwipeEngagement {
  recipeId: number
  action: SwipeAction
}

export type SwipeDeckStatus = 'loading' | 'ready' | 'empty' | 'exhausted' | 'error'

export interface UseSwipeDeckResult {
  status: SwipeDeckStatus
  currentRecipe: FeedItem | null
  engagements: SwipeEngagement[]
  handleLike: () => void
  handlePass: () => void
}

function collectSeenIds (
  current: FeedItem | null,
  queue: FeedItem[],
  engagements: SwipeEngagement[]
): number[] {
  const ids = new Set<number>()

  if (current != null) {
    ids.add(current.id)
  }

  for (const item of queue) {
    ids.add(item.id)
  }

  for (const engagement of engagements) {
    ids.add(engagement.recipeId)
  }

  return [...ids]
}

interface SwipeDeckState {
  status: SwipeDeckStatus
  currentRecipe: FeedItem | null
  queue: FeedItem[]
  feedRemaining: number
  engagements: SwipeEngagement[]
}

export function useSwipeDeck (): UseSwipeDeckResult {
  const [deck, setDeck] = useState<SwipeDeckState>({
    status: 'loading',
    currentRecipe: null,
    queue: [],
    feedRemaining: 0,
    engagements: []
  })
  const advancingRef = useRef(false)
  const prefetchRequestRef = useRef<Promise<void> | null>(null)

  const prefetchNextPage = useCallback(async (): Promise<void> => {
    if (prefetchRequestRef.current != null) {
      return await prefetchRequestRef.current
    }

    if (deck.feedRemaining <= 0 || deck.queue.length > SWIPE_DECK_PREFETCH_THRESHOLD) {
      return
    }

    const request = async (): Promise<void> => {
      try {
        const page = await fetchFeed({
          limit: SWIPE_DECK_PAGE_SIZE,
          excludeIds: collectSeenIds(deck.currentRecipe, deck.queue, deck.engagements)
        })

        setDeck(current => ({
          ...current,
          queue: [...current.queue, ...page.items],
          feedRemaining: page.remaining
        }))
      } finally {
        prefetchRequestRef.current = null
      }
    }

    prefetchRequestRef.current = request()
    await prefetchRequestRef.current
  }, [deck])

  useEffect(() => {
    const controller = new AbortController()

    async function loadInitialPage (): Promise<void> {
      try {
        const page = await fetchFeed({
          limit: SWIPE_DECK_PAGE_SIZE,
          signal: controller.signal
        })

        if (controller.signal.aborted) {
          return
        }

        const [first, ...rest] = page.items
        setDeck({
          status: first == null ? 'empty' : 'ready',
          currentRecipe: first ?? null,
          queue: rest,
          feedRemaining: page.remaining,
          engagements: []
        })
      } catch {
        if (controller.signal.aborted) {
          return
        }
        setDeck(current => ({ ...current, status: 'error' }))
      }
    }

    void loadInitialPage()

    return () => {
      controller.abort()
    }
  }, [])

  useEffect(() => {
    if (deck.status === 'ready') {
      void prefetchNextPage().catch(() => {
        // Keep the visible card; a later swipe can retry.
      })
    }
  }, [deck.status, prefetchNextPage])

  const advance = useCallback(async (action: SwipeAction): Promise<void> => {
    if (advancingRef.current || deck.currentRecipe == null) {
      return
    }

    advancingRef.current = true

    try {
      if (deck.queue.length === 0 && deck.feedRemaining > 0) {
        await prefetchNextPage()
      }

      setDeck(current => {
        if (current.currentRecipe == null) {
          return current
        }

        const [next, ...rest] = current.queue
        return {
          ...current,
          currentRecipe: next ?? null,
          queue: rest,
          engagements: [
            ...current.engagements,
            { recipeId: current.currentRecipe.id, action }
          ],
          status: next == null ? 'exhausted' : 'ready'
        }
      })
    } catch {
      // Keep the current recipe and engagement unchanged so the swipe can retry.
    } finally {
      queueMicrotask(() => {
        advancingRef.current = false
      })
    }
  }, [deck, prefetchNextPage])

  const handleLike = useCallback((): void => {
    void advance('like')
  }, [advance])

  const handlePass = useCallback((): void => {
    void advance('pass')
  }, [advance])

  return {
    status: deck.status,
    currentRecipe: deck.currentRecipe,
    engagements: deck.engagements,
    handleLike,
    handlePass
  }
}
