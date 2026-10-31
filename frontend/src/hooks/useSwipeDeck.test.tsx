// @vitest-environment jsdom

import { cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fetchFeed } from '../api/feed'
import { HomePage } from '../pages/HomePage'
import { SWIPE_DECK_PAGE_SIZE, useSwipeDeck } from './useSwipeDeck'
import type { FeedItem } from '../types/feed'

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

  it('loads the first page and exposes the first recipe', async () => {
    fetchFeedMock.mockResolvedValueOnce({
      items: [makeRecipe(1), makeRecipe(2)],
      remaining: 0
    })

    const { result } = renderHook(() => useSwipeDeck())

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })

    expect(result.current.currentRecipe?.id).toBe(1)
    expect(fetchFeedMock).toHaveBeenCalledWith(
      expect.objectContaining({ limit: SWIPE_DECK_PAGE_SIZE })
    )
  })

  it('advances to the next recipe on Like once', async () => {
    fetchFeedMock.mockResolvedValueOnce({
      items: [makeRecipe(1), makeRecipe(2), makeRecipe(3)],
      remaining: 0
    })

    const { result } = renderHook(() => useSwipeDeck())

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })

    result.current.handleLike()

    await waitFor(() => {
      expect(result.current.currentRecipe?.id).toBe(2)
    })

    expect(result.current.engagements).toEqual([
      { recipeId: 1, action: 'like' }
    ])
  })

  it('advances to the next recipe on Pass once', async () => {
    fetchFeedMock.mockResolvedValueOnce({
      items: [makeRecipe(10), makeRecipe(11)],
      remaining: 0
    })

    const { result } = renderHook(() => useSwipeDeck())

    await waitFor(() => {
      expect(result.current.currentRecipe?.id).toBe(10)
    })

    result.current.handlePass()

    await waitFor(() => {
      expect(result.current.currentRecipe?.id).toBe(11)
    })

    expect(result.current.engagements).toEqual([
      { recipeId: 10, action: 'pass' }
    ])
  })

  it('does not skip two cards when Like is clicked twice quickly', async () => {
    fetchFeedMock.mockResolvedValueOnce({
      items: [makeRecipe(1), makeRecipe(2), makeRecipe(3)],
      remaining: 0
    })

    const { result } = renderHook(() => useSwipeDeck())

    await waitFor(() => {
      expect(result.current.currentRecipe?.id).toBe(1)
    })

    result.current.handleLike()
    result.current.handleLike()

    await waitFor(() => {
      expect(result.current.currentRecipe?.id).toBe(2)
    })

    expect(result.current.engagements).toHaveLength(1)
  })

  it('prefetches with exclude_ids for recipes already in the session', async () => {
    fetchFeedMock.mockResolvedValueOnce({
      items: [makeRecipe(1), makeRecipe(2), makeRecipe(3)],
      remaining: 10
    })

    fetchFeedMock.mockResolvedValueOnce({
      items: [makeRecipe(100)],
      remaining: 9
    })

    const { result } = renderHook(() => useSwipeDeck())

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })

    await waitFor(() => {
      expect(fetchFeedMock.mock.calls.some((call) => {
        const options = call[0]
        return options?.excludeIds != null && options.excludeIds.length === 3
      })).toBe(true)
    })

    const prefetchCall = fetchFeedMock.mock.calls.find((call) => {
      const options = call[0]
      return options?.excludeIds != null && options.excludeIds.length === 3
    })?.[0]
    expect(prefetchCall?.excludeIds).toEqual([1, 2, 3])
    expect(result.current.currentRecipe?.id).toBe(1)
  })

  it('enters exhausted state after the last recipe is swiped', async () => {
    fetchFeedMock.mockResolvedValueOnce({
      items: [makeRecipe(42)],
      remaining: 0
    })

    const { result } = renderHook(() => useSwipeDeck())

    await waitFor(() => {
      expect(result.current.currentRecipe?.id).toBe(42)
    })

    result.current.handlePass()

    await waitFor(() => {
      expect(result.current.status).toBe('exhausted')
    })

    expect(result.current.currentRecipe).toBeNull()
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

  it('updates session progress counts after Like and Pass', async () => {
    fetchFeedMock.mockResolvedValueOnce({
      items: [makeRecipe(1, 'First'), makeRecipe(2, 'Second')],
      remaining: 0
    })

    render(<HomePage />)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'First' })).toBeTruthy()
    })

    const progress = screen.getByLabelText('Swipe session counts')
    expect(progress.textContent).toContain('0')

    fireEvent.click(screen.getByRole('button', { name: 'Like First' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Second' })).toBeTruthy()
    })

    expect(progress.textContent).toMatch(/Rated\s*1/)
    expect(progress.textContent).toMatch(/Liked\s*1/)

    fireEvent.click(screen.getByRole('button', { name: 'Pass Second' }))

    await waitFor(() => {
      expect(screen.getByText(/seen all available recipes/i)).toBeTruthy()
    })

    expect(progress.textContent).toMatch(/Rated\s*2/)
    expect(progress.textContent).toMatch(/Liked\s*1/)
  })
})
