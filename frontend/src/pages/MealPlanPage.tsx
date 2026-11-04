import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { Link } from 'react-router-dom'

import { generateMealPlan } from '../api/mealPlan'
import {
  canGenerateMealPlan,
  readClientSession
} from '../session/clientSession'
import type { FeedItem } from '../types/feed'
import type { MealPlanRecipe } from '../types/mealPlan'

const MAX_TAGS = 6
const STAR_COUNT = 5

type PagePhase = 'not_ready' | 'loading' | 'ready' | 'error'

function collectTags (recipe: FeedItem): string[] {
  const seen = new Set<string>()
  const tags: string[] = []

  for (const tag of [...recipe.keywords, ...recipe.categories]) {
    const normalized = tag.trim()
    if (normalized === '') continue

    const key = normalized.toLowerCase()
    if (seen.has(key)) continue

    seen.add(key)
    tags.push(normalized)

    if (tags.length >= MAX_TAGS) break
  }

  return tags
}

function formatCookTime (totalMin: number): string {
  if (totalMin < 60) return `${totalMin} min`

  const hours = Math.floor(totalMin / 60)
  const minutes = totalMin % 60
  if (minutes === 0) return `${hours} hr`

  return `${hours} hr ${minutes} min`
}

function formatRatingCount (count: number): string {
  return count.toLocaleString('en-US')
}

function StarIcon ({ filled }: { filled: boolean }): ReactElement {
  return (
    <svg
      className={
        filled
          ? 'recipe-swipe-card__star recipe-swipe-card__star--filled'
          : 'recipe-swipe-card__star'
      }
      viewBox='0 0 24 24'
      aria-hidden='true'
    >
      <path d='M12 2.6 14.7 8.7 21.3 9.4 16.4 13.8 17.8 20.4 12 16.9 6.2 20.4 7.6 13.8 2.7 9.4 9.3 8.7Z' />
    </svg>
  )
}

function PlanRecipeCard ({ recipe }: { recipe: MealPlanRecipe }): ReactElement {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null)
  const hasImageUrl =
    recipe.image != null && recipe.image.trim() !== ''
  const showImage = hasImageUrl && recipe.image !== failedImageUrl
  const tags = collectTags(recipe)
  const timeLabel =
    recipe.total_min != null && recipe.total_min > 0
      ? formatCookTime(recipe.total_min)
      : null
  const showRating = recipe.rating != null && recipe.rating > 0
  const filledStars =
    showRating && recipe.rating != null
      ? Math.min(STAR_COUNT, Math.max(0, Math.round(recipe.rating)))
      : 0

  return (
    <article className='meal-plan-card' aria-labelledby={`plan-recipe-${recipe.id}`}>
      <div className='meal-plan-card__media'>
        {showImage
          ? (
            <img
              className='meal-plan-card__image'
              src={recipe.image ?? undefined}
              alt=''
              draggable={false}
              onError={() => {
                setFailedImageUrl(recipe.image)
              }}
            />
            )
          : (
            <div className='meal-plan-card__image-fallback' aria-hidden='true'>
              <span>No photo</span>
            </div>
            )}
      </div>

      <div className='meal-plan-card__body'>
        <h2 id={`plan-recipe-${recipe.id}`} className='meal-plan-card__title'>
          {recipe.name}
        </h2>

        {(timeLabel != null || showRating) && (
          <div className='recipe-swipe-card__meta'>
            {timeLabel != null && (
              <p className='recipe-swipe-card__time'>{timeLabel}</p>
            )}
            {showRating && recipe.rating != null && (
              <p className='recipe-swipe-card__rating'>
                <span className='recipe-swipe-card__stars'>
                  {Array.from({ length: STAR_COUNT }, (_, index) => (
                    <StarIcon key={index} filled={index < filledStars} />
                  ))}
                </span>
                {recipe.rating_count != null && recipe.rating_count > 0 && (
                  <span className='recipe-swipe-card__rating-count'>
                    {formatRatingCount(recipe.rating_count)}
                  </span>
                )}
              </p>
            )}
          </div>
        )}

        {tags.length > 0 && (
          <ul className='recipe-swipe-card__tags'>
            {tags.map((tag) => (
              <li key={tag} className='recipe-swipe-card__tag'>
                {tag}
              </li>
            ))}
          </ul>
        )}

        <p className='meal-plan-card__source'>
          <a href={recipe.url} target='_blank' rel='noopener noreferrer'>
            View recipe
            {recipe.author != null && recipe.author.trim() !== ''
              ? ` · ${recipe.author}`
              : ''}
          </a>
        </p>
      </div>
    </article>
  )
}

export function MealPlanPage (): ReactElement {
  const [phase, setPhase] = useState<PagePhase>('loading')
  const [recipes, setRecipes] = useState<MealPlanRecipe[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const runGenerate = useCallback(async (signal?: AbortSignal) => {
    const ratings = readClientSession()?.ratings ?? []
    if (!canGenerateMealPlan(ratings)) {
      setPhase('not_ready')
      return
    }

    setPhase('loading')
    setErrorMessage(null)

    try {
      const result = await generateMealPlan(ratings, signal)
      if (signal?.aborted) return

      if (result.status === 'generated') {
        setRecipes(result.recipes)
        setPhase('ready')
        return
      }

      setErrorMessage('Not enough likes to build a plan.')
      setPhase('error')
    } catch {
      if (signal?.aborted) return
      setErrorMessage('Could not generate a meal plan. Try again or keep swiping.')
      setPhase('error')
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void runGenerate(controller.signal)
    return () => {
      controller.abort()
    }
  }, [runGenerate])

  if (phase === 'not_ready') {
    return (
      <section className='meal-plan'>
        <p className='meal-plan-status' role='status'>
          Like at least three recipes first.
        </p>
        <Link className='meal-plan-link' to='/'>Back to swiping</Link>
      </section>
    )
  }

  if (phase === 'loading') {
    return (
      <section className='meal-plan'>
        <p className='meal-plan-status' role='status'>Building your plan…</p>
      </section>
    )
  }

  if (phase === 'error') {
    return (
      <section className='meal-plan'>
        <p className='meal-plan-status meal-plan-status--error' role='alert'>
          {errorMessage ?? 'Something went wrong.'}
        </p>
        <div className='meal-plan-actions'>
          <button
            type='button'
            className='meal-plan-retry'
            onClick={() => {
              void runGenerate()
            }}
          >
            Try again
          </button>
          <Link className='meal-plan-link' to='/'>Back to swiping</Link>
        </div>
      </section>
    )
  }

  return (
    <section className='meal-plan'>
      <h1 className='meal-plan-heading'>Your meal plan</h1>
      <ul className='meal-plan-list'>
        {recipes.map(recipe => (
          <li key={recipe.id} className='meal-plan-list__item'>
            <PlanRecipeCard recipe={recipe} />
          </li>
        ))}
      </ul>
      <Link className='meal-plan-link' to='/'>Back to swiping</Link>
    </section>
  )
}
