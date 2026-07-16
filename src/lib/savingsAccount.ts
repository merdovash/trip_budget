import type { BudgetSettings } from '../types/budget'
import {
  getInitialSavingsBalanceFromEntries,
  getInitialSavingsBalancesByCurrency,
  getSavingsAnnualRateForCurrency,
  getSavingsCurrencies,
} from './initialBalance'

export const DEFAULT_SAVINGS_ANNUAL_RATE = 16
export const DEFAULT_SAVINGS_ACCOUNT_CURRENCY = 'RUB'

export function getSavingsAccountCurrency(settings: BudgetSettings): string {
  return settings.savingsAccountCurrency ?? DEFAULT_SAVINGS_ACCOUNT_CURRENCY
}

export function isSavingsAccountEnabled(settings: BudgetSettings): boolean {
  return Boolean(settings.parkBalanceOnSavingsAccount)
}

/** @deprecated Prefer getSavingsAnnualRateForCurrency. */
export function getSavingsAnnualRate(settings: BudgetSettings): number {
  return getSavingsAnnualRateForCurrency(settings, getSavingsAccountCurrency(settings))
}

/** Ежемесячное начисление на положительный остаток (ставка годовая, %). */
export function monthlySavingsInterest(balance: number, annualRatePct: number): number {
  if (balance <= 0 || annualRatePct <= 0) return 0
  return balance * (annualRatePct / 100 / 12)
}

export function getInitialSavingsBalance(settings: BudgetSettings): number {
  return getInitialSavingsBalanceFromEntries(settings)
}

export function createSavingsBalances(settings: BudgetSettings): Map<string, number> {
  if (!isSavingsAccountEnabled(settings)) return new Map()
  return new Map(getInitialSavingsBalancesByCurrency(settings))
}

export function listSavingsCurrencies(settings: BudgetSettings): string[] {
  const fromBalances = getSavingsCurrencies(settings)
  if (fromBalances.length > 0) return fromBalances
  return [getSavingsAccountCurrency(settings)]
}

export function isLastDayOfMonth(dateStr: string): boolean {
  const [year, month, day] = dateStr.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  return day === daysInMonth
}

export { getSavingsAnnualRateForCurrency }
