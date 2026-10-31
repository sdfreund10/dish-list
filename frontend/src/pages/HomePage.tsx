import type { ReactElement } from 'react'

import { RecipeSwipeCard } from '../components/RecipeSwipeCard'
import { SwipeSessionProgress } from '../components/SwipeSessionProgress'
import { useSwipeDeck } from '../hooks/useSwipeDeck'

export function HomePage (): ReactElement {
  const {
    status,
    currentRecipe,
    engagements,
    handleLike,
    handlePass
  } = useSwipeDeck()

  return (
    <section className='home'>
      <h1>Swipe Engagement</h1>
      <p>Anonymous recipe-swiping experiment.</p>

      {status === 'loading' && (
        <p className='home-status' role='status'>Loading recipes…</p>
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

      {status === 'exhausted' && (
        <p className='home-status' role='status'>
          You have seen all available recipes for now. Check back after more are added.
        </p>
      )}

      {(status === 'ready' || status === 'exhausted') && (
        <SwipeSessionProgress engagements={engagements} />
      )}

      {status === 'ready' && currentRecipe != null && (
        <RecipeSwipeCard
          recipe={currentRecipe}
          onLike={handleLike}
          onPass={handlePass}
        />
      )}
    </section>
  )
}
