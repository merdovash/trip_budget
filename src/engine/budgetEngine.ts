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
  isResidenceLifeStarted,
} from '../config/relocationPrograms'

import { loanMonthlyPayment, isLoanExpense, isLoanPaymentInMonth, isLoanPaymentOnDay, loanDisbursementForDay, loanDisbursementForMonth } from '../lib/loanAmortization'
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
  russiaSourceTaxForDay,
  russiaSourceTaxForMonth,
  summarizeRussiaSalaries,
} from '../tax/incomeSourceTax'



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

function scheduledTaxTotalForMonth(
  monthKey: string,
  scheduledTaxMap: Map<string, { social: number; incomeTax: number }>,
): number {
  const prefix = `${monthKey}-`
  let total = 0
  for (const [date, amounts] of scheduledTaxMap) {
    if (date.startsWith(prefix)) {
      total += amounts.social + amounts.incomeTax
    }
  }
  return total
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



export function calculateDailyBudgetProjection(

  incomes: RecurringItem[],

  expenses: RecurringItem[],

  oneTimeExpenses: OneTimeExpense[],

  settings: BudgetSettings,

): DailySnapshot[] {

  const { baseCurrency } = settings

  const dayKeys = generateDayKeys(getProjectionStartDate(settings), settings.horizonMonths)

  const residenceIncomes = filterResidenceTaxableIncomes(incomes)
  const grossAnnualIncome = calculateAnnualGrossIncome(residenceIncomes, baseCurrency)
  const calculator = getTaxCalculator(settings.taxRegimeId)
  const taxResult = calculator?.calculate({
    grossAnnualIncome,
    familySize: settings.familySize,
    dependents: settings.dependents,
  })
  const taxRate = getEffectiveTaxRate(incomes, expenses, oneTimeExpenses, settings)
  const scheduledTaxMap = taxResult
    ? buildScheduledTaxByDate(incomes, settings, taxResult, collectYearsFromDayKeys(dayKeys))
    : new Map()
  const useScheduled = calculator?.taxDistribution === 'scheduled'

  let russiaTracker = createRussiaYtdTracker()
  let trackerYear = -1

  let cumulativeBalance = getInitialBalanceInBase(settings)

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

    const russiaTax = russiaSourceTaxForDay(
      incomes,
      date,
      settings.dependents,
      russiaTracker,
      baseCurrency,
    )

    const scheduled = scheduledTaxMap.get(date)
    let residenceTax = 0
    if (isResidenceLifeStarted(date, settings)) {
      if (scheduled) {
        residenceTax = scheduled.social + scheduled.incomeTax
      } else if (!useScheduled) {
        const residenceGross = incomeForDay(residenceIncomes, date, baseCurrency, settings)
        residenceTax = residenceGross * taxRate
      }
    }

    const taxes = russiaTax + residenceTax
    const netIncome = grossIncome - taxes
    const loanDisbursement = loanDisbursementForDay(expenses, date, baseCurrency)

    const balance = netIncome - recurringExpenses - oneTimeTotal + loanDisbursement
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

  const residenceIncomes = filterResidenceTaxableIncomes(incomes)
  const grossAnnualIncome = calculateAnnualGrossIncome(residenceIncomes, baseCurrency)

  const calculator = getTaxCalculator(settings.taxRegimeId)

  const adjusted =
    calculator
      ? adjustResidenceTaxResult(residenceIncomes, settings, calculator, expenses, oneTimeExpenses)
      : null
  const taxResult =
    adjusted?.result ??
    calculator?.calculate({
      grossAnnualIncome,
      familySize: settings.familySize,
      dependents: settings.dependents,
    })

  const monthlyTax =
    taxResult && calculator?.taxDistribution !== 'scheduled'
      ? taxResult.incomeTax / 12 + taxResult.socialContributions / 12
      : 0

  const projectionYears = monthKeys.map((m) => Number(m.split('-')[0]))
  const scheduledTaxMap = taxResult
    ? buildScheduledTaxByDate(incomes, settings, taxResult, [...new Set(projectionYears)])
    : new Map()
  const useScheduled = calculator?.taxDistribution === 'scheduled'

  let cumulativeBalance = getInitialBalanceInBase(settings)

  return monthKeys.map((month) => {
    const grossIncome = sumRecurringForMonth(incomes, month, baseCurrency, settings)
    const residenceGross = sumRecurringForMonth(residenceIncomes, month, baseCurrency, settings)
    const recurringExpenses = sumRecurringForMonth(expenses, month, baseCurrency, settings)
    const oneTimeTotal =
      sumOnceExpensesForMonth(expenses, month, baseCurrency, settings) +
      sumOneTimeForMonth(oneTimeExpenses, month, baseCurrency)

    const monthStart = `${month}-01`
    const residenceTax = isResidenceLifeStarted(monthStart, settings)
      ? useScheduled
        ? scheduledTaxTotalForMonth(month, scheduledTaxMap)
        : grossAnnualIncome > 0
          ? monthlyTax * (residenceGross / (grossAnnualIncome / 12))
          : 0
      : 0
    const russiaTax = russiaSourceTaxForMonth(
      incomes,
      month,
      settings.dependents,
      baseCurrency,
    )
    const taxes = residenceTax + russiaTax
    const netIncome = grossIncome - taxes
    const loanDisbursement = loanDisbursementForMonth(expenses, month, baseCurrency)

    const balance = netIncome - recurringExpenses - oneTimeTotal + loanDisbursement

    cumulativeBalance += balance



    return {

      month,

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
    const year = new Date().getFullYear()
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



export function findCashGapDays(snapshots: DailySnapshot[]): DailySnapshot[] {

  return snapshots.filter((s) => s.cumulativeBalance < 0)

}


