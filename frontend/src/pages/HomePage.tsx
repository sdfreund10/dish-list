import { useEffect, useState, type ReactElement } from 'react'

import { fetchFeed } from '../api/feed'
import { RecipeSwipeCard } from '../components/RecipeSwipeCard'
import type { FeedItem } from '../types/feed'

type FeedStatus = 'loading' | 'ready' | 'empty' | 'error'

export function HomePage (): ReactElement {
  const [status, setStatus] = useState<FeedStatus>('loading')
  const [recipe, setRecipe] = useState<FeedItem | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadFeed (): Promise<void> {
      try {
        const response = await fetchFeed({ limit: 1, signal: controller.signal })

        if (response.items.length === 0) {
          setRecipe(null)
          setStatus('empty')
          return
        }

        setRecipe(response.items[0])
        setStatus('ready')
      } catch {
        if (controller.signal.aborted) {
          return
        }
        setRecipe(null)
        setStatus('error')
      }
    }

    void loadFeed()

    return () => {
      controller.abort()
    }
  }, [])

  function handleLike (): void {}
  function handlePass (): void {}

  return (
    <section className='home'>
      <h1>Swipe Engagement</h1>
      <p>Anonymous recipe-swiping experiment.</p>

      {status === 'loading' && (
        <p className='home-status' role='status'>Loading a recipe…</p>
      )}

      {status === 'error' && (
        <p className='home-status home-status-error' role='alert'>
          Could not load recipes. Check that the API is running.
        </p>
      )}

      {status === 'empty' && (
        <p className='home-status' role='status'>
          No recipes in the feed yet. Import recipes to get started.
        </p>
      )}

      {status === 'ready' && recipe != null && (
        <RecipeSwipeCard recipe={recipe} onLike={handleLike} onPass={handlePass} />
      )}
    </section>
  )
}
