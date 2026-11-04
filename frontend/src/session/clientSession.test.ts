// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  SESSION_STORAGE_KEY,
  appendClientRating,
  canGenerateMealPlan,
  ensureClientSession,
  ratedRecipeIds,
  readClientSession
} from './clientSession'

describe('clientSession', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(
      '00000000-0000-4000-8000-000000000001'
    )
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a local anonymous session without a server round trip', () => {
    const created = ensureClientSession()
    expect(created).toEqual({
      id: '00000000-0000-4000-8000-000000000001',
      ratings: []
    })
    expect(readClientSession()).toEqual(created)
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toContain(
      '00000000-0000-4000-8000-000000000001'
    )
  })

  it('reuses the stored session on later calls', () => {
    ensureClientSession()
    vi.mocked(crypto.randomUUID).mockReturnValue(
      '00000000-0000-4000-8000-000000000002'
    )

    expect(ensureClientSession().id).toBe('00000000-0000-4000-8000-000000000001')
    expect(crypto.randomUUID).toHaveBeenCalledTimes(1)
  })

  it('appends the first action for a recipe and ignores retries', () => {
    appendClientRating({ recipeId: 10, action: 'like' })
    const afterRetry = appendClientRating({ recipeId: 10, action: 'pass' })
    appendClientRating({ recipeId: 11, action: 'pass' })

    expect(afterRetry.ratings).toEqual([{ recipeId: 10, action: 'like' }])
    expect(ratedRecipeIds()).toEqual([10, 11])
    expect(readClientSession()?.ratings).toEqual([
      { recipeId: 10, action: 'like' },
      { recipeId: 11, action: 'pass' }
    ])
  })

  it('unlocks meal-plan generation at three likes', () => {
    expect(canGenerateMealPlan([
      { recipeId: 1, action: 'like' },
      { recipeId: 2, action: 'like' },
      { recipeId: 3, action: 'pass' }
    ])).toBe(false)

    expect(canGenerateMealPlan([
      { recipeId: 1, action: 'like' },
      { recipeId: 2, action: 'like' },
      { recipeId: 3, action: 'like' }
    ])).toBe(true)

    expect(canGenerateMealPlan([
      { recipeId: 1, action: 'like' },
      { recipeId: 2, action: 'pass' },
      { recipeId: 3, action: 'like' },
      { recipeId: 4, action: 'pass' },
      { recipeId: 5, action: 'like' }
    ])).toBe(true)
  })
})
