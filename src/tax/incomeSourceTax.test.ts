import { describe, expect, it } from 'vitest'
import {
  filterResidenceTaxableIncomes,
  isIncludedInResidenceTax,
} from './incomeSourceTax'
import type { RecurringItem } from '../types/budget'

function makeIncome(overrides: Partial<RecurringItem> = {}): RecurringItem {
  return {
    id: '1',
    name: 'Test',
    amount: 1000,
    currency: 'EUR',
    frequency: 'monthly',
    startDate: '2026-01-01',
    ...overrides,
  }
}

describe('isIncludedInResidenceTax', () => {
  it('includes freelance by default', () => {
    const item = makeIncome({ categoryId: 'freelance' })
    expect(isIncludedInResidenceTax(item)).toBe(true)
  })

  it('excludes Russian salary by default', () => {
    const item = makeIncome({ categoryId: 'salary', salaryCountryCode: 'RU' })
    expect(isIncludedInResidenceTax(item)).toBe(false)
  })

  it('respects explicit includeInResidenceTax flag', () => {
    const excludedFreelance = makeIncome({
      categoryId: 'freelance',
      includeInResidenceTax: false,
    })
    const includedRuSalary = makeIncome({
      categoryId: 'salary',
      salaryCountryCode: 'RU',
      includeInResidenceTax: true,
    })

    expect(isIncludedInResidenceTax(excludedFreelance)).toBe(false)
    expect(isIncludedInResidenceTax(includedRuSalary)).toBe(true)
  })
})

describe('filterResidenceTaxableIncomes', () => {
  it('filters incomes by residence tax visibility', () => {
    const incomes = [
      makeIncome({ id: 'a', categoryId: 'freelance' }),
      makeIncome({ id: 'b', categoryId: 'salary', salaryCountryCode: 'RU' }),
      makeIncome({ id: 'c', categoryId: 'rent', includeInResidenceTax: false }),
    ]

    const filtered = filterResidenceTaxableIncomes(incomes)
    expect(filtered.map((i) => i.id)).toEqual(['a'])
  })
})
