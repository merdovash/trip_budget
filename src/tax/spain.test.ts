import { describe, expect, it } from 'vitest'
import {
  buildSpainDigitalNomadSchedule,
  buildSpainEmployeeSchedule,
  calculateSpainDigitalNomadTax,
  calculateSpainEmployeeTax,
  calculateSpainSalaryMonthlyDisplay,
  SPAIN_IRPF_BRACKETS,
} from '../tax/countries/spain'
import { calculateProgressiveTax } from '../tax/types'

const baseInput = { grossAnnualIncome: 60_000, familySize: 2, dependents: 0 }

describe('Spain employee tax', () => {
  it('deducts social contributions before progressive IRPF', () => {
    const result = calculateSpainEmployeeTax(baseInput)
    const ss = Math.min(60_000, 58_914) * 0.0635
    const taxable = Math.max(0, 60_000 - ss - 5_550)
    const expectedIrpf = calculateProgressiveTax(taxable, SPAIN_IRPF_BRACKETS)

    expect(result.socialContributions).toBeCloseTo(ss)
    expect(result.incomeTax).toBeCloseTo(expectedIrpf)
    expect(result.netIncome).toBeCloseTo(60_000 - ss - expectedIrpf)
  })

  it('includes detailed breakdown with bracket lines', () => {
    const result = calculateSpainEmployeeTax(baseInput)
    expect(result.bracketLines?.length).toBeGreaterThan(0)
    expect(result.breakdown.some((item) => item.label.includes('Neto mensual'))).toBe(true)
    expect(result.breakdown.some((item) => item.label.includes('patronal'))).toBe(true)
  })

  it('schedules monthly payroll withholdings', () => {
    const schedule = buildSpainEmployeeSchedule(baseInput, { year: 2026, quarterlyGross: [0, 0, 0, 0] })
    expect(schedule).toHaveLength(12)
    expect(schedule[0].social).toBeGreaterThan(0)
    expect(schedule[0].incomeTax).toBeGreaterThan(0)
    expect(schedule[0].formula).toBeTruthy()
  })

  it('calculates monthly nómina display with SS and IRPF', () => {
    const display = calculateSpainSalaryMonthlyDisplay(
      [
        { id: 'advance', amount: 2000, dayOfMonth: 25 },
        { id: 'payroll', amount: 3000, dayOfMonth: 10 },
      ],
      0,
    )
    expect(display?.totalGross).toBe(5000)
    expect(display?.totalNet).toBeLessThan(display!.totalGross)
    expect(display?.totalSocial).toBeGreaterThan(0)
    expect(display?.totalIrpf).toBeGreaterThan(0)
  })
})

describe('Spain digital nomad tax', () => {
  it('applies expense deduction and SS before progressive scale', () => {
    const result = calculateSpainDigitalNomadTax(baseInput)
    expect(result.socialContributions).toBeGreaterThan(0)
    expect(result.incomeTax).toBeGreaterThan(0)
    expect(result.incomeTax).toBeLessThan(
      calculateProgressiveTax(60_000, SPAIN_IRPF_BRACKETS),
    )
  })

  it('schedules monthly SS and quarterly modelo 130 with formulas', () => {
    const schedule = buildSpainDigitalNomadSchedule(baseInput, {
      year: 2026,
      quarterlyGross: [15_000, 15_000, 15_000, 15_000],
    })

    const april20 = schedule.find((p) => p.month === 4 && p.day === 20)
    const january20 = schedule.find((p) => p.month === 1 && p.day === 20 && p.year === 2027)
    const monthlySS = schedule.filter((p) => p.day === 1 && p.social > 0)

    expect(april20?.incomeTax).toBeGreaterThan(0)
    expect(april20?.formula).toBeTruthy()
    expect(january20?.incomeTax).toBeGreaterThan(0)
    expect(monthlySS).toHaveLength(12)
  })
})
