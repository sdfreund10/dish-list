import type { ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'

import { AppTopBar } from '../components/AppTopBar'
import { RecipeSwipeCard } from '../components/RecipeSwipeCard'
import { useSwipeDeck } from '../hooks/useSwipeDeck'
import {
  canGenerateMealPlan,
  readClientSession,
  viewPlanButtonLabel
} from '../session/clientSession'

export function HomePage (): ReactElement {
  const navigate = useNavigate()
  const {
    status,
    currentRecipe,
    handleLike,
    handlePass
  } = useSwipeDeck()

  const ratings = readClientSession()?.ratings ?? []
  const unlocked = canGenerateMealPlan(ratings)
  const planButtonLabel = viewPlanButtonLabel(ratings)

  return (
    <section className='home'>
      <AppTopBar
        action={
          <button
            type='button'
            className={
              unlocked
                ? 'header-cta'
                : 'header-cta header-cta--disabled'
            }
            disabled={!unlocked}
            aria-disabled={!unlocked}
            onClick={() => {
              navigate('/plan')
            }}
          >
            {planButtonLabel}
          </button>
        }
      />

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
          onLike={handleLike}
          onPass={handlePass}
        />
      )}
    </section>
  )
}
