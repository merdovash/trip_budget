import { describe, expect, it } from 'vitest'
import {
  computeThailandAllowances,
  calculateThailandPitBreakdown,
  calculateThailandSsoEmployee,
  TH_PERSONAL_ALLOWANCE,
  TH_SPOUSE_ALLOWANCE,
  TH_CHILD_ALLOWANCE,
  TH_EMPLOYMENT_EXPENSE_CAP,
  thailandStandard,
} from './countries/thailand'
import { adjustThailandResidenceTaxResult } from './thailandResidenceTax'
import type { RecurringItem } from '../types/budget'

describe('computeThailandAllowances', () => {
  it('applies employment expense cap and family allowances', () => {
    const allowances = computeThailandAllowances(
      { grossAnnualIncome: 800_000, familySize: 2, dependents: 1 },
      800_000,
    )
    expect(allowances.employmentExpense).toBe(TH_EMPLOYMENT_EXPENSE_CAP)
    expect(allowances.personal).toBe(TH_PERSONAL_ALLOWANCE)
    expect(allowances.spouse).toBe(TH_SPOUSE_ALLOWANCE)
    expect(allowances.children).toBe(TH_CHILD_ALLOWANCE)
    expect(allowances.total).toBe(
      TH_EMPLOYMENT_EXPENSE_CAP + TH_PERSONAL_ALLOWANCE + TH_SPOUSE_ALLOWANCE + TH_CHILD_ALLOWANCE,
    )
  })
})

describe('calculateThailandPitBreakdown', () => {
  it('calculates PIT on taxable base after deductions', () => {
    const breakdown = calculateThailandPitBreakdown(
      800_000,
      { grossAnnualIncome: 800_000, familySize: 2, dependents: 1 },
    )
    expect(breakdown.taxableBaseThb).toBe(550_000)
    expect(breakdown.pitGrossThb).toBeCloseTo(35_000)
  })
})

describe('calculateThailandSsoEmployee', () => {
  it('caps SSO at 10500 THB annually', () => {
    expect(calculateThailandSsoEmployee(2_000_000)).toBe(10_500)
  })
})

describe('adjustThailandResidenceTaxResult with RU salary', () => {
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

  it('produces detailed breakdown with deductions and brackets', () => {
    const settings = {
      baseCurrency: 'THB',
      countryCode: 'TH',
      taxRegimeId: 'th-standard',
      familySize: 2,
      dependents: 1,
      horizonMonths: 12,
      initialBalance: 0,
      initialBalanceCurrency: 'THB',
      initialBalanceDate: '2026-01-01',
    }

    const adjusted = adjustThailandResidenceTaxResult([ruSalary], settings, thailandStandard)
    expect(adjusted.thailandForeignSalary).toBeDefined()
    expect(adjusted.result.breakdown.some((b) => b.kind === 'deduction')).toBe(true)
    expect(adjusted.result.breakdown.some((b) => b.kind === 'bracket')).toBe(true)
  })
})
