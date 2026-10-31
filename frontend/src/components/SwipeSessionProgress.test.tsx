// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import {
  countSwipeSessionProgress,
  SwipeSessionProgress
} from './SwipeSessionProgress'
import type { SwipeEngagement } from '../hooks/useSwipeDeck'

describe('countSwipeSessionProgress', () => {
  it('returns zero counts for an empty session', () => {
    expect(countSwipeSessionProgress([])).toEqual({ rated: 0, liked: 0 })
  })

  it('counts rated and liked engagements', () => {
    const engagements: SwipeEngagement[] = [
      { recipeId: 1, action: 'like' },
      { recipeId: 2, action: 'pass' },
      { recipeId: 3, action: 'like' }
    ]

    expect(countSwipeSessionProgress(engagements)).toEqual({ rated: 3, liked: 2 })
  })
})

describe('SwipeSessionProgress', () => {
  afterEach(() => {
    cleanup()
  })

  it('renders rated and liked counts from engagements', () => {
    render(
      <SwipeSessionProgress
        engagements={[
          { recipeId: 10, action: 'pass' },
          { recipeId: 11, action: 'like' }
        ]}
      />
    )

    expect(screen.getByText('Rated')).toBeTruthy()
    expect(screen.getByText('Liked')).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
    expect(screen.getByText('1')).toBeTruthy()
  })
})
