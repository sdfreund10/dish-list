// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { ApiError, generateMealPlan } from '../api/sessions'
import { SESSION_STORAGE_KEY } from '../hooks/useSwipeSession'
import type { PlanRecipe } from '../types/session'
import { MealPlanPage } from './MealPlanPage'

vi.mock('../api/sessions', async () => {
  const actual = await vi.importActual<typeof import('../api/sessions')>('../api/sessions')
  return {
    ...actual,
    generateMealPlan: vi.fn()
  }
})

const generateMealPlanMock = vi.mocked(generateMealPlan)

function planRecipe (id: number, name: string): PlanRecipe {
  return {
    id,
    name,
    description: `${name} description`,
    image: `https://example.com/${id}.jpg`,
    total_min: 45,
    rating: 5,
    rating_count: 12,
    categories: ['Dinner'],
    keywords: ['Weeknight'],
    url: `https://example.com/recipes/${id}`,
    author: 'Sam'
  }
}

function renderPlan (generate: boolean): void {
  render(
    <MemoryRouter
      initialEntries={[{
        pathname: '/plan',
        state: generate ? { generate: true } : null
      }]}
    >
      <MealPlanPage />
    </MemoryRouter>
  )
}

describe('MealPlanPage', () => {
  beforeEach(() => {
    sessionStorage.clear()
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'session-1')
    generateMealPlanMock.mockReset()
  })

  afterEach(() => {
    cleanup()
  })

  it('renders selected meals with metadata and source links', async () => {
    generateMealPlanMock.mockResolvedValue({
      status: 'generated',
      like_count: 4,
      rating_count: 10,
      recipes: [planRecipe(1, 'Noodle Bowl'), planRecipe(2, 'Roast Chicken'), planRecipe(3, 'Bean Stew')]
    })

    renderPlan(true)

    expect(await screen.findByRole('heading', { name: 'Noodle Bowl' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Roast Chicken' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Bean Stew' })).toBeTruthy()
    expect(screen.getAllByText('45 min')).toHaveLength(3)
    expect(screen.getAllByText('Sam')).toHaveLength(3)
    expect(screen.getAllByText('Weeknight')).toHaveLength(3)
    expect(screen.getAllByLabelText('Rated 5 out of 5, 12 ratings')).toHaveLength(3)
    const source = screen.getAllByRole('link', { name: 'View recipe' })[0]
    expect(source?.getAttribute('href')).toBe('https://example.com/recipes/1')
    expect(document.querySelector('.meal-plan-card__image')?.getAttribute('src')).toBe(
      'https://example.com/1.jpg'
    )
  })

  it('shows an insufficient-likes result', async () => {
    generateMealPlanMock.mockResolvedValue({
      status: 'insufficient_likes',
      like_count: 2,
      rating_count: 10,
      recipes: []
    })

    renderPlan(true)

    expect(await screen.findByText(/You have 2/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Keep swiping' })).toBeTruthy()
  })

  it('lets the user retry a failed generation', async () => {
    generateMealPlanMock
      .mockRejectedValueOnce(new ApiError(500))
      .mockResolvedValueOnce({
        status: 'generated',
        like_count: 3,
        rating_count: 10,
        recipes: [planRecipe(9, 'Late Salad')]
      })

    renderPlan(true)
    expect(await screen.findByRole('alert')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(await screen.findByRole('heading', { name: 'Late Salad' })).toBeTruthy()
    await waitFor(() => {
      expect(generateMealPlanMock).toHaveBeenCalledTimes(2)
    })
    expect(generateMealPlanMock.mock.calls[0]?.[0]).toBe('session-1')
    expect(generateMealPlanMock.mock.calls[1]?.[0]).toBe('session-1')
  })

  it('explains when generation is not unlocked', async () => {
    generateMealPlanMock.mockRejectedValueOnce(new ApiError(403))

    renderPlan(true)

    expect(await screen.findByText(/Rate a few more recipes/)).toBeTruthy()
  })

  it('asks for the swipe deck when opened directly', async () => {
    renderPlan(false)

    expect(await screen.findByText(/from the swipe deck/)).toBeTruthy()
    expect(generateMealPlanMock).not.toHaveBeenCalled()
  })
})
