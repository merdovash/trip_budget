import type { ThailandDeductionSettings } from '../types/budget'

export type RegimeParamValue = number

export interface RegimeParamField {
  id: keyof ThailandDeductionSettings
  label: string
  hint?: string
  min?: number
  max?: number
  step?: number
  currency?: string
}

export interface RegimeParamsSchema {
  title: string
  description?: string
  fields: RegimeParamField[]
}

const THAILAND_PIT_DEDUCTION_FIELDS: RegimeParamField[] = [
  {
    id: 'parentAllowances',
    label: 'Родители 60+ (кол-во)',
    min: 0,
    max: 4,
    step: 1,
  },
  {
    id: 'lifeInsurance',
    label: 'Страхование жизни',
    min: 0,
    currency: 'THB',
  },
  {
    id: 'healthInsurance',
    label: 'Медстрахование',
    hint: 'Макс. ฿25 000',
    min: 0,
    currency: 'THB',
  },
  {
    id: 'mortgageInterest',
    label: 'Проценты по ипотеке',
    hint: 'Макс. ฿100 000',
    min: 0,
    currency: 'THB',
  },
  {
    id: 'providentFund',
    label: 'Provident Fund',
    min: 0,
    currency: 'THB',
  },
  {
    id: 'rmfContribution',
    label: 'Взносы RMF',
    min: 0,
    currency: 'THB',
  },
  {
    id: 'socialSecurityPaid',
    label: 'Уплаченный Social Security',
    hint: 'Макс. ~฿10 500/год',
    min: 0,
    currency: 'THB',
  },
]

const THAILAND_PIT_REGIME_IDS = new Set([
  'th-standard',
  'th-employed',
  'th-ltr-investment',
  'th-property-3m',
])

/** Схема доп. параметров для страны и налогового режима (если есть). */
export function getRegimeParamsSchema(
  countryCode: string,
  taxRegimeId: string,
): RegimeParamsSchema | null {
  if (countryCode === 'TH' && THAILAND_PIT_REGIME_IDS.has(taxRegimeId)) {
    return {
      title: 'Вычеты PIT Таиланда',
      description: 'Суммы в THB. Применяются к расчёту PIT в этой точке маршрута.',
      fields: THAILAND_PIT_DEDUCTION_FIELDS,
    }
  }
  return null
}

export function hasRegimeParams(countryCode: string, taxRegimeId: string): boolean {
  return getRegimeParamsSchema(countryCode, taxRegimeId) != null
}
