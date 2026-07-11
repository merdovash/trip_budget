import type { TaxBracket, TaxCalculator, TaxInput } from '../types'
import { buildTaxResult, calculateProgressiveTax } from '../types'

function progressiveCalculator(
  id: string,
  countryCode: string,
  name: string,
  description: string,
  brackets: TaxBracket[],
  socialRate = 0,
  socialLabel = 'Социальные взносы',
): TaxCalculator {
  return {
    id,
    countryCode,
    name,
    description,
    calculate(input: TaxInput) {
      const incomeTax = calculateProgressiveTax(input.grossAnnualIncome, brackets)
      const socialContributions = input.grossAnnualIncome * socialRate
      const breakdown = [{ label: 'Подоходный налог', amount: incomeTax }]
      if (socialContributions > 0) {
        breakdown.push({ label: socialLabel, amount: socialContributions })
      }
      return buildTaxResult(input.grossAnnualIncome, incomeTax, socialContributions, breakdown)
    },
  }
}

export const spainStandard: TaxCalculator = progressiveCalculator(
  'es-standard',
  'ES',
  'Стандартный IRPF',
  'Прогрессивная шкала подоходного налога Испании (упрощённо, без региональных надбавок).',
  [
    { upTo: 12450, rate: 0.19 },
    { upTo: 20200, rate: 0.24 },
    { upTo: 35200, rate: 0.3 },
    { upTo: 60000, rate: 0.37 },
    { upTo: 300000, rate: 0.45 },
    { upTo: null, rate: 0.47 },
  ],
  0.065,
)

export const spainBeckham: TaxCalculator = {
  id: 'es-beckham',
  countryCode: 'ES',
  name: 'Beckham Law (упрощ.)',
  description: 'Фиксированная ставка 24% на доход до €600 000 для новых резидентов (упрощённая модель).',
  calculate(input: TaxInput) {
    const threshold = 600_000
    const incomeTax =
      input.grossAnnualIncome <= threshold
        ? input.grossAnnualIncome * 0.24
        : threshold * 0.24 + (input.grossAnnualIncome - threshold) * 0.47
    return buildTaxResult(input.grossAnnualIncome, incomeTax, 0, [
      { label: 'Подоходный налог (Beckham Law)', amount: incomeTax },
    ])
  },
}

export const thailandStandard: TaxCalculator = progressiveCalculator(
  'th-standard',
  'TH',
  'Стандартный PIT',
  'Прогрессивный подоходный налог Таиланда.',
  [
    { upTo: 150_000, rate: 0 },
    { upTo: 300_000, rate: 0.05 },
    { upTo: 500_000, rate: 0.1 },
    { upTo: 750_000, rate: 0.15 },
    { upTo: 1_000_000, rate: 0.2 },
    { upTo: 2_000_000, rate: 0.25 },
    { upTo: 5_000_000, rate: 0.3 },
    { upTo: null, rate: 0.35 },
  ],
)

export const malaysiaStandard: TaxCalculator = progressiveCalculator(
  'my-standard',
  'MY',
  'Стандартный',
  'Прогрессивный подоходный налог Малайзии.',
  [
    { upTo: 5_000, rate: 0 },
    { upTo: 20_000, rate: 0.01 },
    { upTo: 35_000, rate: 0.03 },
    { upTo: 50_000, rate: 0.06 },
    { upTo: 70_000, rate: 0.11 },
    { upTo: 100_000, rate: 0.19 },
    { upTo: 400_000, rate: 0.25 },
    { upTo: 600_000, rate: 0.26 },
    { upTo: 2_000_000, rate: 0.28 },
    { upTo: null, rate: 0.3 },
  ],
)

export const malaysiaExpat: TaxCalculator = progressiveCalculator(
  'my-expat',
  'MY',
  'Expat / MM2H (упрощ.)',
  'Упрощённая модель для экспатов: те же шкалы с базовым вычетом на иждивенцев.',
  [
    { upTo: 5_000, rate: 0 },
    { upTo: 20_000, rate: 0.01 },
    { upTo: 35_000, rate: 0.03 },
    { upTo: 50_000, rate: 0.06 },
    { upTo: 70_000, rate: 0.11 },
    { upTo: 100_000, rate: 0.19 },
    { upTo: 400_000, rate: 0.25 },
    { upTo: 600_000, rate: 0.26 },
    { upTo: 2_000_000, rate: 0.28 },
    { upTo: null, rate: 0.3 },
  ],
)

export const portugalStandard: TaxCalculator = progressiveCalculator(
  'pt-standard',
  'PT',
  'Стандартный IRS',
  'Прогрессивный подоходный налог Португалии (упрощённо).',
  [
    { upTo: 7_703, rate: 0.13 },
    { upTo: 11_623, rate: 0.165 },
    { upTo: 16_472, rate: 0.22 },
    { upTo: 21_321, rate: 0.25 },
    { upTo: 27_146, rate: 0.32 },
    { upTo: 39_791, rate: 0.35 },
    { upTo: 51_997, rate: 0.37 },
    { upTo: 81_199, rate: 0.435 },
    { upTo: null, rate: 0.48 },
  ],
  0.11,
)

export const uaeNoTax: TaxCalculator = {
  id: 'ae-none',
  countryCode: 'AE',
  name: 'Без подоходного налога',
  description: 'ОАЭ не взимают подоходный налог с физических лиц (упрощённая модель).',
  calculate(input: TaxInput) {
    return buildTaxResult(input.grossAnnualIncome, 0, 0, [
      { label: 'Подоходный налог', amount: 0 },
    ])
  },
}

export const georgiaStandard: TaxCalculator = {
  id: 'ge-standard',
  countryCode: 'GE',
  name: 'Стандартный (20%)',
  description: 'Плоская ставка 20% на доход резидентов Грузии.',
  calculate(input: TaxInput) {
    const incomeTax = input.grossAnnualIncome * 0.2
    return buildTaxResult(input.grossAnnualIncome, incomeTax, 0, [
      { label: 'Подоходный налог (20%)', amount: incomeTax },
    ])
  },
}

export const georgiaVirtualZone: TaxCalculator = {
  id: 'ge-virtual',
  countryCode: 'GE',
  name: 'Virtual Zone (упрощ.)',
  description: 'Упрощённая модель для IT-компаний в Virtual Zone: 1% на дивиденды/распределение.',
  calculate(input: TaxInput) {
    const incomeTax = input.grossAnnualIncome * 0.01
    return buildTaxResult(input.grossAnnualIncome, incomeTax, 0, [
      { label: 'Налог Virtual Zone (1%)', amount: incomeTax },
    ])
  },
}

export const cyprusStandard: TaxCalculator = progressiveCalculator(
  'cy-standard',
  'CY',
  'Стандартный',
  'Прогрессивный подоходный налог Кипра.',
  [
    { upTo: 19_500, rate: 0 },
    { upTo: 28_000, rate: 0.2 },
    { upTo: 36_300, rate: 0.25 },
    { upTo: 60_000, rate: 0.3 },
    { upTo: null, rate: 0.35 },
  ],
  0.083,
)

export const cyprusNonDom: TaxCalculator = {
  id: 'cy-nondom',
  countryCode: 'CY',
  name: 'Non-Dom (упрощ.)',
  description: 'Non-Dom режим: 0% на дивиденды, стандартная шкала на остальной доход (упрощ.).',
  calculate(input: TaxInput) {
    const employmentIncome = input.grossAnnualIncome * 0.7
    const employmentTax = calculateProgressiveTax(employmentIncome, [
      { upTo: 19_500, rate: 0 },
      { upTo: 28_000, rate: 0.2 },
      { upTo: 36_300, rate: 0.25 },
      { upTo: 60_000, rate: 0.3 },
      { upTo: null, rate: 0.35 },
    ])
    const socialContributions = employmentIncome * 0.083
    return buildTaxResult(input.grossAnnualIncome, employmentTax, socialContributions, [
      { label: 'Налог на трудовой доход', amount: employmentTax },
      { label: 'Налог на дивиденды (Non-Dom 0%)', amount: 0 },
      { label: 'Социальные взносы', amount: socialContributions },
    ])
  },
}

export const mexicoStandard: TaxCalculator = progressiveCalculator(
  'mx-standard',
  'MX',
  'Стандартный ISR',
  'Прогрессивный подоходный налог Мексики (упрощённо).',
  [
    { upTo: 7_735, rate: 0.0192 },
    { upTo: 65_651, rate: 0.064 },
    { upTo: 115_375, rate: 0.1088 },
    { upTo: 134_119, rate: 0.16 },
    { upTo: 160_577, rate: 0.1792 },
    { upTo: 323_862, rate: 0.2136 },
    { upTo: 510_451, rate: 0.2352 },
    { upTo: 974_535, rate: 0.3 },
    { upTo: 1_299_380, rate: 0.32 },
    { upTo: 3_898_140, rate: 0.34 },
    { upTo: null, rate: 0.35 },
  ],
)

export const indonesiaStandard: TaxCalculator = progressiveCalculator(
  'id-standard',
  'ID',
  'Стандартный PPh',
  'Прогрессивный подоходный налог Индонезии.',
  [
    { upTo: 60_000_000, rate: 0.05 },
    { upTo: 250_000_000, rate: 0.15 },
    { upTo: 500_000_000, rate: 0.25 },
    { upTo: 5_000_000_000, rate: 0.3 },
    { upTo: null, rate: 0.35 },
  ],
)

export const vietnamStandard: TaxCalculator = progressiveCalculator(
  'vn-standard',
  'VN',
  'Стандартный PIT',
  'Прогрессивный подоходный налог Вьетнама.',
  [
    { upTo: 60_000_000, rate: 0.05 },
    { upTo: 120_000_000, rate: 0.1 },
    { upTo: 216_000_000, rate: 0.15 },
    { upTo: 384_000_000, rate: 0.2 },
    { upTo: 624_000_000, rate: 0.25 },
    { upTo: 960_000_000, rate: 0.3 },
    { upTo: null, rate: 0.35 },
  ],
  0.08,
)
