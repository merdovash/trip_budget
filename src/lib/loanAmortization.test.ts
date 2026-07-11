import { describe, expect, it } from 'vitest'
import {
  calculateAnnuityPayment,
  getLoanPaymentDate,
  getLoanPaymentDates,
  isLoanPaymentOnDay,
  isLoanPaymentInMonth,
  loanMonthlyPayment,
  buildLoanExpense,
  loanDisbursementForDay,
  isLoanDisbursementDay,
} from './loanAmortization'
import type { RecurringItem } from '../types/budget'

describe('calculateAnnuityPayment', () => {
  it('distributes principal evenly at 0% rate', () => {
    expect(calculateAnnuityPayment(12000, 0, 12)).toBe(1000)
  })

  it('calculates annuity payment with interest', () => {
    const payment = calculateAnnuityPayment(120000, 12, 12)
    expect(payment).toBeCloseTo(10661.85, 1)
  })

  it('supports fractional annual rate', () => {
    const payment = calculateAnnuityPayment(100000, 5.25, 24)
    expect(payment).toBeGreaterThan(100000 / 24)
  })
})

describe('getLoanPaymentDate', () => {
  it('shifts payment day when month has fewer days', () => {
    expect(getLoanPaymentDate('2026-01-31', 1)).toBe('2026-02-28')
  })
})

describe('loan payments in projection', () => {
  const loan: RecurringItem = buildLoanExpense({
    name: 'Ипотека',
    principal: 12000,
    currency: 'EUR',
    termMonths: 3,
    annualRate: 0,
    startDate: '2026-01-15',
  })

  it('generates payment dates for full term', () => {
    expect(getLoanPaymentDates(loan)).toEqual(['2026-01-15', '2026-02-15', '2026-03-15'])
  })

  it('detects payment day', () => {
    expect(isLoanPaymentOnDay(loan, '2026-02-15')).toBe(true)
    expect(isLoanPaymentOnDay(loan, '2026-02-14')).toBe(false)
  })

  it('sums monthly loan payments', () => {
    expect(isLoanPaymentInMonth(loan, '2026-02')).toBe(true)
    expect(loanMonthlyPayment(loan)).toBeCloseTo(4000)
    expect(isLoanPaymentInMonth(loan, '2026-04')).toBe(false)
  })

  it('uses annuity formula for monthly payment', () => {
    expect(
      loanMonthlyPayment(
        buildLoanExpense({
          name: 'x',
          principal: 120000,
          currency: 'EUR',
          termMonths: 12,
          annualRate: 12,
          startDate: '2026-01-01',
        }),
      ),
    ).toBeCloseTo(10661.85, 1)
  })

  it('disburses principal once on start date', () => {
    expect(isLoanDisbursementDay(loan, '2026-01-15')).toBe(true)
    expect(isLoanDisbursementDay(loan, '2026-02-15')).toBe(false)
    expect(loanDisbursementForDay([loan], '2026-01-15', 'EUR')).toBe(12000)
    expect(loanDisbursementForDay([loan], '2026-02-15', 'EUR')).toBe(0)
  })
})
