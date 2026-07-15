import type { Frequency, RecurringItem } from '../types/budget'
import { convertCurrency } from '../lib/currency'
import {
  calculateRussiaEmployerSocial,
  calculateRussiaNdflForPayment,
  calculateRussiaSalaryTax,
} from './countries/russia'
import { isRussiaSourceTaxable } from './doubleTaxation'

export const SALARY_SOURCE_COUNTRIES = [{ code: 'RU', label: 'Россия' }] as const
export type SalarySourceCountryCode = (typeof SALARY_SOURCE_COUNTRIES)[number]['code']

function toMonthlyAmount(amount: number, frequency: Frequency): number {
  switch (frequency) {
    case 'monthly':
      return amount
    case 'yearly':
      return amount / 12
    case 'weekly':
      return amount * (52 / 12)
    case 'once':
      return 0
  }
}

export function isRussiaSalary(item: RecurringItem): boolean {
  return item.categoryId === 'salary' && item.salaryCountryCode === 'RU'
}

/** Доход участвует в расчёте налогов страны проживания. */
export function isIncludedInResidenceTax(item: RecurringItem): boolean {
  if (item.includeInResidenceTax !== undefined) {
    return item.includeInResidenceTax
  }
  return !isRussiaSalary(item)
}

export function filterResidenceTaxableIncomes(incomes: RecurringItem[]): RecurringItem[] {
  return incomes.filter(isIncludedInResidenceTax)
}

export function annualGrossInCurrency(
  item: RecurringItem,
  currency: string,
): number {
  const annual =
    item.frequency === 'once' ? item.amount : toMonthlyAmount(item.amount, item.frequency) * 12
  return convertCurrency(annual, item.currency, currency)
}

export function sumAnnualGrossIncomes(
  incomes: RecurringItem[],
  baseCurrency: string,
): number {
  return incomes.reduce((sum, item) => sum + annualGrossInCurrency(item, baseCurrency), 0)
}

export function annualGrossInRub(item: RecurringItem): number {
  return annualGrossInCurrency(item, 'RUB')
}

export interface RussiaYtdTracker {
  byItem: Record<string, number>
}

export function createRussiaYtdTracker(): RussiaYtdTracker {
  return { byItem: {} }
}

function paymentDayMatches(year: number, month: number, day: number, dayOfMonth: number): boolean {
  const daysInMonth = new Date(year, month, 0).getDate()
  return day === Math.min(dayOfMonth, daysInMonth)
}

function isActivePaymentDay(
  item: RecurringItem,
  year: number,
  month: number,
  day: number,
): boolean {
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  if (dateStr < item.startDate) return false
  if (item.endDate && dateStr > item.endDate) return false
  return true
}

function daysBetweenIso(startIso: string, endIso: string): number {
  const start = Date.UTC(
    Number(startIso.slice(0, 4)),
    Number(startIso.slice(5, 7)) - 1,
    Number(startIso.slice(8, 10)),
  )
  const end = Date.UTC(
    Number(endIso.slice(0, 4)),
    Number(endIso.slice(5, 7)) - 1,
    Number(endIso.slice(8, 10)),
  )
  return Math.round((end - start) / 86_400_000)
}

/** Сумма выплаты дохода в исходной валюте в указанный день (0 если не день платежа). */
export function paymentAmountNativeOnDay(
  item: RecurringItem,
  year: number,
  month: number,
  day: number,
): number {
  if (!isActivePaymentDay(item, year, month, day)) return 0

  if (item.payments?.length) {
    return item.payments.reduce((sum, payment) => {
      if (!payment.dayOfMonth || !paymentDayMatches(year, month, day, payment.dayOfMonth)) {
        return sum
      }
      return sum + payment.amount
    }, 0)
  }

  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const startDay = Number(item.startDate.slice(8, 10))
  const startMonth = Number(item.startDate.slice(5, 7))

  switch (item.frequency) {
    case 'monthly':
      return paymentDayMatches(year, month, day, startDay) ? item.amount : 0
    case 'yearly':
      return month === startMonth && paymentDayMatches(year, month, day, startDay)
        ? item.amount
        : 0
    case 'once':
      return dateStr === item.startDate ? item.amount : 0
    case 'weekly':
      return daysBetweenIso(item.startDate, dateStr) % 7 === 0 ? item.amount : 0
    default:
      return 0
  }
}

export function paymentGrossRubOnDay(
  item: RecurringItem,
  year: number,
  month: number,
  day: number,
): number {
  const native = paymentAmountNativeOnDay(item, year, month, day)
  if (native <= 0) return 0
  return convertCurrency(native, item.currency, 'RUB')
}

export function calculateRussiaSourceTaxForPayment(
  item: RecurringItem,
  paymentGrossRub: number,
  dependents: number,
  tracker: RussiaYtdTracker,
): number {
  if (paymentGrossRub <= 0) return 0
  const ytd = tracker.byItem[item.id] ?? 0
  const ndfl = calculateRussiaNdflForPayment(paymentGrossRub, ytd, dependents)
  tracker.byItem[item.id] = ytd + paymentGrossRub
  return ndfl
}

export function summarizeRussiaSalaries(
  incomes: RecurringItem[],
  dependents: number,
): ReturnType<typeof calculateRussiaSalaryTax> | null {
  const ruSalaries = incomes.filter(isRussiaSourceTaxable)
  if (ruSalaries.length === 0) return null

  const grossAnnualRub = ruSalaries.reduce((sum, item) => sum + annualGrossInRub(item), 0)
  return calculateRussiaSalaryTax(grossAnnualRub, dependents)
}

/** YTD-трекер НДФЛ до указанной даты (не включая сам день). */
export function buildRussiaYtdTrackerBeforeDate(
  incomes: RecurringItem[],
  dateStr: string,
  dependents: number,
): RussiaYtdTracker {
  const tracker = createRussiaYtdTracker()
  const { year, month, day } = parseDate(dateStr)

  for (let m = 1; m <= month; m++) {
    const daysInMonth = new Date(year, m, 0).getDate()
    const lastDay = m === month ? day - 1 : daysInMonth
    for (let d = 1; d <= lastDay; d++) {
      const prior = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      russiaSourceNdflRubForDay(incomes, prior, dependents, tracker)
    }
  }

  return tracker
}

export function russiaSourceNdflRubForDay(
  incomes: RecurringItem[],
  dateStr: string,
  dependents: number,
  tracker: RussiaYtdTracker,
): number {
  const { year, month, day } = parseDate(dateStr)
  let total = 0

  for (const item of incomes) {
    if (!isRussiaSourceTaxable(item)) continue
    const grossRub = paymentGrossRubOnDay(item, year, month, day)
    total += calculateRussiaSourceTaxForPayment(item, grossRub, dependents, tracker)
  }

  return total
}

export function russiaSourceTaxForDay(
  incomes: RecurringItem[],
  dateStr: string,
  dependents: number,
  tracker: RussiaYtdTracker,
  baseCurrency: string,
): number {
  const ndflRub = russiaSourceNdflRubForDay(incomes, dateStr, dependents, tracker)
  return convertCurrency(ndflRub, 'RUB', baseCurrency)
}

function parseDate(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number)
  return { year, month, day }
}

export function russiaSourceTaxForMonth(
  incomes: RecurringItem[],
  monthKey: string,
  dependents: number,
  baseCurrency: string,
): number {
  const [year, month] = monthKey.split('-').map(Number)
  const tracker = createRussiaYtdTracker()

  for (let m = 1; m < month; m++) {
    const daysInMonth = new Date(year, m, 0).getDate()
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      russiaSourceTaxForDay(incomes, dateStr, dependents, tracker, baseCurrency)
    }
  }

  let monthTotal = 0
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    monthTotal += russiaSourceTaxForDay(incomes, dateStr, dependents, tracker, baseCurrency)
  }

  return monthTotal
}

export function russiaEmployerSocialAnnualInBase(
  incomes: RecurringItem[],
  baseCurrency: string,
): number {
  const grossRub = incomes
    .filter(isRussiaSourceTaxable)
    .reduce((sum, item) => sum + annualGrossInRub(item), 0)
  if (grossRub === 0) return 0
  return convertCurrency(calculateRussiaEmployerSocial(grossRub), 'RUB', baseCurrency)
}
