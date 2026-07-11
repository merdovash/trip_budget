import type { TaxCalculator } from './types'
import {
  cyprusNonDom,
  cyprusStandard,
  georgiaStandard,
  georgiaVirtualZone,
  indonesiaStandard,
  malaysiaExpat,
  malaysiaStandard,
  mexicoStandard,
  portugalStandard,
  spainBeckham,
  spainEmployed,
  spainStandard,
  thailandStandard,
  uaeNoTax,
  vietnamStandard,
} from './countries'

export const TAX_CALCULATORS: TaxCalculator[] = [
  spainEmployed,
  spainStandard,
  spainBeckham,
  thailandStandard,
  malaysiaStandard,
  malaysiaExpat,
  portugalStandard,
  uaeNoTax,
  georgiaStandard,
  georgiaVirtualZone,
  cyprusStandard,
  cyprusNonDom,
  mexicoStandard,
  indonesiaStandard,
  vietnamStandard,
]

export const COUNTRY_LABELS: Record<string, string> = {
  ES: 'Испания',
  TH: 'Таиланд',
  MY: 'Малайзия',
  PT: 'Португалия',
  AE: 'ОАЭ',
  GE: 'Грузия',
  CY: 'Кипр',
  MX: 'Мексика',
  ID: 'Индонезия',
  VN: 'Вьетнам',
}

export function getTaxCalculator(id: string): TaxCalculator | undefined {
  return TAX_CALCULATORS.find((c) => c.id === id)
}

export function getCalculatorsByCountry(countryCode: string): TaxCalculator[] {
  return TAX_CALCULATORS.filter((c) => c.countryCode === countryCode)
}

export function getAvailableCountries(): string[] {
  return [...new Set(TAX_CALCULATORS.map((c) => c.countryCode))]
}
