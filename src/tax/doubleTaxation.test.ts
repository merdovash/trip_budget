import { describe, expect, it } from 'vitest'
import type { RecurringItem } from '../types/budget'
import {
  buildDoubleTaxationLines,
  getIncomeTaxTreatment,
  isRussiaSourceTaxable,
} from './doubleTaxation'

function income(overrides: Partial<RecurringItem> = {}): RecurringItem {
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

describe('double taxation rules', () => {
  it('taxes RU salary at source by default', () => {
    const item = income({ categoryId: 'salary', salaryCountryCode: 'RU' })
    expect(getIncomeTaxTreatment(item)).toBe('source_russia')
    expect(isRussiaSourceTaxable(item)).toBe(true)
  })

  it('taxes RU salary at residence when explicitly included', () => {
    const item = income({
      categoryId: 'salary',
      salaryCountryCode: 'RU',
      includeInResidenceTax: true,
    })
    expect(getIncomeTaxTreatment(item)).toBe('residence')
    expect(isRussiaSourceTaxable(item)).toBe(false)
  })

  it('taxes ES freelance only at residence', () => {
    const item = income({ categoryId: 'freelance' })
    expect(getIncomeTaxTreatment(item)).toBe('residence')
    expect(isRussiaSourceTaxable(item)).toBe(false)
  })

  it('builds per-income treatment lines', () => {
    const lines = buildDoubleTaxationLines([
      income({ id: 'a', name: 'RU', categoryId: 'salary', salaryCountryCode: 'RU' }),
      income({ id: 'b', name: 'ES', categoryId: 'freelance' }),
    ])
    expect(lines.map((line) => line.treatment)).toEqual(['source_russia', 'residence'])
  })
})
