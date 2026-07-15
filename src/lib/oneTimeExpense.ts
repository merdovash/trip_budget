import type { OneTimeExpense, RecurringItem } from '../types/budget'
import { getExpenseCountryScope } from './expenseCountry'
import type { BudgetSettings } from '../types/budget'
import { DEFAULT_SETTINGS } from '../types/budget'

/** Миграция старых разовых расходов в обычные статьи с frequency: 'once'. */
export function migrateLegacyOneTimeExpense(
  item: OneTimeExpense,
  settings: BudgetSettings = DEFAULT_SETTINGS,
): Omit<RecurringItem, 'id'> {
  return {
    expenseKind: 'regular',
    name: item.name,
    amount: item.amount,
    currency: item.currency,
    frequency: 'once',
    category: item.category,
    lifecycle: 'any',
    expenseCountryScope: getExpenseCountryScope(item, settings),
    startDate: item.date,
  }
}

export function isOnceExpense(item: RecurringItem): boolean {
  return item.frequency === 'once'
}
