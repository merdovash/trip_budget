/** Россия: НДФЛ с зарплаты и страховые взносы работодателя (упрощённая модель 2025). */

import type { TaxCalculator, TaxInput } from '../types'
import { buildTaxResult } from '../types'

export const RU_NDFL_RATE_STANDARD = 0.13
export const RU_NDFL_RATE_HIGH = 0.15
export const RU_NDFL_HIGH_INCOME_THRESHOLD = 5_000_000
/** Порог дохода, после которого прекращаются вычеты на детей (накопительно за год). */
export const RU_CHILD_DEDUCTION_INCOME_LIMIT = 350_000
export const RU_CHILD_DEDUCTION_FIRST_TWO = 1_400
export const RU_CHILD_DEDUCTION_THIRD_PLUS = 3_000

/** Ставки страховых взносов работодателя (не удерживаются из зарплаты сотрудника). */
export const RU_EMPLOYER_SS_RATE = 0.302
/** Предельная база для взносов (руб./мес. × 12, упрощ.). */
export const RU_SS_ANNUAL_CAP = 2_225_000 * 12

export interface RussiaSalaryTaxResult {
  grossAnnual: number
  childDeductionsAnnual: number
  taxableBase: number
  ndfl: number
  employerSocialContributions: number
  netIncome: number
  breakdown: { label: string; amount: number }[]
}

export function monthlyChildDeduction(dependents: number, ytdGrossRub: number): number {
  if (dependents <= 0 || ytdGrossRub >= RU_CHILD_DEDUCTION_INCOME_LIMIT) return 0
  let total = 0
  if (dependents >= 1) total += RU_CHILD_DEDUCTION_FIRST_TWO
  if (dependents >= 2) total += RU_CHILD_DEDUCTION_FIRST_TWO
  if (dependents >= 3) total += (dependents - 2) * RU_CHILD_DEDUCTION_THIRD_PLUS
  return total
}

/** НДФЛ с одной выплаты с учётом YTD и вычетов на детей. */
export function calculateRussiaNdflForPayment(
  grossPaymentRub: number,
  ytdGrossRubBefore: number,
  dependents: number,
): number {
  const childDeduction = monthlyChildDeduction(dependents, ytdGrossRubBefore)
  const taxablePayment = Math.max(0, grossPaymentRub - childDeduction)
  if (taxablePayment <= 0) return 0

  const ytdTaxableBefore = Math.max(0, ytdGrossRubBefore - childDeduction)

  if (ytdTaxableBefore >= RU_NDFL_HIGH_INCOME_THRESHOLD) {
    return taxablePayment * RU_NDFL_RATE_HIGH
  }

  const roomAtStandard = RU_NDFL_HIGH_INCOME_THRESHOLD - ytdTaxableBefore
  if (taxablePayment <= roomAtStandard) {
    return taxablePayment * RU_NDFL_RATE_STANDARD
  }

  return (
    roomAtStandard * RU_NDFL_RATE_STANDARD +
    (taxablePayment - roomAtStandard) * RU_NDFL_RATE_HIGH
  )
}

export function calculateRussiaEmployerSocial(grossAnnualRub: number): number {
  const base = Math.min(grossAnnualRub, RU_SS_ANNUAL_CAP)
  return base * RU_EMPLOYER_SS_RATE
}

/** Годовой расчёт по зарплате (для сводки). */
export function calculateRussiaSalaryTax(
  grossAnnualRub: number,
  dependents: number,
): RussiaSalaryTaxResult {
  let ytdGross = 0
  let ndfl = 0
  let childDeductionsAnnual = 0
  const monthlyGross = grossAnnualRub / 12

  for (let month = 0; month < 12; month++) {
    const deduction = monthlyChildDeduction(dependents, ytdGross)
    childDeductionsAnnual += deduction
    ndfl += calculateRussiaNdflForPayment(monthlyGross, ytdGross, dependents)
    ytdGross += monthlyGross
  }

  const employerSocialContributions = calculateRussiaEmployerSocial(grossAnnualRub)
  const taxableBase = Math.max(0, grossAnnualRub - childDeductionsAnnual)
  const netIncome = grossAnnualRub - ndfl

  return {
    grossAnnual: grossAnnualRub,
    childDeductionsAnnual,
    taxableBase,
    ndfl,
    employerSocialContributions,
    netIncome,
    breakdown: [
      { label: 'Вычеты на детей (стандартные)', amount: childDeductionsAnnual },
      { label: 'Налоговая база НДФЛ', amount: taxableBase },
      { label: 'НДФЛ (13% / 15%)', amount: ndfl },
      {
        label: 'Страховые взносы работодателя (информ.)',
        amount: employerSocialContributions,
      },
      { label: 'На руки (после НДФЛ)', amount: netIncome },
    ],
  }
}

export interface RussiaSalaryPaymentDisplay {
  id?: string
  gross: number
  ndfl: number
  net: number
  dayOfMonth?: number
}

export interface RussiaSalaryMonthlyDisplay {
  byId: Record<string, RussiaSalaryPaymentDisplay>
  payments: RussiaSalaryPaymentDisplay[]
  totalGross: number
  totalNdfl: number
  totalNet: number
  employerSocialMonthly: number
}

/** Помесячный расчёт для отображения в форме (оценка YTD — середина года). */
export function calculateRussiaSalaryMonthlyDisplay(
  payments: { id?: string; amount: number; dayOfMonth?: number }[],
  dependents: number,
): RussiaSalaryMonthlyDisplay | null {
  const totalGross = payments.reduce((sum, p) => sum + p.amount, 0)
  if (totalGross <= 0) return null

  const ytdBeforeMonth = totalGross * 6
  const sorted = [...payments].sort(
    (a, b) => (a.dayOfMonth ?? 1) - (b.dayOfMonth ?? 1),
  )

  let ytd = ytdBeforeMonth
  const resultPayments: RussiaSalaryPaymentDisplay[] = sorted.map((payment) => {
    const ndfl = calculateRussiaNdflForPayment(payment.amount, ytd, dependents)
    ytd += payment.amount
    return {
      id: payment.id,
      gross: payment.amount,
      ndfl,
      net: payment.amount - ndfl,
      dayOfMonth: payment.dayOfMonth,
    }
  })

  const byId = Object.fromEntries(
    resultPayments
      .filter((p) => p.id)
      .map((p) => [p.id!, p]),
  )

  const totalNdfl = resultPayments.reduce((sum, p) => sum + p.ndfl, 0)
  const employerSocialMonthly = calculateRussiaEmployerSocial(totalGross * 12) / 12

  return {
    byId,
    payments: resultPayments,
    totalGross,
    totalNdfl,
    totalNet: totalGross - totalNdfl,
    employerSocialMonthly,
  }
}

/** Режим проживания в РФ: НДФЛ резидента (13%/15%) с учётом вычетов на детей. */
export const russiaStandard: TaxCalculator = {
  id: 'ru-standard',
  countryCode: 'RU',
  name: 'НДФЛ (резидент)',
  description:
    'Подоходный налог резидента РФ: 13% до 5 млн ₽ и 15% свыше (упрощённо), с вычетами на детей. Взносы работодателя — справочно, не удерживаются из дохода.',
  taxDistribution: 'with_income',
  calculate(input: TaxInput) {
    const result = calculateRussiaSalaryTax(input.grossAnnualIncome, input.dependents)
    return buildTaxResult(input.grossAnnualIncome, result.ndfl, 0, [
      {
        label: 'Вычеты на детей (стандартные)',
        amount: result.childDeductionsAnnual,
        kind: 'deduction',
      },
      { label: 'Налоговая база НДФЛ', amount: result.taxableBase, kind: 'base' },
      { label: 'НДФЛ (13% / 15%)', amount: result.ndfl, kind: 'tax' },
      {
        label: 'Страховые взносы работодателя (информ.)',
        amount: result.employerSocialContributions,
        kind: 'info',
      },
    ])
  },
}
