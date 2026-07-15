import { getEmploymentCountryCode, getEmploymentCountryLabel } from '../config/relocationMode'
import { COUNTRY_LABELS } from '../tax/registry'
import type { BudgetSettings, ExpenseCountryScope, OneTimeExpense, RecurringItem } from '../types/budget'

export const EXPENSE_COUNTRY_SCOPES: ExpenseCountryScope[] = ['employment', 'residence', 'other']

type ExpenseCountryItem = {
  expenseCountryScope?: ExpenseCountryScope
  /** Устаревшее: ISO-код страны или scope. */
  expenseCountryCode?: string
}

export function normalizeExpenseCountryScope(
  raw: string | undefined,
  settings: BudgetSettings,
): ExpenseCountryScope {
  if (raw === 'employment' || raw === 'residence' || raw === 'other') return raw
  if (!raw) return 'residence'

  const employment = getEmploymentCountryCode(settings)
  const residence = settings.countryCode
  if (raw === residence) return 'residence'
  if (raw === employment) return 'employment'
  return 'other'
}

export function getExpenseCountryScope(
  item: ExpenseCountryItem,
  settings: BudgetSettings,
): ExpenseCountryScope {
  return normalizeExpenseCountryScope(item.expenseCountryScope ?? item.expenseCountryCode, settings)
}

export function getExpenseCountryScopeOptions(
  settings: BudgetSettings,
): { value: ExpenseCountryScope; label: string }[] {
  const employmentLabel = getEmploymentCountryLabel(settings)
  const residenceLabel = COUNTRY_LABELS[settings.countryCode] ?? settings.countryCode
  return [
    { value: 'employment', label: `Страна заработка (${employmentLabel})` },
    { value: 'residence', label: `Страна проживания (${residenceLabel})` },
    { value: 'other', label: 'Другое' },
  ]
}

export function getExpenseCountryScopeLabel(
  scope: ExpenseCountryScope,
  settings: BudgetSettings,
): string {
  return (
    getExpenseCountryScopeOptions(settings).find((option) => option.value === scope)?.label ??
    scope
  )
}

export function resolveExpenseCountryCode(
  scope: ExpenseCountryScope,
  settings: BudgetSettings,
): string | null {
  switch (scope) {
    case 'employment':
      return getEmploymentCountryCode(settings)
    case 'residence':
      return settings.countryCode
    case 'other':
      return null
  }
}

export function isResidenceScopeExpense(
  item: RecurringItem | OneTimeExpense,
  settings: BudgetSettings,
): boolean {
  return getExpenseCountryScope(item, settings) === 'residence'
}
