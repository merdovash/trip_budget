import { describe, expect, it } from 'vitest'
import { convertViaCbr, parseCbrResponse } from './cbrRates'

const sampleCbr = {
  Date: '2026-07-11T11:30:00+03:00',
  Valute: {
    USD: { CharCode: 'USD', Nominal: 1, Value: 76.6647 },
    EUR: { CharCode: 'EUR', Nominal: 1, Value: 87.6661 },
    THB: { CharCode: 'THB', Nominal: 10, Value: 23.01 },
  },
}

describe('parseCbrResponse', () => {
  it('normalizes nominal into pivot units per currency unit', () => {
    const { pivotPerUnit } = parseCbrResponse(sampleCbr)
    expect(pivotPerUnit.RUB).toBe(1)
    expect(pivotPerUnit.USD).toBeCloseTo(76.6647)
    expect(pivotPerUnit.THB).toBeCloseTo(2.301)
  })
})

describe('convertViaCbr', () => {
  it('converts RUB to EUR using CBR cross rate', () => {
    const { pivotPerUnit } = parseCbrResponse(sampleCbr)
    const eur = convertViaCbr(8766.61, 'RUB', 'EUR', pivotPerUnit)
    expect(eur).toBeCloseTo(100, 1)
  })

  it('converts USD to EUR via RUB', () => {
    const { pivotPerUnit } = parseCbrResponse(sampleCbr)
    const eur = convertViaCbr(100, 'USD', 'EUR', pivotPerUnit)
    expect(eur).toBeCloseTo((100 * 76.6647) / 87.6661, 2)
  })

  it('returns null when currency is missing', () => {
    const { pivotPerUnit } = parseCbrResponse(sampleCbr)
    expect(convertViaCbr(100, 'MYR', 'EUR', pivotPerUnit)).toBeNull()
  })
})
