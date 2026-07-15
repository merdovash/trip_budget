import { describe, expect, it } from 'vitest'
import {
  computeThailandAllowances,
  calculateThailandPitBreakdown,
  calculateThailandSsoEmployee,
  TH_PERSONAL_ALLOWANCE,
  TH_SPOUSE_ALLOWANCE,
  TH_CHILD_ALLOWANCE,
  TH_EMPLOYMENT_EXPENSE_CAP,
  thailandLtrInvestment,
  thailandProperty3m,
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
    expect(breakdown.taxableBase).toBe(550_000)
    expect(breakdown.pitGross).toBeCloseTo(35_000)
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
      relocationDate: '2026-01-01',
    }

    const thLiving: RecurringItem = {
      id: 'rent',
      name: 'Rent',
      amount: 80_000,
      currency: 'THB',
      frequency: 'monthly',
      expenseCountryScope: 'residence',
      startDate: '2026-01-01',
    }

    const adjusted = adjustThailandResidenceTaxResult(
      [ruSalary],
      settings,
      thailandStandard,
      [thLiving],
      [],
    )
    expect(adjusted.foreignSalary).toBeDefined()
    expect(adjusted.foreignSalary?.sourceTaxInBase).toBeGreaterThan(0)
    expect(adjusted.result.breakdown.some((b) => b.kind === 'deduction')).toBe(true)
    expect(adjusted.result.breakdown.some((b) => b.kind === 'bracket')).toBe(true)
  })

  it('limits foreign salary PIT by remittance from expenses in Thailand', () => {
    const salaryNoCredit: RecurringItem = { ...ruSalary, foreignTaxCredit: false }
    const settings = {
      baseCurrency: 'THB',
      countryCode: 'TH',
      taxRegimeId: 'th-standard',
      familySize: 1,
      dependents: 0,
      horizonMonths: 12,
      initialBalance: 0,
      initialBalanceCurrency: 'THB',
      initialBalanceDate: '2026-01-01',
      relocationDate: '2026-01-01',
    }

    const thLiving: RecurringItem = {
      id: 'rent',
      name: 'Rent',
      amount: 30_000,
      currency: 'THB',
      frequency: 'monthly',
      expenseCountryScope: 'residence',
      startDate: '2026-01-01',
    }

    const withoutExpenses = adjustThailandResidenceTaxResult(
      [salaryNoCredit],
      settings,
      thailandStandard,
      [],
      [],
    )
    const withExpenses = adjustThailandResidenceTaxResult(
      [salaryNoCredit],
      settings,
      thailandStandard,
      [thLiving],
      [],
    )

    expect(withoutExpenses.foreignSalary?.foreignSalaryTaxableGross).toBe(0)
    expect(withoutExpenses.foreignSalary?.pitGross).toBe(0)
    expect(withExpenses.foreignSalary?.remittanceEstimate).toBe(30_000 * 12)
    expect(withExpenses.foreignSalary?.foreignSalaryTaxableGross).toBe(30_000 * 12)
    expect(withExpenses.foreignSalary?.pitGross).toBeGreaterThan(0)
  })
})

describe('Thailand LTR investment regime', () => {
  it('exempts remitted foreign RU salary from PIT under LTR investment', () => {
    const ruSalary: RecurringItem = {
      id: 'ru',
      name: 'Salary RU',
      amount: 200_000,
      currency: 'THB',
      frequency: 'monthly',
      categoryId: 'salary',
      salaryCountryCode: 'RU',
      includeInResidenceTax: true,
      startDate: '2026-01-01',
    }
    const settings = {
      baseCurrency: 'THB',
      countryCode: 'TH',
      taxRegimeId: 'th-ltr-investment',
      familySize: 1,
      dependents: 0,
      horizonMonths: 12,
      initialBalance: 0,
      initialBalanceCurrency: 'THB',
      initialBalanceDate: '2026-01-01',
      relocationDate: '2026-01-01',
    }

    const ltr = adjustThailandResidenceTaxResult([ruSalary], settings, thailandLtrInvestment, [], [])
    expect(ltr.foreignSalary?.foreignSalaryTaxableGross).toBe(0)
    expect(ltr.foreignSalary?.foreignSalaryExcluded).toBe(200_000 * 12)
    expect(ltr.result.incomeTax).toBe(0)
    expect(ltr.result.breakdown.some((line) => line.label.includes('LTR'))).toBe(true)

    const living: RecurringItem = {
      id: 'rent',
      name: 'Rent',
      amount: 50_000,
      currency: 'THB',
      frequency: 'monthly',
      expenseCountryScope: 'residence',
      startDate: '2026-01-01',
    }
    const standardWithRemit = adjustThailandResidenceTaxResult(
      [ruSalary],
      { ...settings, taxRegimeId: 'th-standard' },
      thailandStandard,
      [living],
      [],
    )
    expect(standardWithRemit.foreignSalary?.foreignSalaryTaxableGross).toBeGreaterThan(0)
    expect(standardWithRemit.foreignSalary?.pitGross).toBeGreaterThan(0)
  })
})

describe('Thailand ฿3M property route', () => {
  it('taxes remitted foreign income like standard PIT, unlike LTR', () => {
    const ruSalary: RecurringItem = {
      id: 'ru',
      name: 'Salary RU',
      amount: 200_000,
      currency: 'THB',
      frequency: 'monthly',
      categoryId: 'salary',
      salaryCountryCode: 'RU',
      includeInResidenceTax: true,
      foreignTaxCredit: false,
      startDate: '2026-01-01',
    }
    const living: RecurringItem = {
      id: 'rent',
      name: 'Rent',
      amount: 50_000,
      currency: 'THB',
      frequency: 'monthly',
      expenseCountryScope: 'residence',
      startDate: '2026-01-01',
    }
    const settings = {
      baseCurrency: 'THB',
      countryCode: 'TH',
      taxRegimeId: 'th-property-3m',
      familySize: 1,
      dependents: 0,
      horizonMonths: 12,
      initialBalance: 0,
      initialBalanceCurrency: 'THB',
      initialBalanceDate: '2026-01-01',
      relocationDate: '2026-01-01',
    }

    const property3m = adjustThailandResidenceTaxResult(
      [ruSalary],
      settings,
      thailandProperty3m,
      [living],
      [],
    )
    const ltr = adjustThailandResidenceTaxResult(
      [ruSalary],
      { ...settings, taxRegimeId: 'th-ltr-investment' },
      thailandLtrInvestment,
      [living],
      [],
    )

    expect(property3m.foreignSalary?.foreignSalaryTaxableGross).toBe(50_000 * 12)
    expect(property3m.foreignSalary?.pitGross).toBeGreaterThan(0)
    expect(property3m.result.incomeTax).toBeGreaterThan(0)
    expect(property3m.result.breakdown.some((line) => line.label.includes('฿3M'))).toBe(true)
    expect(ltr.result.incomeTax).toBe(0)
  })
})
