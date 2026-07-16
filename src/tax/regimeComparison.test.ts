import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, type RecurringItem } from '../types/budget'
import { compareRegimesForRoute, compareRegimesForRoutePoint } from './regimeComparison'

const baseSettings = {
  ...DEFAULT_SETTINGS,
  baseCurrency: 'EUR',
  countryCode: 'ES',
  taxRegimeId: 'es-employed',
  relocationMode: 'remote_employment' as const,
  employmentCountryCode: 'RU',
  horizonMonths: 12,
  initialBalanceDate: '2026-01-01',
  residenceRoute: [
    {
      id: 'es1',
      countryCode: 'ES',
      taxRegimeId: 'es-employed',
      startDate: '2026-01-01',
      endDate: '9999-12-31',
    },
  ],
}

const ruSalary: RecurringItem = {
  id: 'salary',
  name: 'Зарплата',
  amount: 300_000,
  currency: 'RUB',
  frequency: 'monthly',
  categoryId: 'salary',
  salaryCountryCode: 'RU',
  includeInResidenceTax: true,
  foreignTaxCredit: true,
  startDate: '2026-01-01',
  payments: [
    { label: 'Аванс', amount: 120_000, dayOfMonth: 25 },
    { label: 'Зарплата', amount: 180_000, dayOfMonth: 10 },
  ],
}

describe('regimeComparison', () => {
  it('returns null for single-regime countries', () => {
    const point = {
      id: 'ae1',
      countryCode: 'AE',
      taxRegimeId: 'ae-none',
      startDate: '2026-01-01',
      endDate: '9999-12-31',
    }
    const result = compareRegimesForRoutePoint(
      point,
      0,
      { ...baseSettings, countryCode: 'AE', taxRegimeId: 'ae-none', residenceRoute: [point] },
      [ruSalary],
    )
    expect(result).toBeNull()
  })

  it('compares Spain regimes and marks a best row', () => {
    const comparison = compareRegimesForRoutePoint(
      baseSettings.residenceRoute[0],
      0,
      baseSettings,
      [ruSalary],
    )
    expect(comparison).not.toBeNull()
    expect(comparison!.rows.length).toBeGreaterThanOrEqual(2)
    expect(comparison!.rows.filter((r) => r.isBest)).toHaveLength(1)
    expect(comparison!.rows.some((r) => r.isSelected)).toBe(true)
    expect(comparison!.years).toContain(2026)
  })

  it('builds comparisons for multi-regime route points only', () => {
    const list = compareRegimesForRoute(baseSettings, [ruSalary])
    expect(list).toHaveLength(1)
    expect(list[0].countryCode).toBe('ES')
  })
})
