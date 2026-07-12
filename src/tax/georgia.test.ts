import { describe, expect, it } from 'vitest'
import {
  GE_SMALL_BUSINESS_RATE,
  GE_STANDARD_PIT_RATE,
  georgiaSmallBusiness,
  georgiaStandard,
  georgiaVirtualZone,
} from './countries/georgia'
import { adjustGeorgiaResidenceTaxResult } from './georgiaResidenceTax'
import type { RecurringItem } from '../types/budget'

describe('georgiaStandard', () => {
  it('applies flat 20% PIT', () => {
    const result = georgiaStandard.calculate({
      grossAnnualIncome: 100_000,
      familySize: 1,
      dependents: 0,
    })
    expect(result.incomeTax).toBeCloseTo(100_000 * GE_STANDARD_PIT_RATE)
    expect(result.socialContributions).toBe(0)
  })
})

describe('georgiaSmallBusiness', () => {
  it('applies 1% turnover tax', () => {
    const result = georgiaSmallBusiness.calculate({
      grossAnnualIncome: 200_000,
      familySize: 1,
      dependents: 0,
    })
    expect(result.incomeTax).toBeCloseTo(200_000 * GE_SMALL_BUSINESS_RATE)
  })
})

describe('georgiaVirtualZone', () => {
  it('applies simplified 1% rate', () => {
    const result = georgiaVirtualZone.calculate({
      grossAnnualIncome: 300_000,
      familySize: 1,
      dependents: 0,
    })
    expect(result.incomeTax).toBeCloseTo(3_000)
  })
})

describe('adjustGeorgiaResidenceTaxResult with RU salary', () => {
  const ruSalary: RecurringItem = {
    id: 'ru',
    name: 'RU Salary',
    amount: 500_000,
    currency: 'RUB',
    frequency: 'monthly',
    categoryId: 'salary',
    salaryCountryCode: 'RU',
    includeInResidenceTax: true,
    foreignTaxCredit: true,
    startDate: '2026-01-01',
  }

  it('produces breakdown with foreign salary and credit', () => {
    const settings = {
      baseCurrency: 'GEL',
      countryCode: 'GE',
      taxRegimeId: 'ge-standard',
      familySize: 1,
      dependents: 0,
      horizonMonths: 12,
      initialBalance: 0,
      initialBalanceCurrency: 'GEL',
      initialBalanceDate: '2026-01-01',
    }

    const adjusted = adjustGeorgiaResidenceTaxResult([ruSalary], settings, georgiaStandard)
    expect(adjusted.georgiaForeignSalary).toBeDefined()
    expect(adjusted.georgiaForeignSalary!.foreignSalaryGross).toBeGreaterThan(0)
    expect(adjusted.georgiaForeignSalary!.foreignTaxCredit).toBeGreaterThan(0)
    expect(adjusted.result.incomeTax).toBeLessThan(adjusted.georgiaForeignSalary!.pitGross)
    expect(adjusted.result.breakdown.some((b) => b.label.includes('Зачёт НДФЛ'))).toBe(true)
  })

  it('does not mix when RU salary excluded from residence', () => {
    const excluded: RecurringItem = { ...ruSalary, includeInResidenceTax: false }
    const settings = {
      baseCurrency: 'GEL',
      countryCode: 'GE',
      taxRegimeId: 'ge-standard',
      familySize: 1,
      dependents: 0,
      horizonMonths: 12,
      initialBalance: 0,
      initialBalanceCurrency: 'GEL',
      initialBalanceDate: '2026-01-01',
    }
    const adjusted = adjustGeorgiaResidenceTaxResult([excluded], settings, georgiaStandard)
    expect(adjusted.georgiaForeignSalary).toBeUndefined()
  })
})
