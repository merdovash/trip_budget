import type { BudgetSettings, InitialBalanceEntry } from '../types/budget'
import { convertCurrency } from './currency'
import { createId } from './id'

const DEFAULT_RATE = 16

export function getInitialBalances(settings: BudgetSettings): InitialBalanceEntry[] {
  if (settings.initialBalances !== undefined) {
    return settings.initialBalances
  }
  const amount = settings.initialBalance ?? 0
  if (amount === 0) return []
  return [
    {
      id: 'legacy',
      amount,
      currency: settings.initialBalanceCurrency ?? settings.baseCurrency,
      annualRate: settings.savingsAnnualRate ?? DEFAULT_RATE,
    },
  ]
}

export function getInitialBalanceInBase(settings: BudgetSettings): number {
  return getInitialBalances(settings).reduce((sum, entry) => {
    if (entry.amount === 0) return sum
    return sum + convertCurrency(entry.amount, entry.currency, settings.baseCurrency)
  }, 0)
}

export function hasInitialBalance(settings: BudgetSettings): boolean {
  return getInitialBalances(settings).some((entry) => entry.amount > 0)
}

/** @deprecated Prefer getInitialSavingsBalancesByCurrency for multi-currency. */
export function getInitialSavingsBalanceFromEntries(settings: BudgetSettings): number {
  const savingsCurrency = settings.savingsAccountCurrency ?? 'RUB'
  return getInitialSavingsBalancesByCurrency(settings).get(savingsCurrency) ?? 0
}

/** Начальные остатки по валютам (сумма сумм). */
export function getInitialSavingsBalancesByCurrency(
  settings: BudgetSettings,
): Map<string, number> {
  const map = new Map<string, number>()
  for (const entry of getInitialBalances(settings)) {
    if (entry.amount === 0) continue
    map.set(entry.currency, (map.get(entry.currency) ?? 0) + entry.amount)
  }
  return map
}

/**
 * Эффективная ставка по валюте: средневзвешенная по суммам записей,
 * иначе legacy savingsAnnualRate для валюты накопительного счёта, иначе 0.
 */
export function getSavingsAnnualRateForCurrency(
  settings: BudgetSettings,
  currency: string,
): number {
  const entries = getInitialBalances(settings).filter(
    (entry) => entry.currency === currency && entry.amount > 0,
  )
  if (entries.length > 0) {
    let weighted = 0
    let weight = 0
    for (const entry of entries) {
      const rate =
        entry.annualRate != null && !Number.isNaN(entry.annualRate) && entry.annualRate >= 0
          ? entry.annualRate
          : settings.savingsAnnualRate ?? DEFAULT_RATE
      weighted += entry.amount * rate
      weight += entry.amount
    }
    if (weight > 0) return weighted / weight
  }
  if (currency === (settings.savingsAccountCurrency ?? 'RUB')) {
    const rate = settings.savingsAnnualRate
    if (rate == null || Number.isNaN(rate) || rate < 0) return DEFAULT_RATE
    return rate
  }
  return 0
}

export function getSavingsCurrencies(settings: BudgetSettings): string[] {
  return [...getInitialSavingsBalancesByCurrency(settings).keys()]
}

export function describeInitialBalances(settings: BudgetSettings): string {
  const entries = getInitialBalances(settings).filter((entry) => entry.amount > 0)
  if (entries.length === 0) return '0'
  return entries
    .map((entry) => {
      const comment = entry.comment?.trim()
      const rate =
        entry.annualRate != null && entry.annualRate > 0
          ? `, ${entry.annualRate}%`
          : ''
      const base = `${entry.amount} ${entry.currency}${rate}`
      return comment ? `${base} (${comment})` : base
    })
    .join(' + ')
}

export function migrateInitialBalances(settings: BudgetSettings): BudgetSettings {
  const defaultRate = settings.savingsAnnualRate ?? DEFAULT_RATE

  if (settings.initialBalances !== undefined) {
    const initialBalances = settings.initialBalances.map((entry) =>
      entry.annualRate == null ? { ...entry, annualRate: defaultRate } : entry,
    )
    return { ...settings, initialBalances }
  }

  const legacyAmount = settings.initialBalance ?? 0
  if (legacyAmount === 0) {
    return { ...settings, initialBalances: [] }
  }
  return {
    ...settings,
    initialBalances: [
      {
        id: 'migrated',
        amount: legacyAmount,
        currency: settings.initialBalanceCurrency ?? settings.baseCurrency,
        annualRate: defaultRate,
      },
    ],
  }
}

export function createInitialBalanceEntry(
  partial?: Partial<Pick<InitialBalanceEntry, 'amount' | 'currency' | 'comment' | 'annualRate'>>,
  defaultRate: number = DEFAULT_RATE,
): InitialBalanceEntry {
  return {
    id: createId(),
    amount: partial?.amount ?? 0,
    currency: partial?.currency ?? 'EUR',
    comment: partial?.comment,
    annualRate: partial?.annualRate ?? defaultRate,
  }
}
