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

export function useSwipeDeck (): UseSwipeDeckResult {
  const [status, setStatus] = useState<SwipeDeckStatus>('loading')
  const [currentRecipe, setCurrentRecipe] = useState<FeedItem | null>(null)
  const [queue, setQueue] = useState<FeedItem[]>([])
  const [feedRemaining, setFeedRemaining] = useState(0)
  const [engagements, setEngagements] = useState<SwipeEngagement[]>([])

  const currentRef = useRef<FeedItem | null>(null)
  const queueRef = useRef<FeedItem[]>([])
  const feedRemainingRef = useRef(0)
  const engagementsRef = useRef<SwipeEngagement[]>([])
  const advancingRef = useRef(false)
  const prefetchingRef = useRef(false)

  currentRef.current = currentRecipe
  queueRef.current = queue
  feedRemainingRef.current = feedRemaining
  engagementsRef.current = engagements

  const prefetchNextPage = useCallback(async (): Promise<void> => {
    if (prefetchingRef.current) {
      return
    }

    if (feedRemainingRef.current <= 0) {
      return
    }

    if (queueRef.current.length > SWIPE_DECK_PREFETCH_THRESHOLD) {
      return
    }

    prefetchingRef.current = true

    try {
      const page = await fetchFeed({
        limit: SWIPE_DECK_PAGE_SIZE,
        excludeIds: collectSeenIds(
          currentRef.current,
          queueRef.current,
          engagementsRef.current
        )
      })

      feedRemainingRef.current = page.remaining
      queueRef.current = [...queueRef.current, ...page.items]
      setFeedRemaining(page.remaining)
      setQueue(queueRef.current)

      if (
        queueRef.current.length <= SWIPE_DECK_PREFETCH_THRESHOLD &&
        feedRemainingRef.current > 0
      ) {
        queueMicrotask(() => {
          void prefetchNextPage()
        })
      }
    } catch {
      // Keep the visible card; a later swipe or prefetch can retry.
    } finally {
      prefetchingRef.current = false
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    async function loadInitialPage (): Promise<void> {
      try {
        const page = await fetchFeed({
          limit: SWIPE_DECK_PAGE_SIZE,
          signal: controller.signal
        })

        if (page.items.length === 0) {
          setStatus('empty')
          return
        }

        const [first, ...rest] = page.items
        currentRef.current = first
        queueRef.current = rest
        feedRemainingRef.current = page.remaining
        setCurrentRecipe(first)
        setQueue(rest)
        setFeedRemaining(page.remaining)
        setStatus('ready')
        void prefetchNextPage()
      } catch {
        if (controller.signal.aborted) {
          return
        }
        setStatus('error')
      }
    }

    void loadInitialPage()

    return () => {
      controller.abort()
    }
  }, [])

  const advance = useCallback(async (action: SwipeAction): Promise<void> => {
    if (advancingRef.current) {
      return
    }

    const current = currentRef.current
    if (current == null) {
      return
    }

    advancingRef.current = true

    try {
      const nextEngagements = [
        ...engagementsRef.current,
        { recipeId: current.id, action }
      ]
      engagementsRef.current = nextEngagements
      setEngagements(nextEngagements)

      let nextQueue = [...queueRef.current]
      let nextCurrent = nextQueue.shift() ?? null
      let remaining = feedRemainingRef.current

      if (nextCurrent == null && remaining > 0) {
        try {
          const page = await fetchFeed({
            limit: SWIPE_DECK_PAGE_SIZE,
            excludeIds: collectSeenIds(null, nextQueue, nextEngagements)
          })
          remaining = page.remaining
          nextQueue = [...nextQueue, ...page.items]
          nextCurrent = nextQueue.shift() ?? null
        } catch {
          engagementsRef.current = engagementsRef.current.slice(0, -1)
          setEngagements(engagementsRef.current)
          return
        }
      }

      queueRef.current = nextQueue
      feedRemainingRef.current = remaining
      currentRef.current = nextCurrent
      setQueue(nextQueue)
      setFeedRemaining(remaining)
      setCurrentRecipe(nextCurrent)
      setStatus(nextCurrent == null ? 'exhausted' : 'ready')

      if (nextCurrent != null && remaining > 0) {
        void prefetchNextPage()
      }
    } finally {
      queueMicrotask(() => {
        advancingRef.current = false
      })
    }
  }, [prefetchNextPage])

  const handleLike = useCallback((): void => {
    void advance('like')
  }, [advance])

  const handlePass = useCallback((): void => {
    void advance('pass')
  }, [advance])

  return {
    status,
    currentRecipe,
    engagements,
    handleLike,
    handlePass
  }
}
