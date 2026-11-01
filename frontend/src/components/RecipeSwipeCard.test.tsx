// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
  categories: ['Italian', 'Dinner'],
  keywords: ['pasta', 'tomato', 'skillet']
}

const sparseRecipe: FeedItem = {
  id: 2,
  name: 'Plain Toast',
  description: null,
  image: null,
  total_min: null,
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

function dragSwipeSurface (
  surface: Element,
  deltaX: number
): void {
  const startX = 200
  const startY = 200

  fireEvent.pointerDown(surface, {
    pointerId: 1,
    pointerType: 'mouse',
    button: 0,
    clientX: startX,
    clientY: startY
  })
  fireEvent.pointerMove(surface, {
    pointerId: 1,
    pointerType: 'mouse',
    clientX: startX + deltaX,
    clientY: startY
  })
  fireEvent.pointerUp(surface, {
    pointerId: 1,
    pointerType: 'mouse',
    clientX: startX + deltaX,
    clientY: startY
  })
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
    expect(screen.getByText('A weeknight-friendly skillet pasta.')).toBeTruthy()
    expect(screen.getByText('35 min')).toBeTruthy()
    expect(screen.getByText('pasta')).toBeTruthy()
    expect(screen.getByText('Italian')).toBeTruthy()
    const image = container.querySelector('.recipe-swipe-card__image')
    expect(image?.getAttribute('src')).toBe(fullRecipe.image)
  })

  it('renders title and actions when optional fields are missing', () => {
    const { container } = render(
      <RecipeSwipeCard recipe={sparseRecipe} onLike={vi.fn()} onPass={vi.fn()} />
    )

    expect(screen.getByRole('heading', { name: sparseRecipe.name })).toBeTruthy()
    expect(container.querySelector('.recipe-swipe-card__image')).toBeNull()
    expect(screen.getByText('No photo')).toBeTruthy()
    expect(container.querySelector('.recipe-swipe-card__time')).toBeNull()
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
