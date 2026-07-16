import { describe, expect, it } from 'vitest'
import { getRegimeParamsSchema } from '../config/regimeParams'

describe('getRegimeParamsSchema', () => {
  it('returns Thailand PIT fields for TH PIT regimes', () => {
    const schema = getRegimeParamsSchema('TH', 'th-standard')
    expect(schema).not.toBeNull()
    expect(schema!.title).toContain('Таиланда')
    expect(schema!.fields.length).toBeGreaterThan(0)
  })

  it('returns null for countries without extra params', () => {
    expect(getRegimeParamsSchema('ES', 'es-employed')).toBeNull()
  })
})
