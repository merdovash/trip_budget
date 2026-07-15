import type { TaxBreakdownItem, TaxCalculator, TaxInput, TaxResult } from '../types'
import { formatCurrency } from '../../lib/format'

/** Плоская ставка PIT для резидентов Грузии. */
export const GE_STANDARD_PIT_RATE = 0.2

/** Статус малого бизнеса: 1% с оборота (лимит оборота 500 000 GEL в год). */
export const GE_SMALL_BUSINESS_RATE = 0.01
export const GE_SMALL_BUSINESS_TURNOVER_CAP = 500_000

/** Virtual Zone: упрощённо 1% при распределении прибыли IT-компании. */
export const GE_VIRTUAL_ZONE_RATE = 0.01

/** Обязательный пенсионный взнос работника (только локальная зарплата в GE). */
export const GE_PENSION_EMPLOYEE_RATE = 0.02

export function getGeorgiaPitRate(regimeId: string): number {
  switch (regimeId) {
    case 'ge-small-business':
      return GE_SMALL_BUSINESS_RATE
    case 'ge-virtual':
      return GE_VIRTUAL_ZONE_RATE
    default:
      return GE_STANDARD_PIT_RATE
  }
}

function formatLocal(amount: number): string {
  return formatCurrency(amount, 'GEL')
}

export interface BuildGeorgiaTaxResultOptions {
  regimeId?: string
  foreignSalaryGrossBase?: number
  foreignTaxCreditBase?: number
  pitNetBase?: number
  localEmploymentGrossBase?: number
}

export function buildGeorgiaTaxResult(
  grossAnnualIncome: number,
  _baseCurrency: string,
  _input: TaxInput,
  options: BuildGeorgiaTaxResultOptions = {},
): TaxResult {
  const regimeId = options.regimeId ?? 'ge-standard'
  const pitRate = getGeorgiaPitRate(regimeId)
  const taxableBase = grossAnnualIncome
  const pitGross = taxableBase * pitRate
  const pitNet = options.pitNetBase ?? pitGross

  const localEmploymentGross = options.localEmploymentGrossBase ?? 0
  const pensionContributions = localEmploymentGross * GE_PENSION_EMPLOYEE_RATE

  const breakdown: TaxBreakdownItem[] = []

  if (options.foreignSalaryGrossBase && options.foreignSalaryGrossBase > 0) {
    breakdown.push({
      label: 'Зарплата РФ в налоговой базе GE',
      amount: options.foreignSalaryGrossBase,
      description:
        'Мировой доход резидента Грузии облагается PIT. Зарплата российского работодателя включена в декларацию.',
      kind: 'gross',
    })
  }

  breakdown.push({
    label: 'Налоговая база PIT',
    amount: taxableBase,
    description:
      regimeId === 'ge-small-business'
        ? 'Статус малого бизнеса: 1% с валового оборота (упрощ., лимит 500 000 GEL).'
        : 'Резиденты Грузии облагаются с мирового дохода (упрощ.).',
    kind: 'base',
  })

  breakdown.push({
    label:
      regimeId === 'ge-small-business'
        ? 'Налог малого бизнеса (1%)'
        : regimeId === 'ge-virtual'
          ? 'Налог Virtual Zone (1%)'
          : 'Подоходный налог (20%)',
    amount: pitGross,
    formula: `${formatLocal(taxableBase)} × ${(pitRate * 100).toFixed(0)}%`,
    kind: 'tax',
  })

  if (options.foreignTaxCreditBase && options.foreignTaxCreditBase > 0) {
    breakdown.push({
      label: 'Зачёт НДФЛ РФ',
      amount: options.foreignTaxCreditBase,
      description: 'Кредит по договору об избежании двойного налогообложения РФ–Грузия (упрощ.).',
      kind: 'deduction',
    })
  }

  if (pitNet !== pitGross) {
    breakdown.push({
      label: 'PIT к уплате в GE (после зачёта)',
      amount: pitNet,
      kind: 'tax',
    })
  }

  if (pensionContributions > 0) {
    breakdown.push({
      label: 'Пенсионный взнос работника (2%)',
      amount: pensionContributions,
      description: 'Только на зарплату от работодателя в Грузии.',
      kind: 'tax',
    })
  }

  const incomeTax = pitNet
  const socialContributions = pensionContributions
  const totalTax = incomeTax + socialContributions

  return {
    grossIncome: grossAnnualIncome,
    incomeTax,
    socialContributions,
    netIncome: grossAnnualIncome - totalTax,
    effectiveRate: grossAnnualIncome > 0 ? totalTax / grossAnnualIncome : 0,
    breakdown,
  }
}

export const georgiaStandard: TaxCalculator = {
  id: 'ge-standard',
  countryCode: 'GE',
  name: 'Резидент (20%)',
  description:
    'Налоговый резидент Грузии (183+ дней в году или центр жизненных интересов): плоский PIT 20% с мирового дохода.',
  calculate(input: TaxInput) {
    return buildGeorgiaTaxResult(input.grossAnnualIncome, 'GEL', input, {
      regimeId: 'ge-standard',
    })
  },
}

export const georgiaSmallBusiness: TaxCalculator = {
  id: 'ge-small-business',
  countryCode: 'GE',
  name: 'Малый бизнес (1%)',
  description:
    'Статус малого бизнеса для ИП: 1% с валового оборота до 500 000 GEL в год. Подходит для фриланса и удалённой работы как ИП.',
  calculate(input: TaxInput) {
    return buildGeorgiaTaxResult(input.grossAnnualIncome, 'GEL', input, {
      regimeId: 'ge-small-business',
    })
  },
}

export const georgiaVirtualZone: TaxCalculator = {
  id: 'ge-virtual',
  countryCode: 'GE',
  name: 'Virtual Zone (упрощ.)',
  description:
    'IT-компания в Virtual Zone: 0% на прибыль от зарубежных IT-услуг; при распределении физлицу — упрощённо 1%.',
  calculate(input: TaxInput) {
    return buildGeorgiaTaxResult(input.grossAnnualIncome, 'GEL', input, {
      regimeId: 'ge-virtual',
    })
  },
}
