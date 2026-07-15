import type { ExpenseCountryScope, RecurringItem } from '../types/budget'
import { LOAN_EXPENSE_CATEGORY } from '../types/budget'
import { convertCurrency } from './currency'

/** Ежемесячный аннуитетный платёж по формуле: P × r(1+r)^n / ((1+r)^n − 1). */
export function calculateAnnuityPayment(
  principal: number,
  annualRatePercent: number,
  termMonths: number,
): number {
  if (termMonths <= 0) return 0
  if (annualRatePercent <= 0) return principal / termMonths

  const monthlyRate = annualRatePercent / 100 / 12
  const factor = Math.pow(1 + monthlyRate, termMonths)
  return (principal * monthlyRate * factor) / (factor - 1)
}

function parseIsoDate(iso: string): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split('-').map(Number)
  return { year, month, day }
}

function formatIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function isLoanExpense(item: RecurringItem): boolean {
  return item.expenseKind === 'loan'
}

export function getLoanTermMonths(item: RecurringItem): number {
  return item.termMonths ?? 1
}

export function getLoanPrincipal(item: RecurringItem): number {
  return item.principal ?? item.amount
}

export function getLoanAnnualRate(item: RecurringItem): number {
  return item.annualRate ?? 0
}

/** Дата платежа: startDate + paymentIndex месяцев (0 — первый платёж). */
export function getLoanPaymentDate(startDate: string, paymentIndex: number): string {
  const start = parseIsoDate(startDate)
  const targetMonthIndex = start.month - 1 + paymentIndex
  const year = start.year + Math.floor(targetMonthIndex / 12)
  const month = (targetMonthIndex % 12) + 1
  const day = Math.min(start.day, getDaysInMonth(year, month))
  return formatIsoDate(year, month, day)
}

export function getLoanPaymentDates(item: RecurringItem): string[] {
  const termMonths = getLoanTermMonths(item)
  const dates: string[] = []
  for (let i = 0; i < termMonths; i++) {
    dates.push(getLoanPaymentDate(item.startDate, i))
  }
  return dates
}

export function getLoanEndDate(startDate: string, termMonths: number): string {
  const dates = Array.from({ length: termMonths }, (_, i) => getLoanPaymentDate(startDate, i))
  return dates[dates.length - 1] ?? startDate
}

export function loanMonthlyPayment(item: RecurringItem): number {
  return calculateAnnuityPayment(
    getLoanPrincipal(item),
    getLoanAnnualRate(item),
    getLoanTermMonths(item),
  )
}

export function isLoanPaymentOnDay(item: RecurringItem, dateStr: string): boolean {
  if (!isLoanExpense(item) || dateStr < item.startDate) return false
  return getLoanPaymentDates(item).includes(dateStr)
}

export function isLoanPaymentInMonth(item: RecurringItem, monthKey: string): boolean {
  if (!isLoanExpense(item)) return false
  return getLoanPaymentDates(item).some((date) => date.slice(0, 7) === monthKey)
}

/** Выдача кредита — однократное поступление номинала в день startDate. */
export function isLoanDisbursementDay(item: RecurringItem, dateStr: string): boolean {
  return isLoanExpense(item) && dateStr === item.startDate
}

export function isLoanDisbursementInMonth(item: RecurringItem, monthKey: string): boolean {
  return isLoanExpense(item) && item.startDate.slice(0, 7) === monthKey
}

export function loanDisbursementForDay(
  expenses: RecurringItem[],
  dateStr: string,
  baseCurrency: string,
): number {
  return expenses.reduce((sum, item) => {
    if (!isLoanDisbursementDay(item, dateStr)) return sum
    return sum + convertCurrency(getLoanPrincipal(item), item.currency, baseCurrency)
  }, 0)
}

export function loanDisbursementForMonth(
  expenses: RecurringItem[],
  monthKey: string,
  baseCurrency: string,
): number {
  return expenses.reduce((sum, item) => {
    if (!isLoanDisbursementInMonth(item, monthKey)) return sum
    return sum + convertCurrency(getLoanPrincipal(item), item.currency, baseCurrency)
  }, 0)
}

export function buildLoanExpense(
  data: {
    name: string
    principal: number
    currency: string
    termMonths: number
    annualRate: number
    startDate: string
    expenseCountryScope?: ExpenseCountryScope
    folderId?: string
  },
): Omit<RecurringItem, 'id'> {
  const payment = calculateAnnuityPayment(data.principal, data.annualRate, data.termMonths)
  return {
    expenseKind: 'loan',
    name: data.name,
    principal: data.principal,
    currency: data.currency,
    termMonths: data.termMonths,
    annualRate: data.annualRate,
    amount: payment,
    frequency: 'monthly',
    category: LOAN_EXPENSE_CATEGORY,
    startDate: data.startDate,
    endDate: getLoanEndDate(data.startDate, data.termMonths),
    expenseCountryScope: data.expenseCountryScope,
    folderId: data.folderId || undefined,
  }
}

/** Миграция старых кредитов из отдельного массива loans. */
export function migrateLegacyLoan(loan: {
  name: string
  principal: number
  currency: string
  termMonths: number
  annualRate: number
  startDate: string
}): Omit<RecurringItem, 'id'> {
  return buildLoanExpense(loan)
}
