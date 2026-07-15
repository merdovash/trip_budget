import type { BudgetSettings } from '../types/budget'

export const DEFAULT_RUB_SAVINGS_ANNUAL_RATE = 16

export function isRubSavingsEnabled(settings: BudgetSettings): boolean {
  return Boolean(settings.parkRubOnSavingsAccount)
}

export function getRubSavingsAnnualRate(settings: BudgetSettings): number {
  const rate = settings.rubSavingsAnnualRate
  if (rate == null || Number.isNaN(rate) || rate < 0) return DEFAULT_RUB_SAVINGS_ANNUAL_RATE
  return rate
}

/** Ежемесячное начисление на положительный остаток (ставка годовая, %). */
export function monthlyRubSavingsInterest(rubBalance: number, annualRatePct: number): number {
  if (rubBalance <= 0 || annualRatePct <= 0) return 0
  return rubBalance * (annualRatePct / 100 / 12)
}

export function getInitialRubBalance(settings: BudgetSettings): number {
  if ((settings.initialBalanceCurrency ?? settings.baseCurrency) !== 'RUB') return 0
  return settings.initialBalance ?? 0
}

export function isLastDayOfMonth(dateStr: string): boolean {
  const [year, month, day] = dateStr.split('-').map(Number)
  const daysInMonth = new Date(year, month, 0).getDate()
  return day === daysInMonth
}
