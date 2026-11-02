import { useState, type ReactElement } from 'react'

import { useRecipeCardSwipe } from '../hooks/useRecipeCardSwipe'
import type { FeedItem } from '../types/feed'

const MAX_TAGS = 6
const STAR_COUNT = 5

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

function RecipeRating ({
  rating,
  count
}: {
  rating: number
  count: number | null
}): ReactElement {
  const filledStars = Math.min(STAR_COUNT, Math.max(0, Math.round(rating)))
  const countLabel =
    count != null && count > 0
      ? `${formatRatingCount(count)} ${count === 1 ? 'rating' : 'ratings'}`
      : null
  const label =
    countLabel == null
      ? `Rated ${filledStars} out of ${STAR_COUNT}`
      : `Rated ${filledStars} out of ${STAR_COUNT}, ${countLabel}`

  return (
    <p className='recipe-swipe-card__rating' aria-label={label}>
      <span className='recipe-swipe-card__stars'>
        {Array.from({ length: STAR_COUNT }, (_, index) => (
          <StarIcon key={index} filled={index < filledStars} />
        ))}
      </span>
      {count != null && count > 0 && (
        <span className='recipe-swipe-card__rating-count'>
          {formatRatingCount(count)}
        </span>
      )}
    </p>
  )
}

export interface RecipeSwipeCardProps {
  recipe: FeedItem
  onLike: () => void
  onPass: () => void
}

export function RecipeSwipeCard ({
  recipe,
  onLike,
  onPass
}: RecipeSwipeCardProps): ReactElement {
  const {
    showLikeHint,
    showPassHint,
    hintOpacity,
    swipeSurfaceStyle,
    swipeSurfaceClassName,
    onSwipePointerDown,
    onSwipePointerMove,
    onSwipePointerUp,
    onSwipePointerCancel
  } = useRecipeCardSwipe(recipe.id, onLike, onPass)
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

  return (
    <article className='recipe-swipe-card' aria-labelledby={`recipe-title-${recipe.id}`}>
      <div
        className={swipeSurfaceClassName}
        style={swipeSurfaceStyle}
        onPointerDown={onSwipePointerDown}
        onPointerMove={onSwipePointerMove}
        onPointerUp={onSwipePointerUp}
        onPointerCancel={onSwipePointerCancel}
      >
        {(showLikeHint || showPassHint) && (
          <div className='recipe-swipe-card__hints' aria-hidden='true'>
            {showLikeHint && (
              <span
                className='recipe-swipe-card__hint recipe-swipe-card__hint--like'
                style={{ opacity: hintOpacity }}
              >
                Like
              </span>
            )}
            {showPassHint && (
              <span
                className='recipe-swipe-card__hint recipe-swipe-card__hint--pass'
                style={{ opacity: hintOpacity }}
              >
                Pass
              </span>
            )}
          </div>
        )}

        <div className='recipe-swipe-card__media'>
          {showImage
            ? (
              <img
                className='recipe-swipe-card__image'
                src={recipe.image ?? undefined}
                alt=''
                draggable={false}
                onError={() => {
                  setFailedImageUrl(recipe.image)
                }}
              />
              )
            : (
              <div className='recipe-swipe-card__image-fallback' aria-hidden='true'>
                <span>No photo</span>
              </div>
              )}
        </div>

        <div className='recipe-swipe-card__body'>
          <h1 id={`recipe-title-${recipe.id}`} className='recipe-swipe-card__title'>
            {recipe.name}
          </h1>

          {(timeLabel != null || showRating) && (
            <div className='recipe-swipe-card__meta'>
              {timeLabel != null && (
                <p className='recipe-swipe-card__time'>{timeLabel}</p>
              )}
              {showRating && recipe.rating != null && (
                <RecipeRating rating={recipe.rating} count={recipe.rating_count} />
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
        </div>
      </div>

      <div className='recipe-swipe-card__actions'>
        <button
          type='button'
          className='recipe-swipe-card__action recipe-swipe-card__action--pass'
          aria-label={`Pass ${recipe.name}`}
          onClick={event => {
            if (event.detail <= 1) onPass()
          }}
        >
          Pass
        </button>
        <button
          type='button'
          className='recipe-swipe-card__action recipe-swipe-card__action--like'
          aria-label={`Like ${recipe.name}`}
          onClick={event => {
            if (event.detail <= 1) onLike()
          }}
        >
          Like
        </button>
      </div>
    </article>
  )
}
