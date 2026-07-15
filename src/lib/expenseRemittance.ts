import { isItemActiveInMonth } from '../config/relocationPrograms'
import { FOOD_EXPENSE_CATEGORY } from '../config/foodBudget'
import { convertCurrency } from './currency'
import { getExpenseCountryScope, isResidenceScopeExpense } from './expenseCountry'
import { isLoanExpense, isLoanPaymentInMonth, loanMonthlyPayment } from './loanAmortization'
import type { BudgetSettings, Frequency, OneTimeExpense, RecurringItem } from '../types/budget'

const WEEKS_PER_MONTH = 52 / 12
const FOOD_DAILY_DIVISOR = 30

function toMonthlyAmount(amount: number, frequency: Frequency): number {
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

function isFoodExpense(item: RecurringItem): boolean {
  return item.category === FOOD_EXPENSE_CATEGORY
}

function foodMonthlyAmount(amount: number, monthKey: string): number {
  const [, month] = monthKey.split('-').map(Number)
  const daysInMonth = new Date(2000, month, 0).getDate()
  return (amount / FOOD_DAILY_DIVISOR) * daysInMonth
}

function recurringAmountForMonth(item: RecurringItem, monthKey: string): number {
  if (isLoanExpense(item)) {
    return isLoanPaymentInMonth(item, monthKey) ? loanMonthlyPayment(item) : 0
  }
  if (item.frequency === 'once') return item.amount
  if (isFoodExpense(item) && item.frequency === 'monthly') {
    return foodMonthlyAmount(item.amount, monthKey)
  }
  return toMonthlyAmount(item.amount, item.frequency)
}

function toBaseCurrency(amount: number, currency: string, baseCurrency: string): number {
  return convertCurrency(amount, currency, baseCurrency)
}

function getProjectionStartDate(settings: BudgetSettings): Date {
  const dateStr = settings.initialBalanceDate ?? new Date().toISOString().slice(0, 10)
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function generateMonthKeys(startDate: Date, count: number): string[] {
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

/** Годовые расходы в стране проживания (первые 12 месяцев горизонта). */
export function calculateAnnualResidenceScopeExpenses(
  expenses: RecurringItem[],
  oneTimeExpenses: OneTimeExpense[],
  settings: BudgetSettings,
): number {
  return calculateAnnualExpensesInCountry(
    expenses,
    oneTimeExpenses,
    settings.countryCode,
    settings,
    (item) => isResidenceScopeExpense(item, settings),
  )
}

/** Годовые расходы в указанной стране (первые 12 месяцев горизонта). */
export function calculateAnnualExpensesInCountry(
  expenses: RecurringItem[],
  oneTimeExpenses: OneTimeExpense[],
  countryCode: string,
  settings: BudgetSettings,
  matchesCountry: (item: RecurringItem | OneTimeExpense) => boolean = (item) =>
    getExpenseCountryScope(item, settings) === 'residence' &&
    settings.countryCode === countryCode,
): number {
  const baseCurrency = settings.baseCurrency
  const monthKeys = generateMonthKeys(getProjectionStartDate(settings), settings.horizonMonths)
  const yearMonths = monthKeys.slice(0, Math.min(12, monthKeys.length))

  let total = 0
  for (const month of yearMonths) {
    for (const item of expenses) {
      if (!matchesCountry(item)) continue
      if (!isItemActiveInMonth(item, month, settings)) continue
      const amount = recurringAmountForMonth(item, month)
      total += toBaseCurrency(amount, item.currency, baseCurrency)
    }
    for (const item of oneTimeExpenses) {
      if (!matchesCountry(item)) continue
      if (item.date.slice(0, 7) !== month) continue
      total += toBaseCurrency(item.amount, item.currency, baseCurrency)
    }
  }
  return total
}
