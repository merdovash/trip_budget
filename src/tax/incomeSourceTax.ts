import type { Frequency, RecurringItem } from '../types/budget'
import { convertCurrency } from '../lib/currency'
import {
  calculateRussiaEmployerSocial,
  calculateRussiaNdflForPayment,
  calculateRussiaSalaryTax,
} from './countries/russia'
import { isSourceCountryTaxable } from './doubleTaxation'

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

export function isSalaryFrom(item: RecurringItem, countryCode: string): boolean {
  return item.categoryId === 'salary' && item.salaryCountryCode === countryCode
}

/** Доход участвует в расчёте налогов страны проживания. */
export function isIncludedInResidenceTax(item: RecurringItem): boolean {
  if (item.includeInResidenceTax !== undefined) {
    return item.includeInResidenceTax
  }
  return !isSalaryFrom(item, 'RU')
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

export interface SourceTaxYtdTracker {
  byItem: Record<string, number>
}

export function createSourceTaxYtdTracker(): SourceTaxYtdTracker {
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

export function paymentGrossInTaxCurrencyOnDay(
  item: RecurringItem,
  year: number,
  month: number,
  day: number,
  taxCurrency: string,
): number {
  const native = paymentAmountNativeOnDay(item, year, month, day)
  if (native <= 0) return 0
  return convertCurrency(native, item.currency, taxCurrency)
}

export function calculateSourceTaxForPayment(
  item: RecurringItem,
  paymentGross: number,
  dependents: number,
  tracker: SourceTaxYtdTracker,
): number {
  if (paymentGross <= 0) return 0
  const ytd = tracker.byItem[item.id] ?? 0
  const ndfl = calculateRussiaNdflForPayment(paymentGross, ytd, dependents)
  tracker.byItem[item.id] = ytd + paymentGross
  return ndfl
}

export function summarizeSourceSalaries(
  incomes: RecurringItem[],
  dependents: number,
  sourceCurrency: string,
): ReturnType<typeof calculateRussiaSalaryTax> | null {
  const sourceSalaries = incomes.filter(isSourceCountryTaxable)
  if (sourceSalaries.length === 0) return null

  const grossAnnual = sourceSalaries.reduce(
    (sum, item) => sum + annualGrossInCurrency(item, sourceCurrency),
    0,
  )
  return calculateRussiaSalaryTax(grossAnnual, dependents)
}

/** YTD-трекер НДФЛ до указанной даты (не включая сам день). */
export function buildSourceTaxYtdTrackerBeforeDate(
  incomes: RecurringItem[],
  dateStr: string,
  dependents: number,
  taxCurrency: string,
): SourceTaxYtdTracker {
  const tracker = createSourceTaxYtdTracker()
  const { year, month, day } = parseDate(dateStr)

  for (let m = 1; m <= month; m++) {
    const daysInMonth = new Date(year, m, 0).getDate()
    const lastDay = m === month ? day - 1 : daysInMonth
    for (let d = 1; d <= lastDay; d++) {
      const prior = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      sourceTaxNativeForDay(incomes, prior, dependents, tracker, taxCurrency)
    }
  }

  return tracker
}

export function sourceTaxNativeForDay(
  incomes: RecurringItem[],
  dateStr: string,
  dependents: number,
  tracker: SourceTaxYtdTracker,
  taxCurrency: string,
): number {
  const { year, month, day } = parseDate(dateStr)
  let total = 0

  for (const item of incomes) {
    if (!isSourceCountryTaxable(item)) continue
    const grossNative = paymentGrossInTaxCurrencyOnDay(item, year, month, day, taxCurrency)
    total += calculateSourceTaxForPayment(item, grossNative, dependents, tracker)
  }

  return total
}

export function sourceTaxInBaseForDay(
  incomes: RecurringItem[],
  dateStr: string,
  dependents: number,
  tracker: SourceTaxYtdTracker,
  taxCurrency: string,
  baseCurrency: string,
): number {
  const sourceTaxNative = sourceTaxNativeForDay(
    incomes,
    dateStr,
    dependents,
    tracker,
    taxCurrency,
  )
  return convertCurrency(sourceTaxNative, taxCurrency, baseCurrency)
}

function parseDate(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number)
  return { year, month, day }
}

export function sourceTaxForMonth(
  incomes: RecurringItem[],
  monthKey: string,
  dependents: number,
  taxCurrency: string,
  baseCurrency: string,
): number {
  const [year, month] = monthKey.split('-').map(Number)
  const tracker = createSourceTaxYtdTracker()

  for (let m = 1; m < month; m++) {
    const daysInMonth = new Date(year, m, 0).getDate()
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      sourceTaxInBaseForDay(incomes, dateStr, dependents, tracker, taxCurrency, baseCurrency)
    }
  }

  let monthTotal = 0
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    monthTotal += sourceTaxInBaseForDay(
      incomes,
      dateStr,
      dependents,
      tracker,
      taxCurrency,
      baseCurrency,
    )
  }

  return monthTotal
}

export function sourceEmployerSocialAnnualInBase(
  incomes: RecurringItem[],
  sourceCurrency: string,
  baseCurrency: string,
): number {
  const grossNative = incomes
    .filter(isSourceCountryTaxable)
    .reduce((sum, item) => sum + annualGrossInCurrency(item, sourceCurrency), 0)
  if (grossNative === 0) return 0
  return convertCurrency(
    calculateRussiaEmployerSocial(grossNative),
    sourceCurrency,
    baseCurrency,
  )
}
