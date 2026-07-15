import type {

  BudgetSettings,

  DailySnapshot,

  MonthlySnapshot,

  OneTimeExpense,

  RecurringItem,

} from '../types/budget'

import { FOOD_EXPENSE_CATEGORY } from '../config/foodBudget'
import {
  getEffectiveStartDate,
  isItemActiveInMonth,
  isItemActiveOnDay,
} from '../config/relocationPrograms'
import {
  getResidenceOnDate,
  getResidenceRoute,
  getRouteSegmentsInYear,
  settingsForResidencePoint,
} from '../config/residenceRoute'

import {
  loanMonthlyPayment,
  isLoanExpense,
  isLoanPaymentInMonth,
  isLoanPaymentOnDay,
  isLoanDisbursementDay,
  loanDisbursementForDay,
  loanDisbursementForMonth,
} from '../lib/loanAmortization'
import { convertCurrency } from '../lib/currency'
import { buildDoubleTaxationLines, type DoubleTaxationLine } from '../tax/doubleTaxation'
import { getTaxCalculator } from '../tax/registry'
import {
  adjustResidenceTaxResult,
  computeAnnualTaxBurden,
  type SpainForeignSalaryBreakdown,
} from '../tax/spainForeignSalary'
import type { ScheduledTaxPayment, TaxResult } from '../tax/types'
import { isRussiaSourceTaxable } from '../tax/doubleTaxation'
import {
  createRussiaYtdTracker,
  filterResidenceTaxableIncomes,
  russiaEmployerSocialAnnualInBase,
  russiaSourceNdflRubForDay,
  russiaSourceTaxForMonth,
  summarizeRussiaSalaries,
} from '../tax/incomeSourceTax'
import {
  getInitialRubBalance,
  getRubSavingsAnnualRate,
  isLastDayOfMonth,
  isRubSavingsEnabled,
  monthlyRubSavingsInterest,
} from '../lib/rubSavings'



const WEEKS_PER_MONTH = 52 / 12

const FOOD_DAILY_DIVISOR = 30



export function toMonthlyAmount(amount: number, frequency: RecurringItem['frequency']): number {

  switch (frequency) {

    case 'monthly':

      return amount

    case 'yearly':

      return amount / 12

    case 'weekly':

      return amount * WEEKS_PER_MONTH

    case 'once':

      return 0

  }

}



function toBaseCurrency(amount: number, currency: string, baseCurrency: string): number {

  return convertCurrency(amount, currency, baseCurrency)

}



function parseIsoDate(iso: string): { year: number; month: number; day: number } {

  const [year, month, day] = iso.split('-').map(Number)

  return { year, month, day }

}



export function getDaysInMonth(year: number, month: number): number {

  return new Date(year, month, 0).getDate()

}



export function isFoodExpense(item: RecurringItem): boolean {

  return item.category === FOOD_EXPENSE_CATEGORY

}



/** Месячная сумма «Еды»: сумма/30 × число дней в месяце. */

export function foodMonthlyAmount(monthlyAmount: number, monthKey: string): number {

  const { year, month } = parseIsoDate(`${monthKey}-01`)

  return (monthlyAmount / FOOD_DAILY_DIVISOR) * getDaysInMonth(year, month)

}



export function foodDailyAmount(monthlyAmount: number): number {

  return monthlyAmount / FOOD_DAILY_DIVISOR

}



function isActiveInMonth(item: RecurringItem, monthKey: string, settings: BudgetSettings): boolean {
  return isItemActiveInMonth(item, monthKey, settings)
}

function isActiveOnDay(item: RecurringItem, dateStr: string, settings: BudgetSettings): boolean {
  return isItemActiveOnDay(item, dateStr, settings)
}



function daysBetween(startIso: string, endIso: string): number {

  const start = parseIsoDate(startIso)

  const end = parseIsoDate(endIso)

  const startMs = Date.UTC(start.year, start.month - 1, start.day)

  const endMs = Date.UTC(end.year, end.month - 1, end.day)

  return Math.round((endMs - startMs) / 86_400_000)

}



function paymentDayMatches(year: number, month: number, day: number, dayOfMonth: number): boolean {

  return day === Math.min(dayOfMonth, getDaysInMonth(year, month))

}



function scheduledDayOfMonth(item: RecurringItem, settings: BudgetSettings): number {
  return parseIsoDate(getEffectiveStartDate(item, settings)).day
}



function scheduledDayMatches(
  year: number,
  month: number,
  day: number,
  item: RecurringItem,
  settings: BudgetSettings,
): boolean {
  return paymentDayMatches(year, month, day, scheduledDayOfMonth(item, settings))
}

function yearlyDayMatches(dateStr: string, item: RecurringItem, settings: BudgetSettings): boolean {
  const current = parseIsoDate(dateStr)
  const start = parseIsoDate(getEffectiveStartDate(item, settings))

  const effectiveStartDay = Math.min(start.day, getDaysInMonth(current.year, start.month))

  return current.month === start.month && current.day === effectiveStartDay

}



export function generateMonthKeys(startDate: Date, count: number): string[] {

  const keys: string[] = []

  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1)

  for (let i = 0; i < count; i++) {

    const year = cursor.getFullYear()

    const month = String(cursor.getMonth() + 1).padStart(2, '0')

    keys.push(`${year}-${month}`)

    cursor.setMonth(cursor.getMonth() + 1)

  }

  return keys

}



export function generateDayKeys(startDate: Date, horizonMonths: number): string[] {

  const keys: string[] = []

  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())

  const end = new Date(cursor.getFullYear(), cursor.getMonth() + horizonMonths, 0)



  while (cursor <= end) {

    const year = cursor.getFullYear()

    const month = String(cursor.getMonth() + 1).padStart(2, '0')

    const day = String(cursor.getDate()).padStart(2, '0')

    keys.push(`${year}-${month}-${day}`)

    cursor.setDate(cursor.getDate() + 1)

  }



  return keys

}



function recurringAmountForMonth(
  item: RecurringItem,
  monthKey: string,
): number {
  if (isLoanExpense(item)) {
    return isLoanPaymentInMonth(item, monthKey) ? loanMonthlyPayment(item) : 0
  }
  if (item.frequency === 'once') return item.amount
  if (isFoodExpense(item) && item.frequency === 'monthly') {
    return foodMonthlyAmount(item.amount, monthKey)
  }
  return toMonthlyAmount(item.amount, item.frequency)
}

function sumRecurringForMonth(
  items: RecurringItem[],
  monthKey: string,
  baseCurrency: string,
  settings: BudgetSettings,
): number {
  return items.reduce((sum, item) => {
    if (item.frequency === 'once') return sum
    if (!isActiveInMonth(item, monthKey, settings)) return sum
    const amount = recurringAmountForMonth(item, monthKey)
    return sum + toBaseCurrency(amount, item.currency, baseCurrency)
  }, 0)
}

function sumOnceExpensesForMonth(
  items: RecurringItem[],
  monthKey: string,
  baseCurrency: string,
  settings: BudgetSettings,
): number {
  return items.reduce((sum, item) => {
    if (item.frequency !== 'once') return sum
    if (!isActiveInMonth(item, monthKey, settings)) return sum
    return sum + toBaseCurrency(item.amount, item.currency, baseCurrency)
  }, 0)
}



function sumOneTimeForMonth(

  items: OneTimeExpense[],

  monthKey: string,

  baseCurrency: string,

): number {

  return items

    .filter((item) => item.date.slice(0, 7) === monthKey)

    .reduce((sum, item) => sum + toBaseCurrency(item.amount, item.currency, baseCurrency), 0)

}



function sumOneTimeForDay(

  items: OneTimeExpense[],

  dateStr: string,

  baseCurrency: string,

): number {

  return items

    .filter((item) => item.date === dateStr)

    .reduce((sum, item) => sum + toBaseCurrency(item.amount, item.currency, baseCurrency), 0)

}



function incomeForDay(
  items: RecurringItem[],
  dateStr: string,
  baseCurrency: string,
  settings: BudgetSettings,
): number {
  const { year, month, day } = parseIsoDate(dateStr)
  const effectiveStart = (item: RecurringItem) => getEffectiveStartDate(item, settings)

  return items.reduce((sum, item) => {
    if (!isActiveOnDay(item, dateStr, settings)) return sum



    if (item.payments && item.payments.length > 0) {

      const dayAmount = item.payments.reduce((paymentSum, payment) => {

        if (!payment.dayOfMonth || !paymentDayMatches(year, month, day, payment.dayOfMonth)) {

          return paymentSum

        }

        return paymentSum + payment.amount

      }, 0)

      return sum + toBaseCurrency(dayAmount, item.currency, baseCurrency)

    }



    let amount = 0

    switch (item.frequency) {

      case 'monthly':

        if (scheduledDayMatches(year, month, day, item, settings)) amount = item.amount

        break

      case 'weekly':

        if (daysBetween(effectiveStart(item), dateStr) % 7 === 0) amount = item.amount

        break

      case 'yearly':

        if (yearlyDayMatches(dateStr, item, settings)) amount = item.amount

        break

      case 'once':

        if (dateStr === effectiveStart(item)) amount = item.amount

        break

    }



    return sum + toBaseCurrency(amount, item.currency, baseCurrency)

  }, 0)

}



function expenseForDay(

  items: RecurringItem[],

  dateStr: string,

  baseCurrency: string,

  settings: BudgetSettings,

): number {

  const { year, month, day } = parseIsoDate(dateStr)

  const effectiveStart = (item: RecurringItem) => getEffectiveStartDate(item, settings)



  return items.reduce((sum, item) => {

    if (!isActiveOnDay(item, dateStr, settings)) return sum



    if (isLoanExpense(item)) {

      if (isLoanPaymentOnDay(item, dateStr)) {

        return sum + toBaseCurrency(loanMonthlyPayment(item), item.currency, baseCurrency)

      }

      return sum

    }



    if (isFoodExpense(item) && item.frequency === 'monthly') {

      return sum + toBaseCurrency(foodDailyAmount(item.amount), item.currency, baseCurrency)

    }



    let amount = 0

    switch (item.frequency) {

      case 'monthly':

        if (scheduledDayMatches(year, month, day, item, settings)) amount = item.amount

        break

      case 'weekly':

        if (daysBetween(effectiveStart(item), dateStr) % 7 === 0) amount = item.amount

        break

      case 'yearly':

        if (yearlyDayMatches(dateStr, item, settings)) amount = item.amount

        break

      case 'once':

        break

    }



    return sum + toBaseCurrency(amount, item.currency, baseCurrency)

  }, 0)

}

function onceExpensesForDay(
  items: RecurringItem[],
  dateStr: string,
  baseCurrency: string,
  settings: BudgetSettings,
): number {
  return items.reduce((sum, item) => {
    if (item.frequency !== 'once') return sum
    if (!isActiveOnDay(item, dateStr, settings)) return sum
    if (dateStr !== getEffectiveStartDate(item, settings)) return sum
    return sum + toBaseCurrency(item.amount, item.currency, baseCurrency)
  }, 0)
}

/** Сумма статьи дохода в исходной валюте за день (0 если не в этот день). */
function incomeAmountNativeForDay(
  item: RecurringItem,
  dateStr: string,
  settings: BudgetSettings,
): number {
  if (!isActiveOnDay(item, dateStr, settings)) return 0
  const { year, month, day } = parseIsoDate(dateStr)

  if (item.payments && item.payments.length > 0) {
    return item.payments.reduce((paymentSum, payment) => {
      if (!payment.dayOfMonth || !paymentDayMatches(year, month, day, payment.dayOfMonth)) {
        return paymentSum
      }
      return paymentSum + payment.amount
    }, 0)
  }

  switch (item.frequency) {
    case 'monthly':
      return scheduledDayMatches(year, month, day, item, settings) ? item.amount : 0
    case 'weekly':
      return daysBetween(getEffectiveStartDate(item, settings), dateStr) % 7 === 0 ? item.amount : 0
    case 'yearly':
      return yearlyDayMatches(dateStr, item, settings) ? item.amount : 0
    case 'once':
      return dateStr === getEffectiveStartDate(item, settings) ? item.amount : 0
    default:
      return 0
  }
}

function expenseAmountNativeForDay(
  item: RecurringItem,
  dateStr: string,
  settings: BudgetSettings,
): number {
  if (isLoanExpense(item)) {
    if (isLoanPaymentOnDay(item, dateStr)) return loanMonthlyPayment(item)
    return 0
  }
  if (!isActiveOnDay(item, dateStr, settings)) return 0
  if (item.frequency === 'once') {
    return dateStr === getEffectiveStartDate(item, settings) ? item.amount : 0
  }
  if (isFoodExpense(item) && item.frequency === 'monthly') {
    return foodDailyAmount(item.amount)
  }
  const { year, month, day } = parseIsoDate(dateStr)
  switch (item.frequency) {
    case 'monthly':
      return scheduledDayMatches(year, month, day, item, settings) ? item.amount : 0
    case 'weekly':
      return daysBetween(getEffectiveStartDate(item, settings), dateStr) % 7 === 0 ? item.amount : 0
    case 'yearly':
      return yearlyDayMatches(dateStr, item, settings) ? item.amount : 0
    default:
      return 0
  }
}

/** Чистый рублёвый поток дня: доходы − расходы + выдача кредита (до НДФЛ). */
function rubNetCashflowBeforeNdflForDay(
  incomes: RecurringItem[],
  expenses: RecurringItem[],
  oneTimeExpenses: OneTimeExpense[],
  dateStr: string,
  settings: BudgetSettings,
): number {
  let net = 0
  for (const item of incomes) {
    if (item.currency !== 'RUB') continue
    net += incomeAmountNativeForDay(item, dateStr, settings)
  }
  for (const item of expenses) {
    if (item.currency !== 'RUB') continue
    if (isLoanExpense(item) && isLoanDisbursementDay(item, dateStr)) {
      net += item.principal ?? item.amount
    }
    net -= expenseAmountNativeForDay(item, dateStr, settings)
  }
  for (const item of oneTimeExpenses) {
    if (item.currency !== 'RUB' || item.date !== dateStr) continue
    net -= item.amount
  }
  return net
}

function accrueRubSavingsInterestForDay(
  rubBalance: number,
  dateStr: string,
  settings: BudgetSettings,
): { interestRub: number; interestBase: number; nextRubBalance: number } {
  if (!isRubSavingsEnabled(settings) || !isLastDayOfMonth(dateStr)) {
    return { interestRub: 0, interestBase: 0, nextRubBalance: rubBalance }
  }
  const interestRub = monthlyRubSavingsInterest(rubBalance, getRubSavingsAnnualRate(settings))
  return {
    interestRub,
    interestBase: toBaseCurrency(interestRub, 'RUB', settings.baseCurrency),
    nextRubBalance: rubBalance + interestRub,
  }
}

export type DayLedgerKind =
  | 'income'
  | 'expense'
  | 'once'
  | 'food'
  | 'loan_payment'
  | 'loan_disbursement'
  | 'savings_interest'

export interface DayLedgerLine {
  id: string
  name: string
  kind: DayLedgerKind
  amountInBase: number
  currency: string
  amountOriginal: number
  detail?: string
}

export interface DayLedger {
  date: string
  incomes: DayLedgerLine[]
  expenses: DayLedgerLine[]
  inflows: DayLedgerLine[]
  incomeTotal: number
  expenseTotal: number
  inflowTotal: number
}

export interface DayLedgerOptions {
  /** Уже посчитанные проценты накопительного счёта за день (из daily snapshot). */
  savingsInterestInBase?: number
}

/** Разбивка доходов и расходов на конкретный день (статьи для клика по графику). */
export function getDayLedger(
  incomes: RecurringItem[],
  expenses: RecurringItem[],
  oneTimeExpenses: OneTimeExpense[],
  dateStr: string,
  settings: BudgetSettings,
  options: DayLedgerOptions = {},
): DayLedger {
  const baseCurrency = settings.baseCurrency
  const { year, month, day } = parseIsoDate(dateStr)
  const incomeLines: DayLedgerLine[] = []
  const expenseLines: DayLedgerLine[] = []
  const inflowLines: DayLedgerLine[] = []

  for (const item of incomes) {
    if (!isActiveOnDay(item, dateStr, settings)) continue

    if (item.payments && item.payments.length > 0) {
      for (const payment of item.payments) {
        if (!payment.dayOfMonth || !paymentDayMatches(year, month, day, payment.dayOfMonth)) {
          continue
        }
        incomeLines.push({
          id: `${item.id}:${payment.label}`,
          name: item.name,
          kind: 'income',
          amountOriginal: payment.amount,
          currency: item.currency,
          amountInBase: toBaseCurrency(payment.amount, item.currency, baseCurrency),
          detail: payment.label,
        })
      }
      continue
    }

    let amount = 0
    switch (item.frequency) {
      case 'monthly':
        if (scheduledDayMatches(year, month, day, item, settings)) amount = item.amount
        break
      case 'weekly':
        if (daysBetween(getEffectiveStartDate(item, settings), dateStr) % 7 === 0) amount = item.amount
        break
      case 'yearly':
        if (yearlyDayMatches(dateStr, item, settings)) amount = item.amount
        break
      case 'once':
        if (dateStr === getEffectiveStartDate(item, settings)) amount = item.amount
        break
    }
    if (amount > 0) {
      incomeLines.push({
        id: item.id,
        name: item.name,
        kind: 'income',
        amountOriginal: amount,
        currency: item.currency,
        amountInBase: toBaseCurrency(amount, item.currency, baseCurrency),
      })
    }
  }

  for (const item of expenses) {
    if (isLoanExpense(item) && isLoanDisbursementDay(item, dateStr)) {
      const principal = item.principal ?? item.amount
      inflowLines.push({
        id: `${item.id}:disbursement`,
        name: item.name,
        kind: 'loan_disbursement',
        amountOriginal: principal,
        currency: item.currency,
        amountInBase: toBaseCurrency(principal, item.currency, baseCurrency),
        detail: 'Выдача кредита',
      })
    }

    if (!isActiveOnDay(item, dateStr, settings)) continue

    if (isLoanExpense(item)) {
      if (isLoanPaymentOnDay(item, dateStr)) {
        const payment = loanMonthlyPayment(item)
        expenseLines.push({
          id: `${item.id}:payment`,
          name: item.name,
          kind: 'loan_payment',
          amountOriginal: payment,
          currency: item.currency,
          amountInBase: toBaseCurrency(payment, item.currency, baseCurrency),
          detail: 'Платёж по кредиту',
        })
      }
      continue
    }

    if (item.frequency === 'once') {
      if (dateStr === getEffectiveStartDate(item, settings)) {
        expenseLines.push({
          id: item.id,
          name: item.name,
          kind: 'once',
          amountOriginal: item.amount,
          currency: item.currency,
          amountInBase: toBaseCurrency(item.amount, item.currency, baseCurrency),
          detail: 'Разовый расход',
        })
      }
      continue
    }

    if (isFoodExpense(item) && item.frequency === 'monthly') {
      const daily = foodDailyAmount(item.amount)
      expenseLines.push({
        id: item.id,
        name: item.name,
        kind: 'food',
        amountOriginal: daily,
        currency: item.currency,
        amountInBase: toBaseCurrency(daily, item.currency, baseCurrency),
        detail: 'Ежедневное начисление (сумма ÷ 30)',
      })
      continue
    }

    let amount = 0
    switch (item.frequency) {
      case 'monthly':
        if (scheduledDayMatches(year, month, day, item, settings)) amount = item.amount
        break
      case 'weekly':
        if (daysBetween(getEffectiveStartDate(item, settings), dateStr) % 7 === 0) amount = item.amount
        break
      case 'yearly':
        if (yearlyDayMatches(dateStr, item, settings)) amount = item.amount
        break
    }
    if (amount > 0) {
      expenseLines.push({
        id: item.id,
        name: item.name,
        kind: 'expense',
        amountOriginal: amount,
        currency: item.currency,
        amountInBase: toBaseCurrency(amount, item.currency, baseCurrency),
      })
    }
  }

  for (const item of oneTimeExpenses) {
    if (item.date !== dateStr) continue
    expenseLines.push({
      id: item.id,
      name: item.name,
      kind: 'once',
      amountOriginal: item.amount,
      currency: item.currency,
      amountInBase: toBaseCurrency(item.amount, item.currency, baseCurrency),
      detail: 'Разовый расход',
    })
  }

  const savingsInterestInBase = options.savingsInterestInBase ?? 0
  if (savingsInterestInBase > 0) {
    const amountOriginal = convertCurrency(savingsInterestInBase, baseCurrency, 'RUB')
    inflowLines.push({
      id: 'savings-interest',
      name: 'Проценты накопительного счёта',
      kind: 'savings_interest',
      amountOriginal,
      currency: 'RUB',
      amountInBase: savingsInterestInBase,
      detail: `${getRubSavingsAnnualRate(settings)}% годовых`,
    })
  }

  return {
    date: dateStr,
    incomes: incomeLines,
    expenses: expenseLines,
    inflows: inflowLines,
    incomeTotal: incomeLines.reduce((s, line) => s + line.amountInBase, 0),
    expenseTotal: expenseLines.reduce((s, line) => s + line.amountInBase, 0),
    inflowTotal: inflowLines.reduce((s, line) => s + line.amountInBase, 0),
  }
}

export function shiftIsoDate(dateStr: string, deltaDays: number): string {
  const { year, month, day } = parseIsoDate(dateStr)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + deltaDays)
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}



export function getInitialBalanceInBase(settings: BudgetSettings): number {

  const amount = settings.initialBalance ?? 0

  const currency = settings.initialBalanceCurrency ?? settings.baseCurrency

  if (amount === 0) return 0

  return toBaseCurrency(amount, currency, settings.baseCurrency)

}



export function getProjectionStartDate(settings: BudgetSettings): Date {

  const dateStr = settings.initialBalanceDate ?? new Date().toISOString().slice(0, 10)

  const [year, month, day] = dateStr.split('-').map(Number)

  return new Date(year, month - 1, day)

}



export function calculateAnnualGrossIncome(

  incomes: RecurringItem[],

  baseCurrency: string,

): number {

  return incomes.reduce((sum, item) => {

    const amount =

      item.frequency === 'once'

        ? item.amount

        : toMonthlyAmount(item.amount, item.frequency) * 12

    return sum + toBaseCurrency(amount, item.currency, baseCurrency)

  }, 0)

}



export function getQuarterlyGrossFromIncomes(
  incomes: RecurringItem[],
  baseCurrency: string,
  year: number,
  settings: BudgetSettings,
): [number, number, number, number] {
  const quarters: [number, number, number, number] = [0, 0, 0, 0]
  for (let q = 0; q < 4; q++) {
    for (let m = 0; m < 3; m++) {
      const month = q * 3 + m + 1
      const monthKey = `${year}-${String(month).padStart(2, '0')}`
      quarters[q] += sumRecurringForMonth(incomes, monthKey, baseCurrency, settings)
    }
  }
  return quarters
}

function collectYearsFromDayKeys(dayKeys: string[]): number[] {
  return [...new Set(dayKeys.map((d) => parseIsoDate(d).year))]
}

function buildScheduledTaxByDate(
  incomes: RecurringItem[],
  settings: BudgetSettings,
  taxResult: TaxResult,
  years: number[],
): Map<string, { social: number; incomeTax: number }> {
  const calculator = getTaxCalculator(settings.taxRegimeId)
  const map = new Map<string, { social: number; incomeTax: number }>()
  if (!calculator?.buildTaxSchedule || calculator.taxDistribution !== 'scheduled') {
    return map
  }

  const residenceIncomes = filterResidenceTaxableIncomes(incomes)
  const input = {
    grossAnnualIncome: calculateAnnualGrossIncome(residenceIncomes, settings.baseCurrency),
    familySize: settings.familySize,
    dependents: settings.dependents,
  }

  for (const year of years) {
    const quarterlyGross = getQuarterlyGrossFromIncomes(residenceIncomes, settings.baseCurrency, year, settings)
    const payments = calculator.buildTaxSchedule(input, taxResult, { year, quarterlyGross })
    for (const payment of payments) {
      const y = payment.year ?? year
      const dateKey = `${y}-${String(payment.month).padStart(2, '0')}-${String(payment.day).padStart(2, '0')}`
      const existing = map.get(dateKey) ?? { social: 0, incomeTax: 0 }
      map.set(dateKey, {
        social: existing.social + payment.social,
        incomeTax: existing.incomeTax + payment.incomeTax,
      })
    }
  }

  return map
}

function getEffectiveTaxRate(
  incomes: RecurringItem[],
  expenses: RecurringItem[],
  oneTimeExpenses: OneTimeExpense[],
  settings: BudgetSettings,
): number {
  const residenceIncomes = filterResidenceTaxableIncomes(incomes)
  const grossAnnualIncome = calculateAnnualGrossIncome(residenceIncomes, settings.baseCurrency)
  if (grossAnnualIncome <= 0) return 0

  const calculator = getTaxCalculator(settings.taxRegimeId)
  const burden = computeAnnualTaxBurden(incomes, settings, calculator, expenses, oneTimeExpenses)
  return (burden.residenceIncomeTax + burden.residenceSocial) / grossAnnualIncome
}

interface ResidenceTaxPlan {
  taxRegimeId: string
  rate: number
  useScheduled: boolean
  scheduledMap: Map<string, { social: number; incomeTax: number }>
}

function buildResidenceTaxPlans(
  incomes: RecurringItem[],
  expenses: RecurringItem[],
  oneTimeExpenses: OneTimeExpense[],
  settings: BudgetSettings,
  years: number[],
): Map<string, ResidenceTaxPlan> {
  const plans = new Map<string, ResidenceTaxPlan>()
  const seen = new Set<string>()

  for (const point of getResidenceRoute(settings)) {
    if (seen.has(point.taxRegimeId)) continue
    seen.add(point.taxRegimeId)
    const pointSettings = settingsForResidencePoint(settings, point)
    const calculator = getTaxCalculator(point.taxRegimeId)
    const residenceIncomes = filterResidenceTaxableIncomes(incomes)
    const grossAnnualIncome = calculateAnnualGrossIncome(
      residenceIncomes,
      pointSettings.baseCurrency,
    )
    const taxResult = calculator?.calculate({
      grossAnnualIncome,
      familySize: pointSettings.familySize,
      dependents: pointSettings.dependents,
    })
    const rate = getEffectiveTaxRate(incomes, expenses, oneTimeExpenses, pointSettings)
    const useScheduled = calculator?.taxDistribution === 'scheduled'
    const scheduledMap =
      taxResult && useScheduled
        ? buildScheduledTaxByDate(incomes, pointSettings, taxResult, years)
        : new Map()
    plans.set(point.taxRegimeId, {
      taxRegimeId: point.taxRegimeId,
      rate,
      useScheduled: Boolean(useScheduled),
      scheduledMap,
    })
  }
  return plans
}

function residenceTaxForDate(
  date: string,
  settings: BudgetSettings,
  plans: Map<string, ResidenceTaxPlan>,
  residenceIncomes: RecurringItem[],
  baseCurrency: string,
): number {
  const point = getResidenceOnDate(settings, date)
  if (!point) return 0
  const plan = plans.get(point.taxRegimeId)
  if (!plan) return 0
  if (plan.useScheduled) {
    const scheduled = plan.scheduledMap.get(date)
    return scheduled ? scheduled.social + scheduled.incomeTax : 0
  }
  const residenceGross = incomeForDay(residenceIncomes, date, baseCurrency, settings)
  return residenceGross * plan.rate
}

function residenceTaxForMonthKey(
  month: string,
  settings: BudgetSettings,
  plans: Map<string, ResidenceTaxPlan>,
  residenceIncomes: RecurringItem[],
  baseCurrency: string,
): number {
  const [year, monthNum] = month.split('-').map(Number)
  const daysInMonth = getDaysInMonth(year, monthNum)
  let total = 0
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${month}-${String(day).padStart(2, '0')}`
    total += residenceTaxForDate(date, settings, plans, residenceIncomes, baseCurrency)
  }
  return total
}



export function calculateDailyBudgetProjection(

  incomes: RecurringItem[],

  expenses: RecurringItem[],

  oneTimeExpenses: OneTimeExpense[],

  settings: BudgetSettings,

): DailySnapshot[] {

  const { baseCurrency } = settings

  const dayKeys = generateDayKeys(getProjectionStartDate(settings), settings.horizonMonths)

  const residenceIncomes = filterResidenceTaxableIncomes(incomes)
  const years = collectYearsFromDayKeys(dayKeys)
  const taxPlans = buildResidenceTaxPlans(incomes, expenses, oneTimeExpenses, settings, years)

  let russiaTracker = createRussiaYtdTracker()
  let trackerYear = -1

  let cumulativeBalance = getInitialBalanceInBase(settings)
  let rubBalance = getInitialRubBalance(settings)

  return dayKeys.map((date) => {
    const { year } = parseIsoDate(date)
    if (year !== trackerYear) {
      russiaTracker = createRussiaYtdTracker()
      trackerYear = year
    }

    const grossIncome = incomeForDay(incomes, date, baseCurrency, settings)
    const recurringExpenses = expenseForDay(expenses, date, baseCurrency, settings)
    const oneTimeTotal =
      onceExpensesForDay(expenses, date, baseCurrency, settings) +
      sumOneTimeForDay(oneTimeExpenses, date, baseCurrency)

    const russiaTaxRub = russiaSourceNdflRubForDay(
      incomes,
      date,
      settings.dependents,
      russiaTracker,
    )
    const russiaTax = toBaseCurrency(russiaTaxRub, 'RUB', baseCurrency)

    const residenceTax = residenceTaxForDate(
      date,
      settings,
      taxPlans,
      residenceIncomes,
      baseCurrency,
    )

    const taxes = russiaTax + residenceTax
    const netIncome = grossIncome - taxes
    const loanDisbursement = loanDisbursementForDay(expenses, date, baseCurrency)

    if (isRubSavingsEnabled(settings)) {
      rubBalance += rubNetCashflowBeforeNdflForDay(
        incomes,
        expenses,
        oneTimeExpenses,
        date,
        settings,
      )
      rubBalance -= russiaTaxRub
    }

    const { interestBase, nextRubBalance } = accrueRubSavingsInterestForDay(
      rubBalance,
      date,
      settings,
    )
    rubBalance = nextRubBalance

    const balance =
      netIncome - recurringExpenses - oneTimeTotal + loanDisbursement + interestBase
    cumulativeBalance += balance

    return {
      date,
      grossIncome,
      netIncome,
      recurringExpenses,
      oneTimeExpenses: oneTimeTotal,
      loanDisbursement,
      savingsInterest: interestBase,
      taxes,
      balance,
      cumulativeBalance,
    }
  })
}



export function calculateBudgetProjection(

  incomes: RecurringItem[],

  expenses: RecurringItem[],

  oneTimeExpenses: OneTimeExpense[],

  settings: BudgetSettings,

): MonthlySnapshot[] {

  const { baseCurrency } = settings

  const monthKeys = generateMonthKeys(getProjectionStartDate(settings), settings.horizonMonths)

  const residenceIncomes = filterResidenceTaxableIncomes(incomes)
  const projectionYears = [...new Set(monthKeys.map((m) => Number(m.split('-')[0])))]
  const taxPlans = buildResidenceTaxPlans(
    incomes,
    expenses,
    oneTimeExpenses,
    settings,
    projectionYears,
  )

  let cumulativeBalance = getInitialBalanceInBase(settings)
  let rubBalance = getInitialRubBalance(settings)
  let savingsRussiaTracker = createRussiaYtdTracker()
  let savingsTrackerYear = -1

  return monthKeys.map((month) => {
    const grossIncome = sumRecurringForMonth(incomes, month, baseCurrency, settings)
    const recurringExpenses = sumRecurringForMonth(expenses, month, baseCurrency, settings)
    const oneTimeTotal =
      sumOnceExpensesForMonth(expenses, month, baseCurrency, settings) +
      sumOneTimeForMonth(oneTimeExpenses, month, baseCurrency)

    const residenceTax = residenceTaxForMonthKey(
      month,
      settings,
      taxPlans,
      residenceIncomes,
      baseCurrency,
    )
    const russiaTax = russiaSourceTaxForMonth(
      incomes,
      month,
      settings.dependents,
      baseCurrency,
    )
    const taxes = residenceTax + russiaTax
    const netIncome = grossIncome - taxes
    const loanDisbursement = loanDisbursementForMonth(expenses, month, baseCurrency)

    let savingsInterest = 0
    if (isRubSavingsEnabled(settings)) {
      const [year, monthNum] = month.split('-').map(Number)
      if (year !== savingsTrackerYear) {
        savingsRussiaTracker = createRussiaYtdTracker()
        savingsTrackerYear = year
      }
      const daysInMonth = getDaysInMonth(year, monthNum)
      for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${month}-${String(day).padStart(2, '0')}`
        const ndflRub = russiaSourceNdflRubForDay(
          incomes,
          dateStr,
          settings.dependents,
          savingsRussiaTracker,
        )
        rubBalance += rubNetCashflowBeforeNdflForDay(
          incomes,
          expenses,
          oneTimeExpenses,
          dateStr,
          settings,
        )
        rubBalance -= ndflRub
        const accrued = accrueRubSavingsInterestForDay(rubBalance, dateStr, settings)
        rubBalance = accrued.nextRubBalance
        savingsInterest += accrued.interestBase
      }
    }

    const balance =
      netIncome - recurringExpenses - oneTimeTotal + loanDisbursement + savingsInterest

    cumulativeBalance += balance

    return {
      month,
      grossIncome,
      netIncome,
      recurringExpenses,
      oneTimeExpenses: oneTimeTotal,
      loanDisbursement,
      savingsInterest,
      taxes,
      balance,
      cumulativeBalance,
    }
  })
}

/** Средние за горизонт: приток (доход + выдача кредитов) и расходы сходятся с итоговым остатком. */
export function computeSummaryAverages(snapshots: MonthlySnapshot[]): {
  avgInflow: number
  avgExpenses: number
  avgNetIncome: number
  avgLoanDisbursement: number
  avgRecurringExpenses: number
  avgOneTimeExpenses: number
} {
  const n = snapshots.length
  if (n === 0) {
    return {
      avgInflow: 0,
      avgExpenses: 0,
      avgNetIncome: 0,
      avgLoanDisbursement: 0,
      avgRecurringExpenses: 0,
      avgOneTimeExpenses: 0,
    }
  }

  const avgNetIncome = snapshots.reduce((s, m) => s + m.netIncome, 0) / n
  const avgLoanDisbursement = snapshots.reduce((s, m) => s + m.loanDisbursement, 0) / n
  const avgSavingsInterest = snapshots.reduce((s, m) => s + (m.savingsInterest ?? 0), 0) / n
  const avgRecurringExpenses = snapshots.reduce((s, m) => s + m.recurringExpenses, 0) / n
  const avgOneTimeExpenses = snapshots.reduce((s, m) => s + m.oneTimeExpenses, 0) / n

  return {
    avgNetIncome,
    avgLoanDisbursement,
    avgRecurringExpenses,
    avgOneTimeExpenses,
    avgInflow: avgNetIncome + avgLoanDisbursement + avgSavingsInterest,
    avgExpenses: avgRecurringExpenses + avgOneTimeExpenses,
  }
}



export interface FullTaxSummary {
  residence: {
    calculator: NonNullable<ReturnType<typeof getTaxCalculator>>
    result: TaxResult
  } | null
  russiaSalary: ReturnType<typeof summarizeRussiaSalaries>
  russiaNdflInBase: number
  russiaEmployerSocialInBase: number
  spainSchedule?: {
    year: number
    quarterlyGross?: [number, number, number, number]
    payments: ScheduledTaxPayment[]
  }
  doubleTaxation: DoubleTaxationLine[]
  spainForeignSalary?: SpainForeignSalaryBreakdown
  thailandForeignSalary?: import('../tax/thailandResidenceTax').ThailandForeignSalaryBreakdown
  georgiaForeignSalary?: import('../tax/georgiaResidenceTax').GeorgiaForeignSalaryBreakdown
  foreignTaxCredit: number
}

export function getTaxSummary(
  incomes: RecurringItem[],
  settings: BudgetSettings,
  expenses: RecurringItem[] = [],
  oneTimeExpenses: OneTimeExpense[] = [],
  taxYear: number = new Date().getFullYear(),
): FullTaxSummary {
  const residenceIncomes = filterResidenceTaxableIncomes(incomes)
  const grossAnnualIncome = calculateAnnualGrossIncome(residenceIncomes, settings.baseCurrency)
  const calculator = getTaxCalculator(settings.taxRegimeId)
  const russiaSalary = summarizeRussiaSalaries(
    incomes.filter((item) => isRussiaSourceTaxable(item)),
    settings.dependents,
  )

  const input = {
    grossAnnualIncome,
    familySize: settings.familySize,
    dependents: settings.dependents,
  }

  const adjusted =
    calculator
      ? adjustResidenceTaxResult(residenceIncomes, settings, calculator, expenses, oneTimeExpenses)
      : null

  const residence =
    calculator && adjusted
      ? {
          calculator,
          result: adjusted.result,
        }
      : null

  const taxBurden = computeAnnualTaxBurden(incomes, settings, calculator, expenses, oneTimeExpenses)

  let spainSchedule: FullTaxSummary['spainSchedule']
  if (calculator?.countryCode === 'ES' && calculator.buildTaxSchedule) {
    const year = taxYear
    const quarterlyGross =
      calculator.id === 'es-standard'
        ? getQuarterlyGrossFromIncomes(residenceIncomes, settings.baseCurrency, year, settings)
        : undefined
    spainSchedule = {
      year,
      ...(quarterlyGross ? { quarterlyGross } : {}),
      payments: calculator.buildTaxSchedule(input, residence!.result, {
        year,
        quarterlyGross: quarterlyGross ?? [0, 0, 0, 0],
      }),
    }
  }

  return {
    residence,
    russiaSalary,
    russiaNdflInBase: taxBurden.russiaNdflInBase,
    russiaEmployerSocialInBase: russiaEmployerSocialAnnualInBase(incomes, settings.baseCurrency),
    spainSchedule,
    doubleTaxation: buildDoubleTaxationLines(incomes, settings.countryCode),
    spainForeignSalary: adjusted?.spainForeignSalary,
    thailandForeignSalary: adjusted?.thailandForeignSalary,
    georgiaForeignSalary: adjusted?.georgiaForeignSalary,
    foreignTaxCredit: taxBurden.foreignTaxCredit,
  }
}

function countActiveMonthsInYear(
  item: RecurringItem,
  year: number,
  settings: BudgetSettings,
): number {
  let count = 0
  for (let month = 1; month <= 12; month++) {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`
    if (isActiveInMonth(item, monthKey, settings)) count += 1
  }
  return count
}

/** Доход, приходящийся на календарный год (с учётом start/end и даты переезда). */
export function scopeIncomeItemToYear(
  item: RecurringItem,
  year: number,
  settings: BudgetSettings,
): RecurringItem | null {
  if (item.frequency === 'once') {
    const startYear = Number(item.startDate.slice(0, 4))
    if (startYear !== year) return null
    if (!isActiveInMonth(item, item.startDate.slice(0, 7), settings)) return null
    return { ...item }
  }

  const months = countActiveMonthsInYear(item, year, settings)
  if (months === 0) return null

  const fullYearAmount = toMonthlyAmount(item.amount, item.frequency) * 12
  return {
    ...item,
    frequency: 'yearly',
    amount: fullYearAmount * (months / 12),
    payments: undefined,
    startDate: `${year}-01-01`,
    endDate: undefined,
  }
}

export function settingsForTaxYear(settings: BudgetSettings, year: number): BudgetSettings {
  return {
    ...settings,
    initialBalanceDate: `${year}-01-01`,
    horizonMonths: 12,
  }
}

export function getHorizonTaxYears(settings: BudgetSettings): number[] {
  const dayKeys = generateDayKeys(getProjectionStartDate(settings), settings.horizonMonths)
  return collectYearsFromDayKeys(dayKeys)
}

export function getTaxSummaryForYear(
  incomes: RecurringItem[],
  settings: BudgetSettings,
  expenses: RecurringItem[] = [],
  oneTimeExpenses: OneTimeExpense[] = [],
  year: number,
): FullTaxSummary {
  const scopedIncomes = incomes
    .map((item) => scopeIncomeItemToYear(item, year, settings))
    .filter((item): item is RecurringItem => item != null)
  const scopedOnce = oneTimeExpenses.filter((item) => item.date.startsWith(`${year}-`))
  return getTaxSummary(
    scopedIncomes,
    settingsForTaxYear(settings, year),
    expenses,
    scopedOnce,
    year,
  )
}

export interface YearTaxPart {
  countryCode: string
  taxRegimeId: string
  label: string
  startDate: string
  endDate: string
  summary: FullTaxSummary
}

export interface YearTaxSummary {
  year: number
  /** Блоки по странам маршрута в этом году (обычно 1). */
  parts: YearTaxPart[]
  /** Сводка первой части (совместимость / источник НДФЛ показывается один раз). */
  summary: FullTaxSummary
}

export function taxSummaryTotalInBase(
  summary: FullTaxSummary,
  settings: BudgetSettings,
  includeSourceTaxes: boolean,
): number {
  const residence =
    (summary.residence?.result.incomeTax ?? 0) +
    (summary.residence?.result.socialContributions ?? 0)
  return residence + (includeSourceTaxes ? summary.russiaNdflInBase : 0)
}

export function yearTaxTotalInBase(
  yearSummary: YearTaxSummary,
  settings: BudgetSettings,
  includeSourceTaxes: boolean,
): number {
  let total = 0
  yearSummary.parts.forEach((part, index) => {
    const residence =
      (part.summary.residence?.result.incomeTax ?? 0) +
      (part.summary.residence?.result.socialContributions ?? 0)
    total += residence
    if (includeSourceTaxes && index === 0) {
      total += part.summary.russiaNdflInBase
    }
  })
  return total
}

function scopeIncomeItemToYearSegment(
  item: RecurringItem,
  year: number,
  settings: BudgetSettings,
  segmentId: string,
): RecurringItem | null {
  if (item.frequency === 'once') {
    const startYear = Number(item.startDate.slice(0, 4))
    if (startYear !== year) return null
    if (!isActiveInMonth(item, item.startDate.slice(0, 7), settings)) return null
    const onDate = getResidenceOnDate(settings, item.startDate)
    if (onDate?.id !== segmentId) return null
    return { ...item }
  }

  let months = 0
  for (let month = 1; month <= 12; month++) {
    const monthKey = `${year}-${String(month).padStart(2, '0')}`
    if (!isActiveInMonth(item, monthKey, settings)) continue
    const mid = `${monthKey}-15`
    const onDate = getResidenceOnDate(settings, mid)
    if (onDate?.id !== segmentId) continue
    months += 1
  }
  if (months === 0) return null

  const fullYearAmount = toMonthlyAmount(item.amount, item.frequency) * 12
  return {
    ...item,
    frequency: 'yearly',
    amount: fullYearAmount * (months / 12),
    payments: undefined,
    startDate: `${year}-01-01`,
    endDate: undefined,
  }
}

/** Налоговые сводки по каждому календарному году горизонта планирования. */
export function getTaxSummariesByHorizon(
  incomes: RecurringItem[],
  settings: BudgetSettings,
  expenses: RecurringItem[] = [],
  oneTimeExpenses: OneTimeExpense[] = [],
): YearTaxSummary[] {
  return getHorizonTaxYears(settings).map((year) => {
    const segments = getRouteSegmentsInYear(settings, year)
    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`
    const parts: YearTaxPart[] = segments.map((point, index) => {
      const pointSettings = settingsForTaxYear(
        settingsForResidencePoint(settings, point),
        year,
      )
      const scopedIncomes = incomes
        .map((item) => scopeIncomeItemToYearSegment(item, year, settings, point.id))
        .filter((item): item is RecurringItem => item != null)
      const scopedOnce = oneTimeExpenses.filter((item) => {
        if (!item.date.startsWith(`${year}-`)) return false
        const onDate = getResidenceOnDate(settings, item.date)
        return onDate?.id === point.id
      })
      let summary = getTaxSummary(scopedIncomes, pointSettings, expenses, scopedOnce, year)
      if (index > 0) {
        summary = {
          ...summary,
          russiaSalary: null,
          russiaNdflInBase: 0,
          russiaEmployerSocialInBase: 0,
        }
      }
      const segStart = point.startDate > yearStart ? point.startDate : yearStart
      const segEnd = point.endDate < yearEnd ? point.endDate : yearEnd
      return {
        countryCode: point.countryCode,
        taxRegimeId: point.taxRegimeId,
        label: `${point.countryCode} · ${segStart}–${segEnd}`,
        startDate: segStart,
        endDate: segEnd,
        summary,
      }
    })

    const fallback =
      parts[0]?.summary ??
      getTaxSummaryForYear(incomes, settings, expenses, oneTimeExpenses, year)

    return {
      year,
      parts:
        parts.length > 0
          ? parts
          : [
              {
                countryCode: settings.countryCode,
                taxRegimeId: settings.taxRegimeId,
                label: String(year),
                startDate: yearStart,
                endDate: yearEnd,
                summary: fallback,
              },
            ],
      summary: fallback,
    }
  })
}



export function findCashGapDays(snapshots: DailySnapshot[]): DailySnapshot[] {

  return snapshots.filter((s) => s.cumulativeBalance < 0)

}


