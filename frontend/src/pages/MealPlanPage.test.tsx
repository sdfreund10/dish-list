// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { generateMealPlan } from '../api/mealPlan'
import { MEAL_PLAN_STORAGE_KEY } from '../session/clientSession'
import { HomePage } from './HomePage'
import { MealPlanPage } from './MealPlanPage'
import type { MealPlanRecipe } from '../types/mealPlan'

vi.mock('../api/feed', () => ({
  fetchFeed: vi.fn()
}))

vi.mock('../api/mealPlan', () => ({
  generateMealPlan: vi.fn()
}))

const generateMealPlanMock = vi.mocked(generateMealPlan)

function makePlanRecipe (id: number, name?: string): MealPlanRecipe {
  return {
    id,
    name: name ?? `Plan recipe ${id}`,
    description: null,
    image: null,
    total_min: 30,
    rating: 4.5,
    rating_count: 100,
    categories: ['Dinner'],
    keywords: ['Quick'],
    url: `https://example.com/recipes/${id}`,
    author: 'Test Author'
  }
}

function renderPlanRoute (initialPath = '/plan'): void {
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path='/' element={<HomePage />} />
        <Route path='/plan' element={<MealPlanPage />} />
      </Routes>
    </MemoryRouter>
  )
}

describe('MealPlanPage', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    generateMealPlanMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('shows not-ready when fewer than three likes are stored', async () => {
    sessionStorage.setItem(
      'dish-list.session',
      JSON.stringify({
        id: 'session-1',
        ratings: [
          { recipeId: 1, action: 'like' },
          { recipeId: 2, action: 'like' }
        ]
      })
    )

    renderPlanRoute()

    expect(await screen.findByText(/like at least three recipes/i)).toBeTruthy()
    expect(generateMealPlanMock).not.toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'Back to swiping' }).getAttribute('href')).toBe('/')
  })

  it('renders three recipes with source links on success', async () => {
    sessionStorage.setItem(
      'dish-list.session',
      JSON.stringify({
        id: 'session-1',
        ratings: [
          { recipeId: 1, action: 'like' },
          { recipeId: 2, action: 'like' },
          { recipeId: 3, action: 'like' },
          { recipeId: 4, action: 'pass' }
        ]
      })
    )
    generateMealPlanMock.mockResolvedValueOnce({
      status: 'generated',
      recipes: [
        makePlanRecipe(10, 'Monday'),
        makePlanRecipe(11, 'Tuesday'),
        makePlanRecipe(12, 'Wednesday')
      ],
      like_count: 3,
      rating_count: 4
    })

    renderPlanRoute()

    expect(await screen.findByRole('heading', { name: 'Your meal plan' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Monday' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Tuesday' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Wednesday' })).toBeTruthy()

    const links = screen.getAllByRole('link', { name: /view recipe/i })
    expect(links).toHaveLength(3)
    expect(links[0].getAttribute('href')).toBe('https://example.com/recipes/10')

    expect(generateMealPlanMock).toHaveBeenCalledWith(
      [
        { recipeId: 1, action: 'like' },
        { recipeId: 2, action: 'like' },
        { recipeId: 3, action: 'like' },
        { recipeId: 4, action: 'pass' }
      ],
      expect.any(AbortSignal)
    )
    expect(localStorage.getItem(MEAL_PLAN_STORAGE_KEY)).toContain('Monday')
  })

  it('renders a stored meal plan without calling the API', async () => {
    const ratings = [
      { recipeId: 1, action: 'like' as const },
      { recipeId: 2, action: 'like' as const },
      { recipeId: 3, action: 'like' as const }
    ]
    sessionStorage.setItem(
      'dish-list.session',
      JSON.stringify({
        id: 'session-1',
        ratings
      })
    )
    localStorage.setItem(
      MEAL_PLAN_STORAGE_KEY,
      JSON.stringify({
        sessionId: 'session-1',
        ratings,
        recipes: [
          makePlanRecipe(21, 'Cached one'),
          makePlanRecipe(22, 'Cached two'),
          makePlanRecipe(23, 'Cached three')
        ]
      })
    )

    renderPlanRoute()

    expect(await screen.findByRole('heading', { name: 'Cached one' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Cached two' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Cached three' })).toBeTruthy()
    expect(generateMealPlanMock).not.toHaveBeenCalled()
  })

  it('shows error when the API returns insufficient_likes', async () => {
    sessionStorage.setItem(
      'dish-list.session',
      JSON.stringify({
        id: 'session-1',
        ratings: [
          { recipeId: 1, action: 'like' },
          { recipeId: 2, action: 'like' },
          { recipeId: 3, action: 'like' }
        ]
      })
    )
    generateMealPlanMock.mockResolvedValueOnce({
      status: 'insufficient_likes',
      recipes: [],
      like_count: 3,
      rating_count: 3
    })

    renderPlanRoute()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/not enough likes/i)
    expect(screen.getByRole('link', { name: 'Back to swiping' })).toBeTruthy()
  })

  it('shows error when generateMealPlan throws', async () => {
    sessionStorage.setItem(
      'dish-list.session',
      JSON.stringify({
        id: 'session-1',
        ratings: [
          { recipeId: 1, action: 'like' },
          { recipeId: 2, action: 'like' },
          { recipeId: 3, action: 'like' }
        ]
      })
    )
    generateMealPlanMock.mockRejectedValueOnce(new Error('Meal plan request failed with status 500'))

    renderPlanRoute()

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toMatch(/could not generate/i)
  })

  it('does not call POST /sessions', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    sessionStorage.setItem(
      'dish-list.session',
      JSON.stringify({
        id: 'session-1',
        ratings: [
          { recipeId: 1, action: 'like' },
          { recipeId: 2, action: 'like' },
          { recipeId: 3, action: 'like' }
        ]
      })
    )
    generateMealPlanMock.mockResolvedValueOnce({
      status: 'generated',
      recipes: [makePlanRecipe(1), makePlanRecipe(2), makePlanRecipe(3)],
      like_count: 3,
      rating_count: 3
    })

    renderPlanRoute()
    await screen.findByRole('heading', { name: 'Your meal plan' })

    const sessionPosts = fetchSpy.mock.calls.filter(([url, init]) => {
      const path = String(url)
      return path.includes('/sessions') && init?.method === 'POST'
    })
    expect(sessionPosts).toHaveLength(0)

    fetchSpy.mockRestore()
  })
})

describe('HomePage generate CTA', () => {
  beforeEach(() => {
    sessionStorage.clear()
    localStorage.clear()
    generateMealPlanMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('navigates to /plan when Generate meal plan is clicked', async () => {
    const { fetchFeed } = await import('../api/feed')
    const fetchFeedMock = vi.mocked(fetchFeed)
    fetchFeedMock.mockResolvedValueOnce({
      items: [
        { id: 1, name: 'One', description: null, image: null, total_min: null, rating: null, rating_count: null, categories: [], keywords: [] },
        { id: 2, name: 'Two', description: null, image: null, total_min: null, rating: null, rating_count: null, categories: [], keywords: [] },
        { id: 3, name: 'Three', description: null, image: null, total_min: null, rating: null, rating_count: null, categories: [], keywords: [] }
      ],
      remaining: 0
    })
    generateMealPlanMock.mockResolvedValueOnce({
      status: 'generated',
      recipes: [makePlanRecipe(1, 'One'), makePlanRecipe(2, 'Two'), makePlanRecipe(3, 'Three')],
      like_count: 3,
      rating_count: 3
    })

    sessionStorage.setItem(
      'dish-list.session',
      JSON.stringify({
        id: 'session-1',
        ratings: [
          { recipeId: 10, action: 'like' },
          { recipeId: 11, action: 'like' },
          { recipeId: 12, action: 'like' }
        ]
      })
    )

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path='/' element={<HomePage />} />
          <Route path='/plan' element={<MealPlanPage />} />
        </Routes>
      </MemoryRouter>
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Generate meal plan' }))

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Your meal plan' })).toBeTruthy()
    })
  })
})
