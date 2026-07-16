import type { BudgetSettings } from '../types/budget'
import { getInitialSavingsBalanceFromEntries } from './initialBalance'

export const DEFAULT_SAVINGS_ANNUAL_RATE = 16
export const DEFAULT_SAVINGS_ACCOUNT_CURRENCY = 'RUB'

export function getSavingsAccountCurrency(settings: BudgetSettings): string {
  return settings.savingsAccountCurrency ?? DEFAULT_SAVINGS_ACCOUNT_CURRENCY
}

export function isSavingsAccountEnabled(settings: BudgetSettings): boolean {
  return Boolean(settings.parkBalanceOnSavingsAccount)
}

export function getSavingsAnnualRate(settings: BudgetSettings): number {
  const rate = settings.savingsAnnualRate
  if (rate == null || Number.isNaN(rate) || rate < 0) return DEFAULT_SAVINGS_ANNUAL_RATE
  return rate
}

/** Ежемесячное начисление на положительный остаток (ставка годовая, %). */
export function monthlySavingsInterest(balance: number, annualRatePct: number): number {
  if (balance <= 0 || annualRatePct <= 0) return 0
  return balance * (annualRatePct / 100 / 12)
}

export function getInitialSavingsBalance(settings: BudgetSettings): number {
  return getInitialSavingsBalanceFromEntries(settings)
}

export function isLastDayOfMonth(dateStr: string): boolean {
  const [year, month, day] = dateStr.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  return day === daysInMonth
}
