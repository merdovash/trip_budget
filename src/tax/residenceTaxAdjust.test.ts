import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS } from '../types/budget'
import type { RecurringItem } from '../types/budget'
import { calculateSpainEmployedWithForeignSalary } from './residenceTaxAdjust'
import { filterResidenceTaxableIncomes } from './incomeSourceTax'

function income(overrides: Partial<RecurringItem> = {}): RecurringItem {
  return {
    id: '1',
    name: 'Salary',
    amount: 300_000,
    currency: 'RUB',
    frequency: 'monthly',
    categoryId: 'salary',
    salaryCountryCode: 'RU',
    includeInResidenceTax: true,
    foreignTaxCredit: true,
    startDate: '2026-01-01',
    ...overrides,
  }
}

describe('calculateSpainEmployedWithForeignSalary', () => {
  it('applies mínimo personal to combined base with RU salary', () => {
    const items = [
      income(),
      {
        id: '2',
        name: 'Freelance',
        amount: 2000,
        currency: 'EUR',
        frequency: 'monthly' as const,
        categoryId: 'freelance',
        startDate: '2026-01-01',
      },
    ]
    const residence = filterResidenceTaxableIncomes(items)
    const result = calculateSpainEmployedWithForeignSalary(residence, {
      ...DEFAULT_SETTINGS,
      taxRegimeId: 'es-employed',
    })

    expect(result?.foreignSalary?.personalAllowance).toBe(5550)
    expect(result?.foreignSalary?.foreignSalaryGross).toBeGreaterThan(0)
    expect(result?.foreignSalary?.socialOnLocalIncome).toBeGreaterThan(0)
  })

  it('credits russian NDFL against IRPF on foreign salary share', () => {
    const items = [income()]
    const residence = filterResidenceTaxableIncomes(items)
    const result = calculateSpainEmployedWithForeignSalary(residence, {
      ...DEFAULT_SETTINGS,
      taxRegimeId: 'es-employed',
    })

    expect(result?.foreignSalary?.foreignTaxCredit).toBeGreaterThan(0)
    expect(result?.foreignSalary?.sourceTaxInBase).toBeGreaterThan(0)
    expect(result?.result.incomeTax).toBeLessThan(result!.foreignSalary!.irpfGross!)
  })

  it('does not charge SS on foreign salary gross', () => {
    const items = [income({ amount: 500_000 })]
    const residence = filterResidenceTaxableIncomes(items)
    const onlyForeign = calculateSpainEmployedWithForeignSalary(residence, DEFAULT_SETTINGS)

    expect(onlyForeign?.foreignSalary?.localIncomeGross).toBe(0)
    expect(onlyForeign?.foreignSalary?.socialOnLocalIncome).toBe(0)
  })
})
