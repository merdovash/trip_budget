import { describe, expect, it, vi } from 'vitest'
import { convertTaxResultFromBase } from './taxCurrencyDisplay'

vi.mock('./currency', () => ({
  convertCurrency: (amount: number, from: string, to: string) => {
    if (from === to) return amount
    if (from === 'EUR' && to === 'GEL') return amount * 3
    return amount
  },
  isCbrRateUsed: () => true,
}))

describe('convertTaxResultFromBase', () => {
  it('returns same result when currencies match', () => {
    const result = {
      grossIncome: 1000,
      incomeTax: 200,
      socialContributions: 50,
      netIncome: 750,
      effectiveRate: 0.2,
      breakdown: [{ label: 'PIT', amount: 200 }],
    }
    expect(convertTaxResultFromBase(result, 'EUR', 'EUR')).toBe(result)
  })

  it('converts amounts to local currency', () => {
    const result = {
      grossIncome: 100,
      incomeTax: 20,
      socialContributions: 5,
      netIncome: 75,
      effectiveRate: 0.2,
      breakdown: [{ label: 'PIT', amount: 20 }],
    }
    const converted = convertTaxResultFromBase(result, 'EUR', 'GEL')
    expect(converted.incomeTax).toBe(60)
    expect(converted.breakdown[0].amount).toBe(60)
    expect(converted.effectiveRate).toBe(0.2)
  })
})
