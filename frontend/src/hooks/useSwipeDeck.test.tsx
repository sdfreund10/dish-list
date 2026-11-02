// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchFeed } from '../api/feed'
import { HomePage } from '../pages/HomePage'
import { SWIPE_DECK_PAGE_SIZE, SWIPE_DECK_PREFETCH_THRESHOLD, useSwipeDeck } from './useSwipeDeck'
import type { FeedItem, FeedResponse } from '../types/feed'

vi.mock('../api/feed', () => ({
  fetchFeed: vi.fn()
}))

const fetchFeedMock = vi.mocked(fetchFeed)

function makeRecipe (id: number, name?: string): FeedItem {
  return {
    id,
    name: name ?? `Recipe ${id}`,
    description: null,
    image: null,
    total_min: null,
    rating: null,
    rating_count: null,
    categories: [],
    keywords: []
  }
}

describe('useSwipeDeck', () => {
  beforeEach(() => {
    fetchFeedMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('records Like and Pass once per displayed recipe', async () => {
    fetchFeedMock.mockResolvedValueOnce({
      items: [makeRecipe(1), makeRecipe(2), makeRecipe(3)],
      remaining: 0
    })

    const { result } = renderHook(() => useSwipeDeck())
    await waitFor(() => expect(result.current.currentRecipe?.id).toBe(1))
    const passFirstRecipe = result.current.handlePass

    act(() => {
      result.current.handleLike()
      result.current.handleLike()
    })
    await act(async () => passFirstRecipe())

    expect(result.current.currentRecipe?.id).toBe(2)
    expect(result.current.engagements).toEqual([{ recipeId: 1, action: 'like' }])

    await act(async () => result.current.handlePass())
    expect(result.current.currentRecipe?.id).toBe(3)
    expect(result.current.engagements).toEqual([
      { recipeId: 1, action: 'like' },
      { recipeId: 2, action: 'pass' }
    ])
  })

  it('starts prefetching when swipes bring the queue to the threshold', async () => {
    const recipes = Array.from(
      { length: SWIPE_DECK_PREFETCH_THRESHOLD + 3 },
      (_, index) => makeRecipe(index + 1)
    )
    fetchFeedMock.mockResolvedValueOnce({ items: recipes, remaining: 1 })
    fetchFeedMock.mockResolvedValueOnce({ items: [makeRecipe(100)], remaining: 0 })

    const { result } = renderHook(() => useSwipeDeck())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(fetchFeedMock).toHaveBeenCalledTimes(1)

    await act(async () => result.current.handleLike())
    expect(fetchFeedMock).toHaveBeenCalledTimes(1)

    await act(async () => result.current.handlePass())
    expect(fetchFeedMock).toHaveBeenCalledTimes(2)
    expect(fetchFeedMock).toHaveBeenLastCalledWith({
      limit: SWIPE_DECK_PAGE_SIZE,
      excludeIds: [3, 4, 5, 6, 7, 8, 1, 2]
    })

    for (const recipe of recipes.slice(2)) {
      expect(result.current.currentRecipe?.id).toBe(recipe.id)
      await act(async () => result.current.handlePass())
    }
    expect(result.current.currentRecipe?.id).toBe(100)
    expect(fetchFeedMock).toHaveBeenCalledTimes(2)
  })

  it('records the last swipe immediately while the next page loads', async () => {
    let resolvePage: (page: FeedResponse) => void = () => {}
    fetchFeedMock.mockResolvedValueOnce({ items: [makeRecipe(1)], remaining: 1 })
    fetchFeedMock.mockImplementationOnce(async () => await new Promise(resolve => {
      resolvePage = resolve
    }))

    const { result } = renderHook(() => useSwipeDeck())
    await waitFor(() => expect(fetchFeedMock).toHaveBeenCalledTimes(2))

    act(() => result.current.handleLike())
    expect(result.current.currentRecipe).toBeNull()
    expect(result.current.status).toBe('loading')
    expect(result.current.engagements).toEqual([{ recipeId: 1, action: 'like' }])

    await act(async () => {
      resolvePage({ items: [makeRecipe(2)], remaining: 0 })
    })

    expect(fetchFeedMock).toHaveBeenCalledTimes(2)
    expect(result.current.currentRecipe?.id).toBe(2)
    expect(result.current.engagements).toEqual([{ recipeId: 1, action: 'like' }])
  })

  it('retries a failed prefetch only when the buffer runs dry', async () => {
    fetchFeedMock.mockResolvedValueOnce({
      items: [makeRecipe(1), makeRecipe(2)],
      remaining: 1
    })
    fetchFeedMock.mockRejectedValueOnce(new Error('Prefetch failed'))
    fetchFeedMock.mockResolvedValueOnce({ items: [makeRecipe(3)], remaining: 0 })

    const { result } = renderHook(() => useSwipeDeck())
    await waitFor(() => expect(fetchFeedMock).toHaveBeenCalledTimes(2))

    await act(async () => result.current.handleLike())
    expect(result.current.currentRecipe?.id).toBe(2)
    expect(fetchFeedMock).toHaveBeenCalledTimes(2)

    await act(async () => result.current.handlePass())
    expect(result.current.currentRecipe?.id).toBe(3)
    expect(fetchFeedMock).toHaveBeenCalledTimes(3)
  })

  it('stops fetching on an empty page, even with positive remaining', async () => {
    fetchFeedMock.mockResolvedValueOnce({ items: [makeRecipe(1)], remaining: 1 })
    fetchFeedMock.mockResolvedValueOnce({ items: [], remaining: 5 })

    const { result } = renderHook(() => useSwipeDeck())
    await waitFor(() => expect(fetchFeedMock).toHaveBeenCalledTimes(2))
    expect(result.current.currentRecipe?.id).toBe(1)

    await act(async () => result.current.handlePass())
    expect(result.current.status).toBe('exhausted')
    expect(result.current.currentRecipe).toBeNull()
    expect(fetchFeedMock).toHaveBeenCalledTimes(2)
  })
})

describe('HomePage swipe deck', () => {
  beforeEach(() => {
    fetchFeedMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows exhausted messaging after the deck runs out', async () => {
    fetchFeedMock.mockResolvedValueOnce({
      items: [makeRecipe(7, 'Solo Stew')],
      remaining: 0
    })

    render(<HomePage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Solo Stew' })).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Pass Solo Stew' }))

    await waitFor(() => {
      expect(screen.getByText(/seen all available recipes/i)).toBeTruthy()
    })
  })
})
