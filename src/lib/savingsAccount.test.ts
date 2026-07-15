import { describe, expect, it } from 'vitest'
import {
  getInitialSavingsBalance,
  isLastDayOfMonth,
  monthlySavingsInterest,
} from './savingsAccount'

describe('savingsAccount', () => {
  it('computes monthly interest from annual rate', () => {
    expect(monthlySavingsInterest(100_000, 12)).toBeCloseTo(1000)
    expect(monthlySavingsInterest(0, 16)).toBe(0)
    expect(monthlySavingsInterest(-1000, 16)).toBe(0)
  })

  it('detects last day of month', () => {
    expect(isLastDayOfMonth('2026-01-31')).toBe(true)
    expect(isLastDayOfMonth('2026-01-30')).toBe(false)
    expect(isLastDayOfMonth('2026-02-28')).toBe(true)
  })

  it('returns initial balance only when currency matches savings account', () => {
    expect(
      getInitialSavingsBalance({
        initialBalance: 50_000,
        initialBalanceCurrency: 'RUB',
        baseCurrency: 'EUR',
        savingsAccountCurrency: 'RUB',
      } as never),
    ).toBe(50_000)
    expect(
      getInitialSavingsBalance({
        initialBalance: 50_000,
        initialBalanceCurrency: 'EUR',
        baseCurrency: 'EUR',
        savingsAccountCurrency: 'RUB',
      } as never),
    ).toBe(0)
  })
})
