import type { BudgetSettings, InitialBalanceEntry } from '../types/budget'
import { convertCurrency } from './currency'

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

export function getInitialSavingsBalanceFromEntries(settings: BudgetSettings): number {
  const savingsCurrency = settings.savingsAccountCurrency ?? 'RUB'
  return getInitialBalances(settings)
    .filter((entry) => entry.currency === savingsCurrency)
    .reduce((sum, entry) => sum + entry.amount, 0)
}

export function describeInitialBalances(settings: BudgetSettings): string {
  const entries = getInitialBalances(settings).filter((entry) => entry.amount > 0)
  if (entries.length === 0) return '0'
  return entries
    .map((entry) => {
      const comment = entry.comment?.trim()
      const base = `${entry.amount} ${entry.currency}`
      return comment ? `${base} (${comment})` : base
    })
    .join(' + ')
}

export function migrateInitialBalances(settings: BudgetSettings): BudgetSettings {
  if (settings.initialBalances !== undefined) {
    return settings
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
      },
    ],
  }
}

export function createInitialBalanceEntry(
  partial?: Partial<Pick<InitialBalanceEntry, 'amount' | 'currency' | 'comment'>>,
): InitialBalanceEntry {
  return {
    id: crypto.randomUUID(),
    amount: partial?.amount ?? 0,
    currency: partial?.currency ?? 'EUR',
    comment: partial?.comment,
  }
}
