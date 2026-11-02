// @vitest-environment jsdom

import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SWIPE_COMMIT_THRESHOLD_PX } from './swipeConstants'
import { RecipeSwipeCard } from './RecipeSwipeCard'
import type { FeedItem } from '../types/feed'

const fullRecipe: FeedItem = {
  id: 1,
  name: 'Creamy Tomato Pasta',
  description: 'A weeknight-friendly skillet pasta.',
  image: 'https://example.com/pasta.jpg',
  total_min: 35,
  rating: 4,
  rating_count: 1284,
  categories: ['Italian', 'Dinner'],
  keywords: ['pasta', 'tomato', 'skillet']
}

const sparseRecipe: FeedItem = {
  id: 2,
  name: 'Plain Toast',
  description: null,
  image: null,
  total_min: null,
  rating: null,
  rating_count: null,
  categories: [],
  keywords: []
}

function mockMatchMedia (matches: boolean): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)' ? matches : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn()
  }))
}

function firePointer (
  surface: Element,
  type: 'pointerDown' | 'pointerMove' | 'pointerUp' | 'pointerCancel' | 'lostPointerCapture',
  clientX: number,
  timeStamp: number
): void {
  const event = createEvent[type](surface, {
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    clientX,
    clientY: 200
  })
  Object.defineProperty(event, 'timeStamp', { value: 1000 + timeStamp })
  fireEvent(surface, event)
}

function dragSwipeSurface (
  surface: Element,
  deltaX: number,
  duration = 240
): void {
  firePointer(surface, 'pointerDown', 200, 0)
  firePointer(surface, 'pointerMove', 200 + deltaX, duration)
  firePointer(surface, 'pointerUp', 200 + deltaX, duration + 10)
}

describe('RecipeSwipeCard', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  beforeEach(() => {
    mockMatchMedia(false)
  })

  it('renders full recipe metadata', () => {
    const { container } = render(
      <RecipeSwipeCard recipe={fullRecipe} onLike={vi.fn()} onPass={vi.fn()} />
    )

    expect(screen.getByRole('heading', { name: fullRecipe.name })).toBeTruthy()
    expect(screen.queryByText('A weeknight-friendly skillet pasta.')).toBeNull()
    expect(screen.getByText('35 min')).toBeTruthy()
    expect(
      screen.getByLabelText('Rated 4 out of 5, 1,284 ratings')
    ).toBeTruthy()
    expect(container.querySelectorAll('.recipe-swipe-card__star--filled')).toHaveLength(4)
    expect(screen.getByText('1,284')).toBeTruthy()
    expect(screen.getByText('pasta')).toBeTruthy()
    expect(screen.getByText('Italian')).toBeTruthy()
    const image = container.querySelector('.recipe-swipe-card__image')
    expect(image?.getAttribute('src')).toBe(fullRecipe.image)
  })

  it('formats cook times of an hour or more', () => {
    render(
      <RecipeSwipeCard
        recipe={{ ...fullRecipe, total_min: 90 }}
        onLike={vi.fn()}
        onPass={vi.fn()}
      />
    )

    expect(screen.getByText('1 hr 30 min')).toBeTruthy()
  })

  it('renders title and actions when optional fields are missing', () => {
    const { container } = render(
      <RecipeSwipeCard recipe={sparseRecipe} onLike={vi.fn()} onPass={vi.fn()} />
    )

    expect(screen.getByRole('heading', { name: sparseRecipe.name })).toBeTruthy()
    expect(container.querySelector('.recipe-swipe-card__image')).toBeNull()
    expect(screen.getByText('No photo')).toBeTruthy()
    expect(container.querySelector('.recipe-swipe-card__time')).toBeNull()
    expect(container.querySelector('.recipe-swipe-card__rating')).toBeNull()
    expect(screen.queryByRole('listitem')).toBeNull()
    expect(screen.getByRole('button', { name: `Like ${sparseRecipe.name}` })).toBeTruthy()
    expect(screen.getByRole('button', { name: `Pass ${sparseRecipe.name}` })).toBeTruthy()
  })

  it('invokes Like and Pass callbacks', () => {
    const onLike = vi.fn()
    const onPass = vi.fn()

    render(
      <RecipeSwipeCard recipe={fullRecipe} onLike={onLike} onPass={onPass} />
    )

    fireEvent.click(screen.getByRole('button', { name: `Like ${fullRecipe.name}` }))
    fireEvent.click(screen.getByRole('button', { name: `Pass ${fullRecipe.name}` }))

    expect(onLike).toHaveBeenCalledTimes(1)
    expect(onPass).toHaveBeenCalledTimes(1)
  })

  it('commits Like when dragged past the swipe threshold to the right', () => {
    const onLike = vi.fn()
    const onPass = vi.fn()
    const { container } = render(
      <RecipeSwipeCard recipe={fullRecipe} onLike={onLike} onPass={onPass} />
    )

    const surface = container.querySelector('.recipe-swipe-card__swipe-surface')
    expect(surface).toBeTruthy()
    dragSwipeSurface(surface as Element, SWIPE_COMMIT_THRESHOLD_PX + 8)

    expect(onLike).toHaveBeenCalledTimes(1)
    expect(onPass).not.toHaveBeenCalled()
  })

  it('commits Pass when dragged past the swipe threshold to the left', () => {
    const onLike = vi.fn()
    const onPass = vi.fn()
    const { container } = render(
      <RecipeSwipeCard recipe={fullRecipe} onLike={onLike} onPass={onPass} />
    )

    const surface = container.querySelector('.recipe-swipe-card__swipe-surface')
    dragSwipeSurface(surface as Element, -(SWIPE_COMMIT_THRESHOLD_PX + 8))

    expect(onPass).toHaveBeenCalledTimes(1)
    expect(onLike).not.toHaveBeenCalled()
  })

  it('does not commit when drag stays below the swipe threshold', () => {
    const onLike = vi.fn()
    const onPass = vi.fn()
    const { container } = render(
      <RecipeSwipeCard recipe={fullRecipe} onLike={onLike} onPass={onPass} />
    )

    const surface = container.querySelector('.recipe-swipe-card__swipe-surface')
    dragSwipeSurface(surface as Element, SWIPE_COMMIT_THRESHOLD_PX - 20)

    expect(onLike).not.toHaveBeenCalled()
    expect(onPass).not.toHaveBeenCalled()
  })

  it('still commits swipe gestures when reduced motion is preferred', () => {
    mockMatchMedia(true)
    const onLike = vi.fn()
    const onPass = vi.fn()
    const { container } = render(
      <RecipeSwipeCard recipe={fullRecipe} onLike={onLike} onPass={onPass} />
    )

    const surface = container.querySelector('.recipe-swipe-card__swipe-surface')
    dragSwipeSurface(surface as Element, SWIPE_COMMIT_THRESHOLD_PX + 4)

    expect(onLike).toHaveBeenCalledTimes(1)
    expect(onPass).not.toHaveBeenCalled()
  })

  it.each([-40, 40])('commits a short deliberate flick of %i pixels once', offset => {
    const onLike = vi.fn()
    const onPass = vi.fn()
    const { container } = render(
      <RecipeSwipeCard recipe={fullRecipe} onLike={onLike} onPass={onPass} />
    )
    const surface = container.querySelector('.recipe-swipe-card__swipe-surface') as Element

    dragSwipeSurface(surface, offset, 40)
    firePointer(surface, 'pointerUp', 200 + offset, 60)

    expect(onLike).toHaveBeenCalledTimes(offset > 0 ? 1 : 0)
    expect(onPass).toHaveBeenCalledTimes(offset < 0 ? 1 : 0)
  })

  it('returns to rest if a short flick is held before release', () => {
    const onLike = vi.fn()
    const onPass = vi.fn()
    const { container } = render(
      <RecipeSwipeCard recipe={fullRecipe} onLike={onLike} onPass={onPass} />
    )
    const surface = container.querySelector('.recipe-swipe-card__swipe-surface') as HTMLElement

    firePointer(surface, 'pointerDown', 200, 0)
    firePointer(surface, 'pointerMove', 240, 40)
    firePointer(surface, 'pointerUp', 240, 200)

    expect(onLike).not.toHaveBeenCalled()
    expect(onPass).not.toHaveBeenCalled()
    expect(surface.style.transform).toBe('')
  })

  it.each(['pointerCancel', 'lostPointerCapture'] as const)('does not commit after %s', eventType => {
    const onLike = vi.fn()
    const onPass = vi.fn()
    const { container } = render(
      <RecipeSwipeCard recipe={fullRecipe} onLike={onLike} onPass={onPass} />
    )
    const surface = container.querySelector('.recipe-swipe-card__swipe-surface') as HTMLElement

    firePointer(surface, 'pointerDown', 200, 0)
    firePointer(surface, 'pointerMove', 340, 100)
    firePointer(surface, eventType, 340, 110)
    firePointer(surface, 'pointerUp', 340, 120)

    expect(onLike).not.toHaveBeenCalled()
    expect(onPass).not.toHaveBeenCalled()
    expect(surface.style.transform).toBe('')
  })

  it('advances immediately while the outgoing visual finishes, then removes it', () => {
    const animations: Array<{ cancel: () => void, onfinish: (() => void) | null }> = []
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      configurable: true,
      value: () => {
        const animation = { cancel: vi.fn(), onfinish: null }
        animations.push(animation)
        return animation
      }
    })

    try {
      const onLike = vi.fn()
      const { container, rerender, unmount } = render(
        <RecipeSwipeCard recipe={fullRecipe} onLike={onLike} onPass={vi.fn()} />
      )
      const surface = container.querySelector('.recipe-swipe-card__swipe-surface') as Element
      dragSwipeSurface(surface, 120)

      expect(onLike).toHaveBeenCalledTimes(1)
      const outgoing = container.querySelector('.recipe-swipe-card__exit') as HTMLElement
      expect(outgoing.getAttribute('aria-hidden')).toBe('true')
      expect(outgoing.inert).toBe(true)
      expect(outgoing.querySelector('[id]')).toBeNull()

      rerender(<RecipeSwipeCard recipe={sparseRecipe} onLike={onLike} onPass={vi.fn()} />)
      expect(screen.getByRole('heading', { name: sparseRecipe.name })).toBeTruthy()
      expect(screen.queryByRole('heading', { name: fullRecipe.name })).toBeNull()

      animations[0].onfinish?.()
      expect(container.querySelector('.recipe-swipe-card__exit')).toBeNull()
      unmount()
    } finally {
      Reflect.deleteProperty(HTMLElement.prototype, 'animate')
    }
  })

  it('exposes accessible names on action buttons', () => {
    render(
      <RecipeSwipeCard recipe={fullRecipe} onLike={vi.fn()} onPass={vi.fn()} />
    )

    const likeButton = screen.getByRole('button', { name: `Like ${fullRecipe.name}` })
    const passButton = screen.getByRole('button', { name: `Pass ${fullRecipe.name}` })

    expect(likeButton.getAttribute('aria-label')).toBe(`Like ${fullRecipe.name}`)
    expect(passButton.getAttribute('aria-label')).toBe(`Pass ${fullRecipe.name}`)
  })
})
