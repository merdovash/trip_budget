import { describe, expect, it } from 'vitest'
import {
  calculateRussiaNdflForPayment,
  calculateRussiaSalaryMonthlyDisplay,
  calculateRussiaSalaryTax,
  monthlyChildDeduction,
} from '../tax/countries/russia'

describe('Russia salary tax', () => {
  it('applies child deductions until income limit', () => {
    expect(monthlyChildDeduction(2, 0)).toBe(2800)
    expect(monthlyChildDeduction(2, 350_000)).toBe(0)
  })

  it('calculates NDFL at 13% with deductions', () => {
    const ndfl = calculateRussiaNdflForPayment(100_000, 0, 2)
    expect(ndfl).toBeCloseTo((100_000 - 2800) * 0.13)
  })

  it('applies 15% rate above annual threshold', () => {
    const ndfl = calculateRussiaNdflForPayment(500_000, 4_800_000, 0)
    expect(ndfl).toBeCloseTo(200_000 * 0.13 + 300_000 * 0.15)
  })

  it('includes employer social contributions in annual summary', () => {
    const result = calculateRussiaSalaryTax(1_200_000, 1)
    expect(result.ndfl).toBeGreaterThan(0)
    expect(result.employerSocialContributions).toBeCloseTo(1_200_000 * 0.302)
    expect(result.netIncome).toBeCloseTo(1_200_000 - result.ndfl)
  })

  it('calculates monthly display with net and employer social', () => {
    const display = calculateRussiaSalaryMonthlyDisplay(
      [
        { amount: 100_000, dayOfMonth: 10 },
        { amount: 50_000, dayOfMonth: 25 },
      ],
      1,
    )
    expect(display).not.toBeNull()
    expect(display!.totalGross).toBe(150_000)
    expect(display!.totalNet).toBeCloseTo(150_000 - display!.totalNdfl)
    expect(display!.employerSocialMonthly).toBeCloseTo((150_000 * 12 * 0.302) / 12)
    expect(display!.payments).toHaveLength(2)
  })
})
