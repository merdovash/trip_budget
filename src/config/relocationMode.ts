import { COUNTRY_LABELS } from '../tax/registry'
import type { BudgetSettings, RecurringItem, RelocationMode } from '../types/budget'

export const RELOCATION_MODE_LABELS: Record<RelocationMode, string> = {
  remote_employment: 'Работа в другой стране (зарплата / удалёнка)',
  sole_proprietorship: 'ИП / самозанятость в стране проживания',
}

/** Страны, где может выплачиваться зарплата при удалённой работе. */
export const EMPLOYMENT_COUNTRIES = [
  { code: 'RU', label: 'Россия', currency: 'RUB' },
  { code: 'ES', label: 'Испания', currency: 'EUR' },
] as const

export type EmploymentCountryCode = (typeof EMPLOYMENT_COUNTRIES)[number]['code']

/** Рекомендуемый налоговый режим при открытии ИП в стране проживания. */
export const SOLE_PROPRIETOR_REGIME_BY_COUNTRY: Partial<Record<string, string>> = {
  RU: 'ru-standard',
  GE: 'ge-small-business',
  ES: 'es-standard',
  TH: 'th-standard',
  PT: 'pt-standard',
  MY: 'my-standard',
}

export function getRelocationMode(settings: BudgetSettings): RelocationMode {
  return settings.relocationMode ?? 'remote_employment'
}

function normalizeEmploymentCode(code: string | undefined): EmploymentCountryCode {
  if (code === 'RU' || code === 'ES') return code
  return 'RU'
}

/** Страна зарплаты: из доходов (salaryCountryCode), иначе legacy settings.employmentCountryCode. */
export function getEmploymentCountryCode(
  settings: BudgetSettings,
  incomes?: RecurringItem[],
): EmploymentCountryCode {
  if (getRelocationMode(settings) === 'sole_proprietorship') {
    return 'RU'
  }
  if (incomes?.length) {
    const salary = incomes.find(
      (item) => item.categoryId === 'salary' || Boolean(item.salaryCountryCode),
    )
    if (salary?.salaryCountryCode) {
      return normalizeEmploymentCode(salary.salaryCountryCode)
    }
  }
  return normalizeEmploymentCode(settings.employmentCountryCode)
}

export function getEmploymentCountryLabel(
  settings: BudgetSettings,
  incomes?: RecurringItem[],
): string {
  const code = getEmploymentCountryCode(settings, incomes)
  return EMPLOYMENT_COUNTRIES.find((c) => c.code === code)?.label ?? COUNTRY_LABELS[code] ?? code
}

export function getEmploymentCountryCurrency(
  settings: BudgetSettings,
  incomes?: RecurringItem[],
): string {
  const code = getEmploymentCountryCode(settings, incomes)
  return EMPLOYMENT_COUNTRIES.find((c) => c.code === code)?.currency ?? 'EUR'
}

export function suggestTaxRegimeForMode(
  countryCode: string,
  mode: RelocationMode,
  _currentRegimeId: string,
): string | undefined {
  if (mode !== 'sole_proprietorship') return undefined
  return SOLE_PROPRIETOR_REGIME_BY_COUNTRY[countryCode]
}

export function shouldShowSourceCountryTaxes(
  settings: BudgetSettings,
  incomes?: RecurringItem[],
): boolean {
  if (getRelocationMode(settings) !== 'remote_employment') return false
  if (incomes?.length) {
    return incomes.some((item) => item.salaryCountryCode === 'RU')
  }
  return getEmploymentCountryCode(settings) === 'RU'
}
