import type { ReactElement } from 'react'
import { useNavigate } from 'react-router-dom'

import { RecipeSwipeCard } from '../components/RecipeSwipeCard'
import { useSwipeDeck } from '../hooks/useSwipeDeck'
import {
  canGenerateMealPlan,
  readClientSession
} from '../session/clientSession'

export function HomePage (): ReactElement {
  const navigate = useNavigate()
  const {
    status,
    currentRecipe,
    handleLike,
    handlePass
  } = useSwipeDeck()

  const unlocked = canGenerateMealPlan(readClientSession()?.ratings ?? [])

  return (
    <section className='home'>
      {unlocked && (
        <div className='generate-plan'>
          <button
            type='button'
            className='generate-plan__button'
            onClick={() => {
              navigate('/plan')
            }}
          >
            Generate meal plan
            <svg
              className='generate-plan__chevron'
              viewBox='0 0 24 24'
              aria-hidden='true'
            >
              <path
                d='M9 5.5 15.5 12 9 18.5'
                fill='none'
                stroke='currentColor'
                strokeWidth='2.25'
                strokeLinecap='round'
                strokeLinejoin='round'
              />
            </svg>
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
          onLike={handleLike}
          onPass={handlePass}
        />
      )}
    </section>
  )
}
