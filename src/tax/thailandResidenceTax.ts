import type { BudgetSettings, RecurringItem } from '../types/budget'
import { convertCurrency } from '../lib/currency'
import {
  buildThailandTaxResult,
  calculateThailandPitBreakdown,
  TH_PIT_BRACKETS,
} from './countries/thailand'
import type { AdjustedResidenceTax as SpainAdjustedResidenceTax } from './spainForeignSalary'
import {
  isIncludedInResidenceTax,
  isRussiaSalary,
  sumAnnualGrossIncomes,
  summarizeRussiaSalaries,
} from './incomeSourceTax'
import type { TaxCalculator, TaxResult } from './types'
import { calculateProgressiveTax } from './types'

export function isRussiaSalaryInThaiBase(item: RecurringItem): boolean {
  return isRussiaSalary(item) && isIncludedInResidenceTax(item)
}

export function usesThailandForeignTaxCredit(item: RecurringItem): boolean {
  return isRussiaSalaryInThaiBase(item) && item.foreignTaxCredit !== false
}

export const THAILAND_RU_SALARY_RULES = {
  title: 'Россиянин в Таиланде — зарплата из РФ',
  summary:
    'По умолчанию зарплата РФ не входит в PIT Таиланда: НДФЛ у источника в России. Если включить в декларацию — доход облагается при remittance (Por. 161/2566, с 2024). Применяются тайские вычеты (50%/฿100k, personal, spouse, children).',
  remittance:
    'Иностранный доход облагается, если вы резидент TH (180+ дней в год заработка) и переводите деньги в Таиланд. Доход до 01.01.2024 и доход в годы нерезидентства — вне PIT.',
  foreignCredit:
    'Опция «Зачёт НДФЛ в РФ»: уплаченный НДФЛ зачитывается против PIT на эту зарплату (договор об избежании двойного налогообложения, упрощ.).',
} as const

export interface ThailandForeignSalaryBreakdown {
  foreignSalaryGross: number
  localIncomeGross: number
  taxableBaseThb: number
  pitGross: number
  pitOnForeignSalary: number
  russianNdflInBase: number
  foreignTaxCredit: number
  pitNetAfterCredit: number
  socialOnLocalIncome: number
  totalTaxBurdenInBase: number
}

function isLocalThailandEmployment(item: RecurringItem): boolean {
  return item.categoryId === 'salary' && item.salaryCountryCode === 'TH'
}

export function calculateThailandWithRussianIncome(
  residenceIncomes: RecurringItem[],
  settings: BudgetSettings,
  includeSocialSecurity: boolean,
): SpainAdjustedResidenceTax | null {
  const foreignItems = residenceIncomes.filter(isRussiaSalaryInThaiBase)
  if (foreignItems.length === 0) return null

  const baseCurrency = settings.baseCurrency
  const totalGross = sumAnnualGrossIncomes(residenceIncomes, baseCurrency)
  const foreignGross = sumAnnualGrossIncomes(foreignItems, baseCurrency)
  const localGross = Math.max(0, totalGross - foreignGross)

  const localEmploymentItems = residenceIncomes.filter(isLocalThailandEmployment)
  const localEmploymentGross = sumAnnualGrossIncomes(localEmploymentItems, baseCurrency)

  const input = {
    grossAnnualIncome: totalGross,
    familySize: settings.familySize,
    dependents: settings.dependents,
  }

  const grossThb = convertCurrency(totalGross, baseCurrency, 'THB')
  const pitBreakdown = calculateThailandPitBreakdown(
    grossThb,
    input,
    settings.thailandDeductions,
    {
      localEmploymentGrossThb: convertCurrency(localEmploymentGross, baseCurrency, 'THB'),
      includeSocialSecurity,
    },
  )

  const pitGross = convertCurrency(pitBreakdown.pitGrossThb, 'THB', baseCurrency)
  const pitOnForeign = totalGross > 0 ? pitGross * (foreignGross / totalGross) : 0

  const creditItems = foreignItems.filter(usesThailandForeignTaxCredit)
  const russianSummary =
    creditItems.length > 0 ? summarizeRussiaSalaries(creditItems, settings.dependents) : null
  const russianNdflInBase = russianSummary
    ? convertCurrency(russianSummary.ndfl, 'RUB', baseCurrency)
    : 0
  const foreignTaxCredit =
    creditItems.length > 0 ? Math.min(russianNdflInBase, pitOnForeign) : 0
  const pitNetAfterCredit = Math.max(0, pitGross - foreignTaxCredit)
  const socialOnLocal = convertCurrency(pitBreakdown.socialContributionsThb, 'THB', baseCurrency)
  const totalTaxBurdenInBase =
    pitNetAfterCredit + socialOnLocal + russianNdflInBase - foreignTaxCredit

  const result = buildThailandTaxResult(totalGross, baseCurrency, input, settings.thailandDeductions, {
    localEmploymentGrossBase: localEmploymentGross,
    includeSocialSecurity,
    foreignSalaryGrossBase: foreignGross,
    foreignTaxCreditBase: foreignTaxCredit,
    pitNetBase: pitNetAfterCredit,
  })

  result.effectiveRate = totalGross > 0 ? totalTaxBurdenInBase / totalGross : 0

  return {
    result,
    thailandForeignSalary: {
      foreignSalaryGross: foreignGross,
      localIncomeGross: localGross,
      taxableBaseThb: pitBreakdown.taxableBaseThb,
      pitGross,
      pitOnForeignSalary: pitOnForeign,
      russianNdflInBase,
      foreignTaxCredit,
      pitNetAfterCredit,
      socialOnLocalIncome: socialOnLocal,
      totalTaxBurdenInBase,
    },
  }
}

export function calculateThailandResidenceTax(
  residenceIncomes: RecurringItem[],
  settings: BudgetSettings,
  calculator: TaxCalculator,
): TaxResult {
  const baseCurrency = settings.baseCurrency
  const grossAnnualIncome = sumAnnualGrossIncomes(residenceIncomes, baseCurrency)
  const localEmploymentGross = sumAnnualGrossIncomes(
    residenceIncomes.filter(isLocalThailandEmployment),
    baseCurrency,
  )
  const includeSocialSecurity = calculator.id === 'th-employed'

  return buildThailandTaxResult(
    grossAnnualIncome,
    baseCurrency,
    {
      grossAnnualIncome,
      familySize: settings.familySize,
      dependents: settings.dependents,
    },
    settings.thailandDeductions,
    {
      localEmploymentGrossBase: localEmploymentGross,
      includeSocialSecurity,
    },
  )
}

export function adjustThailandResidenceTaxResult(
  residenceIncomes: RecurringItem[],
  settings: BudgetSettings,
  calculator: TaxCalculator,
): SpainAdjustedResidenceTax {
  const includeSocialSecurity = calculator.id === 'th-employed'
  const mixed = calculateThailandWithRussianIncome(residenceIncomes, settings, includeSocialSecurity)
  if (mixed) return mixed

  return {
    result: calculateThailandResidenceTax(residenceIncomes, settings, calculator),
  }
}

/** Для тестов: PIT на базе в THB без конвертации. */
export function calculateThailandPitOnTaxableThb(taxableThb: number): number {
  return calculateProgressiveTax(taxableThb, TH_PIT_BRACKETS)
}
