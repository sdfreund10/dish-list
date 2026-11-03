// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { fetchFeed } from '../api/feed'
import { createSession, fetchSessionState, generateMealPlan, recordRating } from '../api/sessions'
import { resetSwipeSessionCache, SESSION_STORAGE_KEY } from '../hooks/useSwipeSession'
import type { FeedItem } from '../types/feed'
import type { SessionState } from '../types/session'
import { SwipeExperience } from '../swipe/SwipeExperience'
import { HomePage } from './HomePage'
import { MealPlanPage } from './MealPlanPage'

vi.mock('../api/feed', () => ({
  fetchFeed: vi.fn()
}))

vi.mock('../api/sessions', async () => {
  const actual = await vi.importActual<typeof import('../api/sessions')>('../api/sessions')
  return {
    ...actual,
    createSession: vi.fn(),
    fetchSessionState: vi.fn(),
    recordRating: vi.fn(),
    generateMealPlan: vi.fn()
  }
})

const fetchFeedMock = vi.mocked(fetchFeed)
const createSessionMock = vi.mocked(createSession)
const fetchSessionStateMock = vi.mocked(fetchSessionState)
const recordRatingMock = vi.mocked(recordRating)
const generateMealPlanMock = vi.mocked(generateMealPlan)

function lockedState (): SessionState {
  return {
    rating_count: 0,
    like_count: 0,
    liked_recipe_ids: [],
    eligible: false
  }
}

function recipe (id: number): FeedItem {
  return {
    id,
    name: `Recipe ${id}`,
    description: null,
    image: null,
    total_min: null,
    rating: null,
    rating_count: null,
    categories: [],
    keywords: []
  }
}

function renderDeck (): void {
  render(
    <MemoryRouter initialEntries={['/']}>
      <SwipeExperience>
        <Routes>
          <Route path='/' element={<HomePage />} />
          <Route path='/plan' element={<MealPlanPage />} />
        </Routes>
      </SwipeExperience>
    </MemoryRouter>
  )
}

describe('Generate meal plan', () => {
  beforeEach(() => {
    sessionStorage.clear()
    resetSwipeSessionCache()
    fetchFeedMock.mockReset()
    createSessionMock.mockReset()
    fetchSessionStateMock.mockReset()
    recordRatingMock.mockReset()
    generateMealPlanMock.mockReset()
    createSessionMock.mockResolvedValue({
      id: 'session-1',
      state: lockedState()
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('follows backend eligibility and keeps rating after unlock', async () => {
    fetchFeedMock.mockResolvedValueOnce({
      items: [recipe(1), recipe(2), recipe(3)],
      remaining: 0
    })
    recordRatingMock
      .mockResolvedValueOnce({
        recipe_id: 1,
        action: 'like',
        session: {
          rating_count: 7,
          like_count: 7,
          liked_recipe_ids: [1],
          eligible: true
        }
      })
      .mockResolvedValueOnce({
        recipe_id: 2,
        action: 'pass',
        session: {
          rating_count: 8,
          like_count: 7,
          liked_recipe_ids: [1],
          eligible: true
        }
      })

    renderDeck()
    fireEvent.click(await screen.findByRole('button', { name: 'Like Recipe 1' }))

    expect(await screen.findByRole('button', { name: 'Generate meal plan' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Pass Recipe 2' }))
    expect(screen.getByRole('heading', { name: 'Recipe 3' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Generate meal plan' })).toBeTruthy()
    expect(recordRatingMock).toHaveBeenCalledTimes(2)
    expect(generateMealPlanMock).not.toHaveBeenCalled()
  })

  it('does not generate a plan just because the button renders again', async () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'session-1')
    fetchSessionStateMock.mockResolvedValue({
      rating_count: 10,
      like_count: 2,
      liked_recipe_ids: [4, 5],
      eligible: true
    })
    fetchFeedMock.mockResolvedValue({
      items: [recipe(8)],
      remaining: 0
    })

    renderDeck()
    expect(await screen.findByRole('button', { name: 'Generate meal plan' })).toBeTruthy()
    cleanup()
    renderDeck()
    expect(await screen.findByRole('button', { name: 'Generate meal plan' })).toBeTruthy()

    expect(createSessionMock).not.toHaveBeenCalled()
    expect(recordRatingMock).not.toHaveBeenCalled()
    expect(generateMealPlanMock).not.toHaveBeenCalled()
    expect(fetchSessionStateMock).toHaveBeenCalledTimes(2)
  })

  it('opens the generated plan from the swipe deck', async () => {
    fetchFeedMock.mockResolvedValueOnce({
      items: [recipe(1)],
      remaining: 0
    })
    fetchSessionStateMock.mockResolvedValue({
      rating_count: 7,
      like_count: 7,
      liked_recipe_ids: [1, 2, 3],
      eligible: true
    })
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'session-1')
    generateMealPlanMock.mockResolvedValue({
      status: 'generated',
      like_count: 7,
      rating_count: 7,
      recipes: [
        {
          ...recipe(2),
          name: 'Tomato Soup',
          description: 'A bright bowl.',
          image: 'https://example.com/soup.jpg',
          total_min: 30,
          rating: 4,
          rating_count: 120,
          categories: ['Soup'],
          keywords: ['Quick'],
          url: 'https://example.com/recipes/soup',
          author: 'Ada'
        }
      ]
    })

    renderDeck()
    fireEvent.click(await screen.findByRole('button', { name: 'Generate meal plan' }))

    expect(await screen.findByRole('heading', { name: 'Your meal plan' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Tomato Soup' })).toBeTruthy()
    await waitFor(() => {
      expect(generateMealPlanMock).toHaveBeenCalledTimes(1)
    })
    expect(generateMealPlanMock.mock.calls[0]?.[0]).toBe('session-1')
  })
})
