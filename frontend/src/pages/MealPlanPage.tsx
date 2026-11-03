import { useEffect, useState, type ReactElement } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { ApiError, generateMealPlan } from '../api/sessions'
import { SESSION_STORAGE_KEY } from '../hooks/useSwipeSession'
import type { MealPlanResponse, PlanRecipe } from '../types/session'

const STAR_COUNT = 5

interface PlanLocationState {
  generate?: boolean
}

type PlanPhase = 'prompt' | 'loading' | 'ready' | 'error' | 'not-eligible' | 'missing-session'

function formatCookTime (totalMin: number): string {
  if (totalMin < 60) return `${totalMin} min`

  const hours = Math.floor(totalMin / 60)
  const minutes = totalMin % 60
  if (minutes === 0) return `${hours} hr`

  return `${hours} hr ${minutes} min`
}

function recipeTags (recipe: PlanRecipe): string[] {
  const seen = new Set<string>()
  const tags: string[] = []

  for (const tag of [...recipe.keywords, ...recipe.categories]) {
    const normalized = tag.trim()
    if (normalized === '' || seen.has(normalized.toLowerCase())) continue
    seen.add(normalized.toLowerCase())
    tags.push(normalized)
    if (tags.length >= 6) break
  }

  return tags
}

function MealImage ({ recipe }: { recipe: PlanRecipe }): ReactElement {
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const hasImage = recipe.image != null && recipe.image.trim() !== ''
  const showImage = hasImage && recipe.image !== failedUrl

  return (
    <div className='meal-plan-card__media'>
      {showImage
        ? (
          <img
            className='meal-plan-card__image'
            src={recipe.image ?? undefined}
            alt=''
            onError={() => {
              setFailedUrl(recipe.image)
            }}
          />
          )
        : (
          <div className='meal-plan-card__fallback'>No photo</div>
          )}
    </div>
  )
}

function MealRating ({
  rating,
  count
}: {
  rating: number
  count: number | null
}): ReactElement {
  const filledStars = Math.min(STAR_COUNT, Math.max(0, Math.round(rating)))
  const countLabel =
    count != null && count > 0
      ? `${count.toLocaleString('en-US')} ${count === 1 ? 'rating' : 'ratings'}`
      : null
  const label = countLabel == null
    ? `Rated ${filledStars} out of ${STAR_COUNT}`
    : `Rated ${filledStars} out of ${STAR_COUNT}, ${countLabel}`

  return (
    <p className='meal-plan-card__rating' aria-label={label}>
      <span className='meal-plan-card__stars' aria-hidden='true'>
        {Array.from({ length: STAR_COUNT }, (_, index) => (
          <svg
            key={index}
            className={
              index < filledStars
                ? 'meal-plan-card__star meal-plan-card__star--filled'
                : 'meal-plan-card__star'
            }
            viewBox='0 0 24 24'
          >
            <path d='M12 2.6 14.7 8.7 21.3 9.4 16.4 13.8 17.8 20.4 12 16.9 6.2 20.4 7.6 13.8 2.7 9.4 9.3 8.7Z' />
          </svg>
        ))}
      </span>
      {count != null && count > 0 && (
        <span className='meal-plan-card__rating-count'>
          {count.toLocaleString('en-US')}
        </span>
      )}
    </p>
  )
}

function MealCard ({ recipe }: { recipe: PlanRecipe }): ReactElement {
  const timeLabel =
    recipe.total_min != null && recipe.total_min > 0
      ? formatCookTime(recipe.total_min)
      : null
  const showRating = recipe.rating != null && recipe.rating > 0
  const tags = recipeTags(recipe)
  const description = recipe.description?.trim() ?? ''

  return (
    <article className='meal-plan-card' aria-labelledby={`meal-${recipe.id}`}>
      <MealImage recipe={recipe} />
      <div className='meal-plan-card__body'>
        <h2 id={`meal-${recipe.id}`} className='meal-plan-card__title'>
          {recipe.name}
        </h2>
        {recipe.author != null && recipe.author.trim() !== '' && (
          <p className='meal-plan-card__author'>{recipe.author}</p>
        )}
        {(timeLabel != null || showRating) && (
          <div className='meal-plan-card__meta'>
            {timeLabel != null && (
              <p className='meal-plan-card__time'>{timeLabel}</p>
            )}
            {showRating && recipe.rating != null && (
              <MealRating rating={recipe.rating} count={recipe.rating_count} />
            )}
          </div>
        )}
        {description !== '' && (
          <p className='meal-plan-card__description'>{description}</p>
        )}
        {tags.length > 0 && (
          <ul className='meal-plan-card__tags'>
            {tags.map(tag => (
              <li key={tag} className='meal-plan-card__tag'>{tag}</li>
            ))}
          </ul>
        )}
        <a
          className='meal-plan-card__source'
          href={recipe.url}
          target='_blank'
          rel='noreferrer'
        >
          View recipe
        </a>
      </div>
    </article>
  )
}

export function MealPlanPage (): ReactElement {
  const location = useLocation()
  const generate = (location.state as PlanLocationState | null)?.generate === true
  const [attempt, setAttempt] = useState(0)
  const [phase, setPhase] = useState<PlanPhase>(generate ? 'loading' : 'prompt')
  const [plan, setPlan] = useState<MealPlanResponse | null>(null)

  useEffect(() => {
    if (!generate) return

    const sessionId = sessionStorage.getItem(SESSION_STORAGE_KEY)
    if (sessionId == null) {
      setPhase('missing-session')
      return
    }

    const controller = new AbortController()
    setPhase('loading')
    setPlan(null)

    generateMealPlan(sessionId, controller.signal)
      .then(result => {
        setPlan(result)
        setPhase('ready')
      })
      .catch(error => {
        if (controller.signal.aborted) return
        if (error instanceof ApiError && error.status === 403) {
          setPhase('not-eligible')
          return
        }
        setPhase('error')
      })

    return () => {
      controller.abort()
    }
  }, [attempt, generate])

  return (
    <section className='meal-plan' aria-labelledby='meal-plan-title'>
      <div className='meal-plan__intro'>
        <h1 id='meal-plan-title' className='meal-plan__title'>
          {plan?.status === 'generated' ? 'Your meal plan' : 'Meal plan'}
        </h1>
        <Link className='meal-plan__back' to='/'>Keep swiping</Link>
      </div>

      {phase === 'prompt' && (
        <p className='meal-plan__status' role='status'>
          Generate a meal plan from the swipe deck.
        </p>
      )}

      {phase === 'missing-session' && (
        <p className='meal-plan__status' role='status'>
          Start swiping to generate a meal plan.
        </p>
      )}

      {phase === 'loading' && (
        <p className='meal-plan__status' role='status'>Generating your meal plan…</p>
      )}

      {phase === 'not-eligible' && (
        <p className='meal-plan__status' role='status'>
          Rate a few more recipes to unlock a meal plan.
        </p>
      )}

      {phase === 'error' && (
        <div className='meal-plan__status meal-plan__status--error' role='alert'>
          <p>Could not generate a meal plan.</p>
          <button
            type='button'
            className='meal-plan__retry'
            onClick={() => {
              setAttempt(current => current + 1)
            }}
          >
            Try again
          </button>
        </div>
      )}

      {phase === 'ready' && plan?.status === 'insufficient_likes' && (
        <p className='meal-plan__status' role='status'>
          Like 3 recipes to generate a meal plan. You have {plan.like_count}.
        </p>
      )}

      {phase === 'ready' && plan?.status === 'generated' && (
        <div className='meal-plan__meals'>
          {plan.recipes.map(recipe => (
            <MealCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}
    </section>
  )
}
