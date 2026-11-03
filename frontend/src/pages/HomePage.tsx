import type { ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'

import { RecipeSwipeCard } from '../components/RecipeSwipeCard'
import type { SwipeAction } from '../hooks/useSwipeDeck'
import { useSwipeExperience } from '../swipe/SwipeExperience'

export function HomePage (): ReactElement {
  const navigate = useNavigate()
  const { session, deck } = useSwipeExperience()
  const {
    status,
    currentRecipe,
    handleLike,
    handlePass
  } = deck

  function rate (action: SwipeAction): void {
    const recipeId = currentRecipe?.id
    if (action === 'like') handleLike()
    else handlePass()
    if (recipeId != null) {
      session.recordEngagement({ recipeId, action })
    }
  }

  function openPlan (): void {
    void navigate('/plan', { state: { generate: true } })
  }

  return (
    <section className='home'>
      {session.eligible && (
        <div className='generate-plan'>
          <button
            type='button'
            className='generate-plan__button'
            onClick={openPlan}
          >
            Generate meal plan
          </button>
        </div>
      )}

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

      {status === 'ready' && currentRecipe != null && (
        <RecipeSwipeCard
          recipe={currentRecipe}
          onLike={() => {
            rate('like')
          }}
          onPass={() => {
            rate('pass')
          }}
        />
      )}
    </section>
  )
}
