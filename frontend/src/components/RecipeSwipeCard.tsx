import { useState, type ReactElement } from 'react'

import type { FeedItem } from '../types/feed'

const MAX_TAGS = 6

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
  const [imageFailed, setImageFailed] = useState(false)
  const hasImageUrl =
    recipe.image != null && recipe.image.trim() !== ''
  const showImage = hasImageUrl && !imageFailed
  const tags = collectTags(recipe)
  const timeLabel =
    recipe.total_min != null && recipe.total_min > 0
      ? `${recipe.total_min} min`
      : null

  return (
    <article className='recipe-swipe-card' aria-labelledby={`recipe-title-${recipe.id}`}>
      <div className='recipe-swipe-card__media'>
        {showImage
          ? (
            <img
              className='recipe-swipe-card__image'
              src={recipe.image ?? undefined}
              alt=''
              loading='lazy'
              onError={() => {
                setImageFailed(true)
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
        <h2 id={`recipe-title-${recipe.id}`} className='recipe-swipe-card__title'>
          {recipe.name}
        </h2>

        {recipe.description != null && recipe.description.trim() !== '' && (
          <p className='recipe-swipe-card__description'>{recipe.description}</p>
        )}

        {timeLabel != null && (
          <p className='recipe-swipe-card__time'>{timeLabel}</p>
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

      <div className='recipe-swipe-card__actions'>
        <button
          type='button'
          className='recipe-swipe-card__action recipe-swipe-card__action--pass'
          aria-label={`Pass ${recipe.name}`}
          onClick={onPass}
        >
          Pass
        </button>
        <button
          type='button'
          className='recipe-swipe-card__action recipe-swipe-card__action--like'
          aria-label={`Like ${recipe.name}`}
          onClick={onLike}
        >
          Like
        </button>
      </div>
    </article>
  )
}
