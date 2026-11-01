// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

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

describe('RecipeSwipeCard', () => {
  afterEach(() => {
    cleanup()
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
