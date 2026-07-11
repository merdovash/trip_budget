import type {

  BudgetSettings,

  DailySnapshot,

  MonthlySnapshot,

  OneTimeExpense,

  RecurringItem,

} from '../types/budget'

import { FOOD_EXPENSE_CATEGORY } from '../config/foodBudget'

import { convertCurrency } from '../lib/currency'

import { getTaxCalculator } from '../tax/registry'



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



function isActiveInMonth(item: RecurringItem, monthKey: string): boolean {

  const monthStart = `${monthKey}-01`

  const monthEnd = monthKey.slice(0, 7)

  if (item.startDate.slice(0, 7) > monthEnd) return false

  if (item.endDate && item.endDate.slice(0, 7) < monthEnd) return false

  if (item.frequency === 'once') {

    return item.startDate.slice(0, 7) === monthEnd

  }

  return item.startDate <= monthStart || item.startDate.slice(0, 7) <= monthEnd

}



function isActiveOnDay(item: RecurringItem, dateStr: string): boolean {

  if (dateStr < item.startDate) return false

  if (item.endDate && dateStr > item.endDate) return false

  if (item.frequency === 'once') return dateStr === item.startDate

  return true

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



function scheduledDayOfMonth(item: RecurringItem): number {

  return parseIsoDate(item.startDate).day

}



function scheduledDayMatches(

  year: number,

  month: number,

  day: number,

  item: RecurringItem,

): boolean {

  return paymentDayMatches(year, month, day, scheduledDayOfMonth(item))

}



function yearlyDayMatches(dateStr: string, item: RecurringItem): boolean {

  const current = parseIsoDate(dateStr)

  const start = parseIsoDate(item.startDate)

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
): number {
  return items.reduce((sum, item) => {
    if (!isActiveInMonth(item, monthKey)) return sum
    const amount = recurringAmountForMonth(item, monthKey)
    return sum + toBaseCurrency(amount, item.currency, baseCurrency)
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

): number {

  const { year, month, day } = parseIsoDate(dateStr)



  return items.reduce((sum, item) => {

    if (!isActiveOnDay(item, dateStr)) return sum



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

        if (scheduledDayMatches(year, month, day, item)) amount = item.amount

        break

      case 'weekly':

        if (daysBetween(item.startDate, dateStr) % 7 === 0) amount = item.amount

        break

      case 'yearly':

        if (yearlyDayMatches(dateStr, item)) amount = item.amount

        break

      case 'once':

        if (dateStr === item.startDate) amount = item.amount

        break

    }



    return sum + toBaseCurrency(amount, item.currency, baseCurrency)

  }, 0)

}



function expenseForDay(

  items: RecurringItem[],

  dateStr: string,

  baseCurrency: string,

): number {

  const { year, month, day } = parseIsoDate(dateStr)



  return items.reduce((sum, item) => {

    if (!isActiveOnDay(item, dateStr)) return sum



    if (isFoodExpense(item) && item.frequency === 'monthly') {

      return sum + toBaseCurrency(foodDailyAmount(item.amount), item.currency, baseCurrency)

    }



    let amount = 0

    switch (item.frequency) {

      case 'monthly':

        if (scheduledDayMatches(year, month, day, item)) amount = item.amount

        break

      case 'weekly':

        if (daysBetween(item.startDate, dateStr) % 7 === 0) amount = item.amount

        break

      case 'yearly':

        if (yearlyDayMatches(dateStr, item)) amount = item.amount

        break

      case 'once':

        if (dateStr === item.startDate) amount = item.amount

        break

    }



    return sum + toBaseCurrency(amount, item.currency, baseCurrency)

  }, 0)

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



function getEffectiveTaxRate(grossAnnualIncome: number, settings: BudgetSettings): number {

  if (grossAnnualIncome <= 0) return 0

  const calculator = getTaxCalculator(settings.taxRegimeId)

  const taxResult = calculator?.calculate({

    grossAnnualIncome,

    familySize: settings.familySize,

    dependents: settings.dependents,

  })

  if (!taxResult) return 0

  return (taxResult.incomeTax + taxResult.socialContributions) / grossAnnualIncome

}



export function calculateDailyBudgetProjection(

  incomes: RecurringItem[],

  expenses: RecurringItem[],

  oneTimeExpenses: OneTimeExpense[],

  settings: BudgetSettings,

): DailySnapshot[] {

  const { baseCurrency } = settings

  const dayKeys = generateDayKeys(getProjectionStartDate(settings), settings.horizonMonths)

  const grossAnnualIncome = calculateAnnualGrossIncome(incomes, baseCurrency)

  const taxRate = getEffectiveTaxRate(grossAnnualIncome, settings)



  let cumulativeBalance = getInitialBalanceInBase(settings)



  return dayKeys.map((date) => {

    const grossIncome = incomeForDay(incomes, date, baseCurrency)

    const recurringExpenses = expenseForDay(expenses, date, baseCurrency)

    const oneTimeTotal = sumOneTimeForDay(oneTimeExpenses, date, baseCurrency)

    const taxes = grossIncome * taxRate

    const netIncome = grossIncome - taxes

    const balance = netIncome - recurringExpenses - oneTimeTotal

    cumulativeBalance += balance



    return {

      date,

      grossIncome,

      netIncome,

      recurringExpenses,

      oneTimeExpenses: oneTimeTotal,

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

  const grossAnnualIncome = calculateAnnualGrossIncome(incomes, baseCurrency)

  const calculator = getTaxCalculator(settings.taxRegimeId)

  const taxResult = calculator?.calculate({

    grossAnnualIncome,

    familySize: settings.familySize,

    dependents: settings.dependents,

  })



  const monthlyGross = grossAnnualIncome / 12

  const monthlyTax = taxResult ? taxResult.incomeTax / 12 + taxResult.socialContributions / 12 : 0



  let cumulativeBalance = getInitialBalanceInBase(settings)



  return monthKeys.map((month) => {

    const grossIncome = sumRecurringForMonth(incomes, month, baseCurrency)

    const recurringExpenses = sumRecurringForMonth(expenses, month, baseCurrency)

    const oneTimeTotal = sumOneTimeForMonth(oneTimeExpenses, month, baseCurrency)



    const grossForTax = grossIncome > 0 ? grossIncome : monthlyGross

    const taxRatio = grossAnnualIncome > 0 ? grossForTax / (grossAnnualIncome / 12) : 1

    const taxes = monthlyTax * taxRatio

    const netIncome = grossForTax - taxes

    const balance = netIncome - recurringExpenses - oneTimeTotal

    cumulativeBalance += balance



    return {

      month,

      grossIncome: grossForTax,

      netIncome,

      recurringExpenses,

      oneTimeExpenses: oneTimeTotal,

      taxes,

      balance,

      cumulativeBalance,

    }

  })

}



export function getTaxSummary(incomes: RecurringItem[], settings: BudgetSettings) {

  const grossAnnualIncome = calculateAnnualGrossIncome(incomes, settings.baseCurrency)

  const calculator = getTaxCalculator(settings.taxRegimeId)

  if (!calculator) return null

  return {

    calculator,

    result: calculator.calculate({

      grossAnnualIncome,

      familySize: settings.familySize,

      dependents: settings.dependents,

    }),

  }

}



export function findCashGapDays(snapshots: DailySnapshot[]): DailySnapshot[] {

  return snapshots.filter((s) => s.cumulativeBalance < 0)

}


