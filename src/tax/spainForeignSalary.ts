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
  isRussiaSalary,
  sumAnnualGrossIncomes,
  summarizeRussiaSalaries,
} from './incomeSourceTax'
import type { TaxCalculator, TaxResult } from './types'
import { breakdownProgressiveTax, calculateProgressiveTax } from './types'
import { adjustThailandResidenceTaxResult } from './thailandResidenceTax'
import { adjustGeorgiaResidenceTaxResult } from './georgiaResidenceTax'

export function isRussiaSalaryInSpanishBase(item: RecurringItem): boolean {
  return isRussiaSalary(item) && isIncludedInResidenceTax(item)
}

/** Зачёт НДФЛ РФ против IRPF Испании (deducción por doble imposición internacional, упрощ.). */
export function usesForeignTaxCredit(item: RecurringItem): boolean {
  return isRussiaSalaryInSpanishBase(item) && item.foreignTaxCredit !== false
}

export const SPAIN_DEDUCTIONS_WITH_RU_SALARY = {
  title: 'Вычеты Испании при зарплате из России',
  summary:
    'Да — если зарплата РФ включена в декларацию IRPF («Учитывать в налогах проживания»). Mínimo personal y familiar уменьшает общую базу IRPF. Cuota SS работника начисляется только на доход в Испании, не на зарплату российского работодателя.',
  foreignCredit:
    'Опция «Зачёт НДФЛ в РФ»: уплаченный НДФЛ зачитывается против IRPF на эту зарплату (Art. 80 Ley 35/2006, упрощ.).',
} as const

export interface SpainForeignSalaryBreakdown {
  foreignSalaryGross: number
  localIncomeGross: number
  personalAllowance: number
  socialOnLocalIncome: number
  taxableBaseIrpf: number
  irpfGross: number
  irpfOnForeignSalary: number
  russianNdflInBase: number
  foreignTaxCredit: number
  irpfNetAfterCredit: number
  totalTaxBurdenInBase: number
}

export interface AdjustedResidenceTax {
  result: TaxResult
  spainForeignSalary?: SpainForeignSalaryBreakdown
  thailandForeignSalary?: import('./thailandResidenceTax').ThailandForeignSalaryBreakdown
  georgiaForeignSalary?: import('./georgiaResidenceTax').GeorgiaForeignSalaryBreakdown
}

function personalAllowanceAmount(dependents: number): number {
  return SPAIN_PERSONAL_ALLOWANCE + dependents * SPAIN_DEPENDENT_ALLOWANCE
}

/** IRPF + SS для смешанного дохода (ES local + RU salary в декларации). */
export function calculateSpainEmployedWithForeignSalary(
  residenceIncomes: RecurringItem[],
  settings: BudgetSettings,
): AdjustedResidenceTax | null {
  const foreignItems = residenceIncomes.filter(isRussiaSalaryInSpanishBase)
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
  const russianSummary =
    creditItems.length > 0 ? summarizeRussiaSalaries(creditItems, settings.dependents) : null
  const russianNdflInBase = russianSummary
    ? convertCurrency(russianSummary.ndfl, 'RUB', baseCurrency)
    : 0
  const foreignTaxCredit =
    creditItems.length > 0 ? Math.min(russianNdflInBase, irpfOnForeign) : 0
  const irpfNetAfterCredit = Math.max(0, irpfGross - foreignTaxCredit)
  const totalTaxBurdenInBase =
    irpfNetAfterCredit + socialOnLocal + russianNdflInBase - foreignTaxCredit

  const breakdown: TaxResult['breakdown'] = [
    {
      label: 'Зарплата РФ в базе IRPF',
      amount: foreignGross,
      description: SPAIN_DEDUCTIONS_WITH_RU_SALARY.summary,
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
      description: SPAIN_DEDUCTIONS_WITH_RU_SALARY.foreignCredit,
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
    spainForeignSalary: {
      foreignSalaryGross: foreignGross,
      localIncomeGross: localGross,
      personalAllowance: allowances,
      socialOnLocalIncome: socialOnLocal,
      taxableBaseIrpf,
      irpfGross,
      irpfOnForeignSalary: irpfOnForeign,
      russianNdflInBase,
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
  russiaNdflInBase: number
  foreignTaxCredit: number
} {
  if (!calculator) {
    return { residenceIncomeTax: 0, residenceSocial: 0, russiaNdflInBase: 0, foreignTaxCredit: 0 }
  }

  const residenceIncomes = filterResidenceTaxableIncomes(incomes)
  const adjusted = adjustResidenceTaxResult(
    residenceIncomes,
    settings,
    calculator,
    expenses,
    oneTimeExpenses,
  )

  const sourceRuItems = incomes.filter(
    (item) => isRussiaSalary(item) && !isIncludedInResidenceTax(item),
  )
  const russiaSourceOnly = summarizeRussiaSalaries(sourceRuItems, settings.dependents)
  const russiaFromSource = russiaSourceOnly
    ? convertCurrency(russiaSourceOnly.ndfl, 'RUB', settings.baseCurrency)
    : 0
  const russiaFromCredit =
    adjusted.spainForeignSalary?.russianNdflInBase ??
    adjusted.thailandForeignSalary?.russianNdflInBase ??
    adjusted.georgiaForeignSalary?.russianNdflInBase ??
    0

  return {
    residenceIncomeTax: adjusted.result.incomeTax,
    residenceSocial: adjusted.result.socialContributions,
    russiaNdflInBase: russiaFromSource + russiaFromCredit,
    foreignTaxCredit:
      adjusted.spainForeignSalary?.foreignTaxCredit ??
      adjusted.thailandForeignSalary?.foreignTaxCredit ??
      adjusted.georgiaForeignSalary?.foreignTaxCredit ??
      0,
  }
}
