import { describe, expect, it } from 'vitest'
import {
  getEmploymentCountryCode,
  getEmploymentCountryCurrency,
  getRelocationMode,
  shouldShowSourceCountryTaxes,
  suggestTaxRegimeForMode,
} from './relocationMode'
import type { BudgetSettings } from '../types/budget'

const baseSettings: BudgetSettings = {
  baseCurrency: 'EUR',
  countryCode: 'GE',
  taxRegimeId: 'ge-standard',
  familySize: 2,
  dependents: 0,
  horizonMonths: 12,
  initialBalance: 0,
  initialBalanceCurrency: 'EUR',
  initialBalanceDate: '2026-01-01',
  relocationDate: '2026-03-01',
}

describe('relocationMode', () => {
  it('defaults to remote employment in Russia', () => {
    expect(getRelocationMode(baseSettings)).toBe('remote_employment')
    expect(getEmploymentCountryCode(baseSettings)).toBe('RU')
    expect(shouldShowSourceCountryTaxes(baseSettings)).toBe(true)
    expect(getEmploymentCountryCurrency(baseSettings)).toBe('RUB')
  })

  it('suggests small business regime for sole proprietorship in Georgia', () => {
    expect(suggestTaxRegimeForMode('GE', 'sole_proprietorship', 'ge-standard')).toBe(
      'ge-small-business',
    )
  })

  it('hides source country taxes for sole proprietorship', () => {
    expect(
      shouldShowSourceCountryTaxes({ ...baseSettings, relocationMode: 'sole_proprietorship' }),
    ).toBe(false)
  })

  it('derives employment country from salary incomes', () => {
    const incomes = [
      {
        id: '1',
        name: 'Зарплата',
        amount: 1000,
        currency: 'EUR',
        frequency: 'monthly' as const,
        categoryId: 'salary',
        salaryCountryCode: 'ES',
        startDate: '2026-01-01',
      },
    ]
    expect(getEmploymentCountryCode(baseSettings, incomes)).toBe('ES')
    expect(shouldShowSourceCountryTaxes(baseSettings, incomes)).toBe(false)
    expect(
      shouldShowSourceCountryTaxes(baseSettings, [
        { ...incomes[0], salaryCountryCode: 'RU', currency: 'RUB' },
      ]),
    ).toBe(true)
  })
})
