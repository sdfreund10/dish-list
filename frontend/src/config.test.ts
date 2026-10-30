import { describe, expect, it } from 'vitest'

import { apiBaseUrl } from './config'

describe('apiBaseUrl', () => {
  it('defaults to the local FastAPI origin', () => {
    expect(apiBaseUrl).toBe('http://localhost:8000')
  })
})
