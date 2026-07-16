import { describe, expect, it } from 'vitest'
import { createId } from './id'

describe('createId', () => {
  it('returns a UUID-shaped string', () => {
    expect(createId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    )
  })

  it('works when crypto.randomUUID is missing (LAN HTTP)', () => {
    const original = crypto.randomUUID
    // @ts-expect-error deliberate removal for non-secure context simulation
    crypto.randomUUID = undefined
    try {
      expect(createId()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      )
    } finally {
      crypto.randomUUID = original
    }
  })
})
