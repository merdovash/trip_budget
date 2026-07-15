import { describe, expect, it } from 'vitest'
import {
  getExpenseCountryScope,
  getExpenseCountryScopeLabel,
  normalizeExpenseCountryScope,
} from './expenseCountry'
import { calculateAnnualResidenceScopeExpenses } from './expenseRemittance'
import type { BudgetSettings, OneTimeExpense, RecurringItem } from '../types/budget'

const baseSettings: BudgetSettings = {
  baseCurrency: 'THB',
  countryCode: 'TH',
  taxRegimeId: 'th-standard',
  familySize: 2,
  dependents: 0,
  horizonMonths: 12,
  initialBalance: 0,
  initialBalanceCurrency: 'THB',
  initialBalanceDate: '2026-01-01',
  relocationDate: '2026-01-01',
  employmentCountryCode: 'RU',
}

describe('expense country scope', () => {
  it('defaults to residence when field is missing', () => {
    const expense: RecurringItem = {
      id: '1',
      name: 'Rent',
      amount: 20_000,
      currency: 'THB',
      frequency: 'monthly',
      startDate: '2026-01-01',
    }
    expect(getExpenseCountryScope(expense, baseSettings)).toBe('residence')
  })

  it('migrates legacy ISO country codes', () => {
    expect(normalizeExpenseCountryScope('TH', baseSettings)).toBe('residence')
    expect(normalizeExpenseCountryScope('RU', baseSettings)).toBe('employment')
    expect(normalizeExpenseCountryScope('ES', baseSettings)).toBe('other')
  })

  it('shows country names in option labels', () => {
    expect(getExpenseCountryScopeLabel('employment', baseSettings)).toBe('Страна заработка (Россия)')
    expect(getExpenseCountryScopeLabel('residence', baseSettings)).toBe('Страна проживания (Таиланд)')
    expect(getExpenseCountryScopeLabel('other', baseSettings)).toBe('Другое')
  })
})

describe('calculateAnnualResidenceScopeExpenses', () => {
  it('sums only residence-scope expenses', () => {
    const residenceExpense: RecurringItem = {
      id: 'th',
      name: 'Rent TH',
      amount: 10_000,
      currency: 'THB',
      frequency: 'monthly',
      expenseCountryScope: 'residence',
      startDate: '2026-01-01',
    }
    const employmentExpense: RecurringItem = {
      id: 'ru',
      name: 'Rent RU',
      amount: 30_000,
      currency: 'THB',
      frequency: 'monthly',
      expenseCountryScope: 'employment',
      startDate: '2026-01-01',
    }
    const oneTime: OneTimeExpense = {
      id: 'ot',
      name: 'Deposit',
      amount: 50_000,
      currency: 'THB',
      date: '2026-03-15',
      expenseCountryScope: 'residence',
    }

    const total = calculateAnnualResidenceScopeExpenses(
      [residenceExpense, employmentExpense],
      [oneTime],
      baseSettings,
    )
    expect(total).toBe(10_000 * 12 + 50_000)
  })
})
