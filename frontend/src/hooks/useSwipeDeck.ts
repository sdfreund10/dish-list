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
  prefetchFailed: boolean
}

export function useSwipeDeck (): UseSwipeDeckResult {
  const [deck, setDeck] = useState<SwipeDeckState>({
    status: 'loading',
    currentRecipe: null,
    queue: [],
    feedRemaining: 0,
    engagements: [],
    prefetchFailed: false
  })
  const prefetchingRef = useRef(false)

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
          engagements: [],
          prefetchFailed: false
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
    if (
      (deck.status !== 'ready' && deck.status !== 'loading') ||
      deck.feedRemaining <= 0 ||
      deck.queue.length > SWIPE_DECK_PREFETCH_THRESHOLD ||
      deck.prefetchFailed ||
      prefetchingRef.current
    ) {
      return
    }

    prefetchingRef.current = true

    async function prefetchNextPage (): Promise<void> {
      try {
        const page = await fetchFeed({
          limit: SWIPE_DECK_PAGE_SIZE,
          excludeIds: collectSeenIds(deck.currentRecipe, deck.queue, deck.engagements)
        })

        setDeck(current => {
          const queue = [...current.queue, ...page.items]
          const currentRecipe = current.currentRecipe ?? queue.shift() ?? null
          return {
            ...current,
            currentRecipe,
            queue,
            feedRemaining: page.items.length === 0 ? 0 : page.remaining,
            status: currentRecipe == null ? 'exhausted' : 'ready'
          }
        })
      } catch {
        setDeck(current => ({
          ...current,
          status: current.currentRecipe == null ? 'error' : current.status,
          prefetchFailed: true
        }))
      } finally {
        prefetchingRef.current = false
      }
    }

    void prefetchNextPage()
  }, [deck])

  const advance = useCallback((action: SwipeAction): void => {
    const recipeId = deck.currentRecipe?.id
    setDeck(current => {
      if (current.currentRecipe == null || current.currentRecipe.id !== recipeId) {
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
        status: next != null ? 'ready' : current.feedRemaining > 0 ? 'loading' : 'exhausted',
        prefetchFailed: next == null ? false : current.prefetchFailed
      }
    })
  }, [deck.currentRecipe?.id])

  const handleLike = useCallback((): void => {
    advance('like')
  }, [advance])

  const handlePass = useCallback((): void => {
    advance('pass')
  }, [advance])

  return {
    status: deck.status,
    currentRecipe: deck.currentRecipe,
    engagements: deck.engagements,
    handleLike,
    handlePass
  }
}
