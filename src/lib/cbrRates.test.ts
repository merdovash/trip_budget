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
  it('normalizes nominal into rub per unit', () => {
    const { rubPerUnit } = parseCbrResponse(sampleCbr)
    expect(rubPerUnit.RUB).toBe(1)
    expect(rubPerUnit.USD).toBeCloseTo(76.6647)
    expect(rubPerUnit.THB).toBeCloseTo(2.301)
  })
})

describe('convertViaCbr', () => {
  it('converts RUB to EUR using CBR cross rate', () => {
    const { rubPerUnit } = parseCbrResponse(sampleCbr)
    const eur = convertViaCbr(8766.61, 'RUB', 'EUR', rubPerUnit)
    expect(eur).toBeCloseTo(100, 1)
  })

  it('converts USD to EUR via RUB', () => {
    const { rubPerUnit } = parseCbrResponse(sampleCbr)
    const eur = convertViaCbr(100, 'USD', 'EUR', rubPerUnit)
    expect(eur).toBeCloseTo((100 * 76.6647) / 87.6661, 2)
  })

  it('returns null when currency is missing', () => {
    const { rubPerUnit } = parseCbrResponse(sampleCbr)
    expect(convertViaCbr(100, 'MYR', 'EUR', rubPerUnit)).toBeNull()
  })
})
