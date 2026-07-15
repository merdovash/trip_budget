import type { BudgetSettings, OneTimeExpense, RecurringItem } from '../types/budget'
import { convertCurrency } from '../lib/currency'
import {
  calculateSpainEmployeeTax,
  SPAIN_IRPF_BRACKETS,
  SPAIN_PERSONAL_ALLOWANCE,
  SPAIN_DEPENDENT_ALLOWANCE,
} from './countries/spain'
import {
  filterResidenceTaxableIncomes,
  isIncludedInResidenceTax,
  isSalaryFrom,
  sumAnnualGrossIncomes,
  summarizeSourceSalaries,
} from './incomeSourceTax'
import type { TaxCalculator, TaxResult } from './types'
import { breakdownProgressiveTax, calculateProgressiveTax } from './types'
import { adjustThailandResidenceTaxResult } from './thailandResidenceTax'
import { adjustGeorgiaResidenceTaxResult } from './georgiaResidenceTax'
import { isForeignSalaryInResidenceBase, usesResidenceForeignTaxCredit } from './doubleTaxation'

/** Зачёт налога у источника против IRPF (упрощ.). */
export function usesForeignTaxCredit(item: RecurringItem): boolean {
  return usesResidenceForeignTaxCredit(item)
}

export const SPAIN_DEDUCTIONS_WITH_FOREIGN_SALARY = {
  title: 'Вычеты Испании при зарплате из России',
  summary:
    'Да — если зарплата РФ включена в декларацию IRPF («Учитывать в налогах проживания»). Mínimo personal y familiar уменьшает общую базу IRPF. Cuota SS работника начисляется только на доход в Испании, не на зарплату российского работодателя.',
  foreignCredit:
    'Опция «Зачёт НДФЛ в РФ»: уплаченный НДФЛ зачитывается против IRPF на эту зарплату (Art. 80 Ley 35/2006, упрощ.).',
} as const

export interface ForeignSalaryBreakdown {
  foreignSalaryGross: number
  localIncomeGross: number
  sourceTaxInBase?: number
  foreignTaxCredit: number
  totalTaxBurdenInBase: number
  personalAllowance?: number
  socialOnLocalIncome?: number
  taxableBaseIrpf?: number
  irpfGross?: number
  irpfOnForeignSalary?: number
  irpfNetAfterCredit?: number
  foreignSalaryTaxableGross?: number
  foreignSalaryExcluded?: number
  remittanceEstimate?: number
  taxableBase?: number
  pitGross?: number
  pitOnForeignSalary?: number
  pitNetAfterCredit?: number
  pensionOnLocalIncome?: number
}

export interface AdjustedResidenceTax {
  result: TaxResult
  foreignSalary?: ForeignSalaryBreakdown
}

export type SpainForeignSalaryBreakdown = ForeignSalaryBreakdown
export type SpainAdjustedResidenceTax = AdjustedResidenceTax

function personalAllowanceAmount(dependents: number): number {
  return SPAIN_PERSONAL_ALLOWANCE + dependents * SPAIN_DEPENDENT_ALLOWANCE
}

/** IRPF + SS для смешанного дохода (ES local + RU salary в декларации). */
export function calculateSpainEmployedWithForeignSalary(
  residenceIncomes: RecurringItem[],
  settings: BudgetSettings,
): AdjustedResidenceTax | null {
  const foreignItems = residenceIncomes.filter(isForeignSalaryInResidenceBase)
  if (foreignItems.length === 0) return null

  const baseCurrency = settings.baseCurrency
  const totalGross = sumAnnualGrossIncomes(residenceIncomes, baseCurrency)
  const foreignGross = sumAnnualGrossIncomes(foreignItems, baseCurrency)
  const localGross = Math.max(0, totalGross - foreignGross)

  const allowances = personalAllowanceAmount(settings.dependents)
  const localEmployee = calculateSpainEmployeeTax({
    grossAnnualIncome: localGross,
    familySize: settings.familySize,
    dependents: settings.dependents,
  })
  const socialOnLocal = localEmployee.socialContributions

  const taxableBaseIrpf = Math.max(0, totalGross - socialOnLocal - allowances)
  const bracketLines = breakdownProgressiveTax(taxableBaseIrpf, SPAIN_IRPF_BRACKETS)
  const irpfGross = calculateProgressiveTax(taxableBaseIrpf, SPAIN_IRPF_BRACKETS)
  const irpfOnForeign = totalGross > 0 ? irpfGross * (foreignGross / totalGross) : 0

  const creditItems = foreignItems.filter(usesForeignTaxCredit)
  const sourceSalary =
    creditItems.length > 0
      ? summarizeSourceSalaries(creditItems, settings.dependents, 'RUB')
      : null
  const sourceTaxInBase = sourceSalary
    ? convertCurrency(sourceSalary.ndfl, 'RUB', baseCurrency)
    : 0
  const foreignTaxCredit =
    creditItems.length > 0 ? Math.min(sourceTaxInBase, irpfOnForeign) : 0
  const irpfNetAfterCredit = Math.max(0, irpfGross - foreignTaxCredit)
  const totalTaxBurdenInBase =
    irpfNetAfterCredit + socialOnLocal + sourceTaxInBase - foreignTaxCredit

  const breakdown: TaxResult['breakdown'] = [
    {
      label: 'Зарплата РФ в базе IRPF',
      amount: foreignGross,
      description: SPAIN_DEDUCTIONS_WITH_FOREIGN_SALARY.summary,
      kind: 'gross',
    },
    {
      label: 'Mínimo personal y familiar',
      amount: allowances,
      description: 'Применяется к общей базе IRPF, включая зарплату из России в декларации.',
      formula:
        settings.dependents > 0
          ? `€5 550 + ${settings.dependents} × €2 400`
          : '€5 550',
      kind: 'deduction',
    },
    {
      label: 'Cuota obrera SS (только локальный доход)',
      amount: socialOnLocal,
      description: 'Соцвзносы работника не начисляются на зарплату российского работодателя.',
      kind: 'deduction',
    },
    {
      label: 'Налоговая база IRPF',
      amount: taxableBaseIrpf,
      kind: 'base',
    },
    {
      label: 'IRPF до зачёта',
      amount: irpfGross,
      kind: 'tax',
    },
    {
      label: 'IRPF на долю зарплаты РФ',
      amount: irpfOnForeign,
      description: 'Пропорциональная часть IRPF, приходящаяся на доход из России.',
      kind: 'info',
    },
  ]

  if (foreignTaxCredit > 0) {
    breakdown.push({
      label: 'Зачёт НДФЛ РФ (deducción doble imposición)',
      amount: foreignTaxCredit,
      description: SPAIN_DEDUCTIONS_WITH_FOREIGN_SALARY.foreignCredit,
      kind: 'deduction',
    })
  }

  breakdown.push(
    {
      label: 'IRPF к уплате в ES (после зачёта)',
      amount: irpfNetAfterCredit,
      kind: 'tax',
    },
    {
      label: 'Cuota obrera SS (год)',
      amount: socialOnLocal,
      kind: 'tax',
    },
  )

  const result: TaxResult = {
    grossIncome: totalGross,
    incomeTax: irpfNetAfterCredit,
    socialContributions: socialOnLocal,
    netIncome: totalGross - irpfNetAfterCredit - socialOnLocal,
    effectiveRate: totalGross > 0 ? totalTaxBurdenInBase / totalGross : 0,
    breakdown,
    bracketLines,
  }

  return {
    result,
    foreignSalary: {
      foreignSalaryGross: foreignGross,
      localIncomeGross: localGross,
      personalAllowance: allowances,
      socialOnLocalIncome: socialOnLocal,
      taxableBaseIrpf,
      irpfGross,
      irpfOnForeignSalary: irpfOnForeign,
      sourceTaxInBase,
      foreignTaxCredit,
      irpfNetAfterCredit,
      totalTaxBurdenInBase,
    },
  }
}

export function adjustResidenceTaxResult(
  residenceIncomes: RecurringItem[],
  settings: BudgetSettings,
  calculator: TaxCalculator,
  expenses: RecurringItem[] = [],
  oneTimeExpenses: OneTimeExpense[] = [],
): AdjustedResidenceTax {
  if (calculator.countryCode === 'TH') {
    return adjustThailandResidenceTaxResult(
      residenceIncomes,
      settings,
      calculator,
      expenses,
      oneTimeExpenses,
    )
  }

  if (calculator.countryCode === 'GE') {
    return adjustGeorgiaResidenceTaxResult(residenceIncomes, settings, calculator)
  }

  if (calculator.countryCode === 'ES' && calculator.id === 'es-employed') {
    const mixed = calculateSpainEmployedWithForeignSalary(residenceIncomes, settings)
    if (mixed) return mixed
  }

  const grossAnnualIncome = sumAnnualGrossIncomes(residenceIncomes, settings.baseCurrency)
  return {
    result: calculator.calculate({
      grossAnnualIncome,
      familySize: settings.familySize,
      dependents: settings.dependents,
    }),
  }
}

export function computeAnnualTaxBurden(
  incomes: RecurringItem[],
  settings: BudgetSettings,
  calculator: TaxCalculator | undefined,
  expenses: RecurringItem[] = [],
  oneTimeExpenses: OneTimeExpense[] = [],
): {
  residenceIncomeTax: number
  residenceSocial: number
  sourceIncomeTaxInBase: number
  foreignTaxCredit: number
} {
  if (!calculator) {
    return {
      residenceIncomeTax: 0,
      residenceSocial: 0,
      sourceIncomeTaxInBase: 0,
      foreignTaxCredit: 0,
    }
  }

  const residenceIncomes = filterResidenceTaxableIncomes(incomes)
  const adjusted = adjustResidenceTaxResult(
    residenceIncomes,
    settings,
    calculator,
    expenses,
    oneTimeExpenses,
  )

  const sourceOnlyItems = incomes.filter(
    (item) => isSalaryFrom(item, 'RU') && !isIncludedInResidenceTax(item),
  )
  const sourceOnlySummary = summarizeSourceSalaries(sourceOnlyItems, settings.dependents, 'RUB')
  const sourceTaxFromSourceOnly = sourceOnlySummary
    ? convertCurrency(sourceOnlySummary.ndfl, 'RUB', settings.baseCurrency)
    : 0
  const sourceTaxFromCredit = adjusted.foreignSalary?.sourceTaxInBase ?? 0

  return {
    residenceIncomeTax: adjusted.result.incomeTax,
    residenceSocial: adjusted.result.socialContributions,
    sourceIncomeTaxInBase: sourceTaxFromSourceOnly + sourceTaxFromCredit,
    foreignTaxCredit: adjusted.foreignSalary?.foreignTaxCredit ?? 0,
  }
}
