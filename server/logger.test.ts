import { describe, expect, it } from 'vitest'
import { isDbConnectionError, publicErrorMessage } from './logger'

describe('logger helpers', () => {
  it('detects connection refused', () => {
    const err = Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), {
      code: 'ECONNREFUSED',
    })
    expect(isDbConnectionError(err)).toBe(true)
    expect(publicErrorMessage(err).status).toBe(503)
  })

  it('falls back to 500 for unknown errors', () => {
    expect(publicErrorMessage(new Error('boom')).status).toBe(500)
  })
})
