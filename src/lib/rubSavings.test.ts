import { describe, expect, it } from 'vitest'
import {
  getInitialRubBalance,
  isLastDayOfMonth,
  monthlyRubSavingsInterest,
} from './rubSavings'
import { DEFAULT_SETTINGS } from '../types/budget'

describe('rubSavings', () => {
  it('computes monthly interest on positive balance', () => {
    expect(monthlyRubSavingsInterest(100_000, 12)).toBeCloseTo(1000)
    expect(monthlyRubSavingsInterest(0, 16)).toBe(0)
    expect(monthlyRubSavingsInterest(-1000, 16)).toBe(0)
  })

  it('detects last day of month', () => {
    expect(isLastDayOfMonth('2026-01-31')).toBe(true)
    expect(isLastDayOfMonth('2026-02-28')).toBe(true)
    expect(isLastDayOfMonth('2026-02-27')).toBe(false)
  })

  it('reads initial RUB balance only when currency is RUB', () => {
    expect(
      getInitialRubBalance({
        ...DEFAULT_SETTINGS,
        initialBalance: 50_000,
        initialBalanceCurrency: 'RUB',
      }),
    ).toBe(50_000)
    expect(
      getInitialRubBalance({
        ...DEFAULT_SETTINGS,
        initialBalance: 50_000,
        initialBalanceCurrency: 'EUR',
      }),
    ).toBe(0)
  })
})
