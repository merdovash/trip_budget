import { COUNTRY_LABELS } from '../tax/registry'
import type { BudgetSettings, RelocationMode } from '../types/budget'

export const RELOCATION_MODE_LABELS: Record<RelocationMode, string> = {
  remote_employment: 'Работа в другой стране (зарплата / удалёнка)',
  sole_proprietorship: 'ИП / самозанятость в стране проживания',
}

/** Страны, где может выплачиваться зарплата при удалённой работе. */
export const EMPLOYMENT_COUNTRIES = [
  { code: 'RU', label: 'Россия' },
  { code: 'ES', label: 'Испания' },
] as const

export type EmploymentCountryCode = (typeof EMPLOYMENT_COUNTRIES)[number]['code']

/** Рекомендуемый налоговый режим при открытии ИП в стране проживания. */
export const SOLE_PROPRIETOR_REGIME_BY_COUNTRY: Partial<Record<string, string>> = {
  GE: 'ge-small-business',
  ES: 'es-standard',
  TH: 'th-standard',
  PT: 'pt-standard',
  MY: 'my-standard',
}

export function getRelocationMode(settings: BudgetSettings): RelocationMode {
  return settings.relocationMode ?? 'remote_employment'
}

export function getEmploymentCountryCode(settings: BudgetSettings): EmploymentCountryCode {
  if (getRelocationMode(settings) === 'sole_proprietorship') {
    return 'RU'
  }
  const code = settings.employmentCountryCode
  if (code === 'RU' || code === 'ES') return code
  return 'RU'
}

export function getEmploymentCountryLabel(settings: BudgetSettings): string {
  const code = getEmploymentCountryCode(settings)
  return EMPLOYMENT_COUNTRIES.find((c) => c.code === code)?.label ?? COUNTRY_LABELS[code] ?? code
}

export function suggestTaxRegimeForMode(
  countryCode: string,
  mode: RelocationMode,
  _currentRegimeId: string,
): string | undefined {
  if (mode !== 'sole_proprietorship') return undefined
  return SOLE_PROPRIETOR_REGIME_BY_COUNTRY[countryCode]
}

export function shouldShowSourceCountryTaxes(settings: BudgetSettings): boolean {
  return (
    getRelocationMode(settings) === 'remote_employment' &&
    getEmploymentCountryCode(settings) === 'RU'
  )
}
