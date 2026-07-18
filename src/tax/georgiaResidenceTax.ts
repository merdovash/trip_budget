import type { BudgetSettings, RecurringItem } from '../types/budget'
import { convertCurrency } from '../lib/currency'
import {
  buildGeorgiaTaxResult,
  getGeorgiaPitRate,
} from './countries/georgia'
import type { AdjustedResidenceTax } from './residenceTaxAdjust'
import {
  sumAnnualGrossIncomes,
  summarizeSourceSalaries,
} from './incomeSourceTax'
import type { TaxCalculator, TaxResult } from './types'
import { isForeignSalaryInResidenceBase } from './doubleTaxation'

export function usesGeorgiaForeignTaxCredit(item: RecurringItem): boolean {
  return isForeignSalaryInResidenceBase(item) && item.foreignTaxCredit !== false
}

export const GEORGIA_FOREIGN_SALARY_RULES = {
  title: 'Россиянин в Грузии — зарплата из РФ',
  summary:
    'По умолчанию зарплата РФ не входит в PIT Грузии: НДФЛ у источника в России. Если включить в декларацию — доход облагается как часть мирового дохода резидента (20% или 1% по режиму).',
  residency:
    'Резидентство GE: 183+ дней в календарном году или центр жизненных интересов. Резиденты платят PIT с мирового дохода.',
  foreignCredit:
    'Опция «Зачёт НДФЛ в РФ»: уплаченный НДФЛ зачитывается против PIT на эту зарплату (договор РФ–Грузия, упрощ.).',
} as const

function isLocalGeorgianEmployment(item: RecurringItem): boolean {
  return item.categoryId === 'salary' && item.salaryCountryCode === 'GE'
}

export function calculateGeorgiaWithRussianIncome(
  residenceIncomes: RecurringItem[],
  settings: BudgetSettings,
  calculator: TaxCalculator,
): AdjustedResidenceTax | null {
  const foreignItems = residenceIncomes.filter(isForeignSalaryInResidenceBase)
  if (foreignItems.length === 0) return null

  const baseCurrency = settings.baseCurrency
  const pitRate = getGeorgiaPitRate(calculator.id)
  const totalGross = sumAnnualGrossIncomes(residenceIncomes, baseCurrency)
  const foreignGross = sumAnnualGrossIncomes(foreignItems, baseCurrency)
  const localGross = Math.max(0, totalGross - foreignGross)

  const localEmploymentItems = residenceIncomes.filter(isLocalGeorgianEmployment)
  const localEmploymentGross = sumAnnualGrossIncomes(localEmploymentItems, baseCurrency)

  const taxableBase = totalGross
  const pitGross = taxableBase * pitRate
  const pitOnForeign = totalGross > 0 ? pitGross * (foreignGross / totalGross) : 0

  const creditItems = foreignItems.filter(usesGeorgiaForeignTaxCredit)
  const sourceSalary =
    creditItems.length > 0
      ? summarizeSourceSalaries(creditItems, settings.dependents, 'RUB')
      : null
  const sourceTaxInBase = sourceSalary
    ? convertCurrency(sourceSalary.ndfl, 'RUB', baseCurrency)
    : 0
  const foreignTaxCredit =
    creditItems.length > 0 ? Math.min(sourceTaxInBase, pitOnForeign) : 0
  const pitNetAfterCredit = Math.max(0, pitGross - foreignTaxCredit)
  const pensionOnLocal = localEmploymentGross * 0.02
  const totalTaxBurdenInBase =
    pitNetAfterCredit + pensionOnLocal + sourceTaxInBase - foreignTaxCredit

  const result = buildGeorgiaTaxResult(totalGross, baseCurrency, {
    grossAnnualIncome: totalGross,
    familySize: settings.familySize,
    dependents: settings.dependents,
  }, {
    regimeId: calculator.id,
    localEmploymentGrossBase: localEmploymentGross,
    foreignSalaryGrossBase: foreignGross,
    foreignTaxCreditBase: foreignTaxCredit,
    pitNetBase: pitNetAfterCredit,
  })

  result.effectiveRate = totalGross > 0 ? totalTaxBurdenInBase / totalGross : 0

  return {
    result,
    foreignSalary: {
      foreignSalaryGross: foreignGross,
      localIncomeGross: localGross,
      taxableBase,
      pitGross,
      pitOnForeignSalary: pitOnForeign,
      sourceTaxInBase,
      foreignTaxCredit,
      pitNetAfterCredit,
      pensionOnLocalIncome: pensionOnLocal,
      totalTaxBurdenInBase,
    },
  }
}

export function calculateGeorgiaResidenceTax(
  residenceIncomes: RecurringItem[],
  settings: BudgetSettings,
  calculator: TaxCalculator,
): TaxResult {
  const baseCurrency = settings.baseCurrency
  const grossAnnualIncome = sumAnnualGrossIncomes(residenceIncomes, baseCurrency)
  const localEmploymentGross = sumAnnualGrossIncomes(
    residenceIncomes.filter(isLocalGeorgianEmployment),
    baseCurrency,
  )

  return buildGeorgiaTaxResult(
    grossAnnualIncome,
    baseCurrency,
    {
      grossAnnualIncome,
      familySize: settings.familySize,
      dependents: settings.dependents,
    },
    {
      regimeId: calculator.id,
      localEmploymentGrossBase: localEmploymentGross,
    },
  )
}

export function adjustGeorgiaResidenceTaxResult(
  residenceIncomes: RecurringItem[],
  settings: BudgetSettings,
  calculator: TaxCalculator,
): AdjustedResidenceTax {
  const mixed = calculateGeorgiaWithRussianIncome(residenceIncomes, settings, calculator)
  if (mixed) return mixed

  return {
    result: calculateGeorgiaResidenceTax(residenceIncomes, settings, calculator),
  }
}
