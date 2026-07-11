import { describe, expect, it } from 'vitest'
import { calculateProgressiveTax } from '../tax/types'
import { spainBeckham, uaeNoTax } from '../tax/countries'

describe('calculateProgressiveTax', () => {
  it('applies brackets correctly', () => {
    const tax = calculateProgressiveTax(30000, [
      { upTo: 12450, rate: 0.19 },
      { upTo: 20200, rate: 0.24 },
      { upTo: null, rate: 0.3 },
    ])
    expect(tax).toBeCloseTo(12450 * 0.19 + (20200 - 12450) * 0.24 + (30000 - 20200) * 0.3)
  })
})

describe('country tax calculators', () => {
  it('UAE has zero tax', () => {
    const result = uaeNoTax.calculate({ grossAnnualIncome: 100000, familySize: 2, dependents: 0 })
    expect(result.incomeTax).toBe(0)
    expect(result.netIncome).toBe(100000)
  })

  it('Beckham law applies flat rate below threshold', () => {
    const result = spainBeckham.calculate({
      grossAnnualIncome: 100000,
      familySize: 2,
      dependents: 0,
    })
    expect(result.incomeTax).toBeCloseTo(24000)
  })
})
