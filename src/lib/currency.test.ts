import { describe, expect, it, beforeEach } from 'vitest'
import { convertCurrency } from './currency'
import { useExchangeRateStore } from '../store/exchangeRateStore'

describe('convertCurrency fee', () => {
  beforeEach(() => {
    useExchangeRateStore.setState({
      pivotPerUnit: {},
      rateDate: null,
      status: 'idle',
      error: null,
    })
  })

  it('does not change amount when currencies match', () => {
    expect(convertCurrency(100, 'EUR', 'EUR', { feePercent: 2, side: 'expense' })).toBe(100)
  })

  it('marks up expenses and marks down income vs mid rate', () => {
    const mid = convertCurrency(100, 'USD', 'EUR')
    const expense = convertCurrency(100, 'USD', 'EUR', { feePercent: 2, side: 'expense' })
    const income = convertCurrency(100, 'USD', 'EUR', { feePercent: 2, side: 'income' })
    expect(expense).toBeCloseTo(mid * 1.02, 8)
    expect(income).toBeCloseTo(mid * 0.98, 8)
  })

  it('ignores fee for neutral side', () => {
    const mid = convertCurrency(100, 'USD', 'EUR')
    expect(convertCurrency(100, 'USD', 'EUR', { feePercent: 3, side: 'neutral' })).toBeCloseTo(
      mid,
      8,
    )
  })
})
