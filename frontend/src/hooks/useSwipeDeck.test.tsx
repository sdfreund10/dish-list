// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchFeed } from '../api/feed'
import { HomePage } from '../pages/HomePage'
import { readClientSession } from '../session/clientSession'
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
    sessionStorage.clear()
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
    expect(readClientSession()?.ratings).toEqual([{ recipeId: 1, action: 'like' }])

    await act(async () => result.current.handlePass())
    expect(result.current.currentRecipe?.id).toBe(3)
    expect(result.current.engagements).toEqual([
      { recipeId: 1, action: 'like' },
      { recipeId: 2, action: 'pass' }
    ])
    expect(readClientSession()?.ratings).toEqual([
      { recipeId: 1, action: 'like' },
      { recipeId: 2, action: 'pass' }
    ])
  })

  it('excludes stored ratings from the first feed page', async () => {
    sessionStorage.setItem(
      'dish-list.session',
      JSON.stringify({
        id: 'session-1',
        ratings: [
          { recipeId: 4, action: 'like' },
          { recipeId: 5, action: 'pass' }
        ]
      })
    )
    fetchFeedMock.mockResolvedValueOnce({
      items: [makeRecipe(6)],
      remaining: 0
    })

    const { result } = renderHook(() => useSwipeDeck())
    await waitFor(() => expect(result.current.currentRecipe?.id).toBe(6))

    expect(fetchFeedMock).toHaveBeenCalledWith({
      limit: SWIPE_DECK_PAGE_SIZE,
      excludeIds: [4, 5],
      signal: expect.any(AbortSignal)
    })
    expect(result.current.engagements).toEqual([
      { recipeId: 4, action: 'like' },
      { recipeId: 5, action: 'pass' }
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
    sessionStorage.clear()
    fetchFeedMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('keeps action focus and ignores the second click of a double-click after advancing', async () => {
    fetchFeedMock.mockResolvedValueOnce({
      items: [makeRecipe(1), makeRecipe(2), makeRecipe(3)],
      remaining: 0
    })

    render(<HomePage />)
    const passButton = await screen.findByRole('button', { name: 'Pass Recipe 1' })
    passButton.focus()
    fireEvent.click(passButton, { detail: 1 })

    const nextPassButton = screen.getByRole('button', { name: 'Pass Recipe 2' })
    expect(document.activeElement).toBe(nextPassButton)
    fireEvent.click(nextPassButton, { detail: 2 })
    expect(screen.getByRole('heading', { name: 'Recipe 2' })).toBeTruthy()

    fireEvent.click(nextPassButton, { detail: 1 })
    expect(screen.getByRole('heading', { name: 'Recipe 3' })).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Pass Recipe 3' }))
  })

  it('shows the next recipe image after the previous image fails', async () => {
    const first = { ...makeRecipe(1), image: 'https://example.com/first.jpg' }
    const next = { ...makeRecipe(2), image: 'https://example.com/next.jpg' }
    fetchFeedMock.mockResolvedValueOnce({ items: [first, next], remaining: 0 })

    render(<HomePage />)
    fireEvent.error(await screen.findByAltText(''))
    expect(screen.getByText('No photo')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: `Pass ${first.name}` }))

    expect(screen.getByRole('heading', { name: next.name })).toBeTruthy()
    expect(screen.getByAltText('').getAttribute('src')).toBe(next.image)
    expect(screen.queryByText('No photo')).toBeNull()
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

  it('shows Generate meal plan after three likes and keeps the deck open', async () => {
    fetchFeedMock.mockResolvedValueOnce({
      items: [
        makeRecipe(1, 'One'),
        makeRecipe(2, 'Two'),
        makeRecipe(3, 'Three'),
        makeRecipe(4, 'Four')
      ],
      remaining: 0
    })

    render(<HomePage />)
    await screen.findByRole('heading', { name: 'One' })
    expect(screen.queryByRole('button', { name: 'Generate meal plan' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Like One' }))
    fireEvent.click(screen.getByRole('button', { name: 'Like Two' }))
    expect(screen.queryByRole('button', { name: 'Generate meal plan' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Like Three' }))
    expect(screen.getByRole('button', { name: 'Generate meal plan' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Four' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Like Four' }))
    expect(screen.getByRole('button', { name: 'Generate meal plan' })).toBeTruthy()
    expect(screen.getByText(/seen all available recipes/i)).toBeTruthy()
  })
})
