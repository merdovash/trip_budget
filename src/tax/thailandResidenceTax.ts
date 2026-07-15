import type { BudgetSettings, OneTimeExpense, RecurringItem } from '../types/budget'
import { convertCurrency } from '../lib/currency'
import { calculateAnnualResidenceScopeExpenses } from '../lib/expenseRemittance'
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
    'Иностранный доход облагается PIT только в объёме remittance — денег, ввезённых в Таиланд. Упрощение: remittance ≈ годовые расходы в стране проживания (укажите страну у каждого расхода). Доход до 01.01.2024 и доход в годы нерезидентства — вне PIT.',
  foreignCredit:
    'Опция «Зачёт НДФЛ в РФ»: уплаченный НДФЛ зачитывается против PIT на эту зарплату (договор об избежании двойного налогообложения, упрощ.).',
} as const

export interface ThailandForeignSalaryBreakdown {
  foreignSalaryGross: number
  foreignSalaryTaxableGross: number
  foreignSalaryExcluded: number
  remittanceEstimate: number
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

export const THAILAND_LTR_INVESTMENT = {
  title: 'LTR Wealthy Global Citizen (инвестиции / жильё)',
  summary:
    'Виза Long-Term Resident: категория Wealthy Global Citizen требует инвестицию ≥ USD 500 000 в тайские активы (жильё, гос. облигации, FDI по правилам BOI). Это условие резидентства, не налоговый вычет.',
  tax:
    'Royal Decree No. 743: qualifying foreign-source income, remitted to Thailand, освобождён от PIT для LTR Wealthy Global Citizen / Pensioner / Work-from-Thailand. Доход из Таиланда облагается обычным PIT. Highly-Skilled Professionals вместо этого могут иметь flat 17% на тайскую зарплату — в этом режиме не моделируется.',
} as const

export const THAILAND_PROPERTY_3M = {
  title: '฿3M — condo / долгосрочная аренда',
  summary:
    'Investment extension (Immigration Orders 237/2568 и 238/2568): freehold-кондоминиум или зарегистрированный long-term lease ≥ ฿3 000 000. Сначала разрешение на 90 дней, затем продление на 12 месяцев ежегодно. Покупка/аренда — условие визы, не налоговый вычет.',
  tax:
    'Отдельной налоговой льготы нет (в отличие от LTR / RD 743). При налоговом резидентстве (обычно ≥180 дней в календарном году) remitted foreign income облагается PIT по Por. 161/2566; зачёт НДФЛ РФ — как в стандартном режиме.',
} as const

export function isThailandLtrInvestmentRegime(calculator: TaxCalculator): boolean {
  return calculator.id === 'th-ltr-investment'
}

export function calculateThailandWithRussianIncome(
  residenceIncomes: RecurringItem[],
  settings: BudgetSettings,
  includeSocialSecurity: boolean,
  expenses: RecurringItem[] = [],
  oneTimeExpenses: OneTimeExpense[] = [],
): SpainAdjustedResidenceTax | null {
  const foreignItems = residenceIncomes.filter(isRussiaSalaryInThaiBase)
  if (foreignItems.length === 0) return null

  const baseCurrency = settings.baseCurrency
  const totalGross = sumAnnualGrossIncomes(residenceIncomes, baseCurrency)
  const foreignGross = sumAnnualGrossIncomes(foreignItems, baseCurrency)
  const localGross = Math.max(0, totalGross - foreignGross)

  const remittanceEstimate = calculateAnnualResidenceScopeExpenses(
    expenses,
    oneTimeExpenses,
    settings,
  )
  const foreignTaxableGross = Math.min(foreignGross, remittanceEstimate)
  const foreignExcluded = Math.max(0, foreignGross - foreignTaxableGross)
  const pitGrossIncome = localGross + foreignTaxableGross

  const localEmploymentItems = residenceIncomes.filter(isLocalThailandEmployment)
  const localEmploymentGross = sumAnnualGrossIncomes(localEmploymentItems, baseCurrency)

  const input = {
    grossAnnualIncome: pitGrossIncome,
    familySize: settings.familySize,
    dependents: settings.dependents,
  }

  const grossThb = convertCurrency(pitGrossIncome, baseCurrency, 'THB')
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
  const pitOnForeign =
    pitGrossIncome > 0 ? pitGross * (foreignTaxableGross / pitGrossIncome) : 0

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

  const result = buildThailandTaxResult(pitGrossIncome, baseCurrency, input, settings.thailandDeductions, {
    localEmploymentGrossBase: localEmploymentGross,
    includeSocialSecurity,
    foreignSalaryTaxableBase: foreignTaxableGross,
    foreignSalaryFullBase: foreignGross,
    foreignSalaryExcludedBase: foreignExcluded,
    remittanceFromExpensesBase: remittanceEstimate,
    foreignTaxCreditBase: foreignTaxCredit,
    pitNetBase: pitNetAfterCredit,
  })

  result.effectiveRate = pitGrossIncome > 0 ? totalTaxBurdenInBase / pitGrossIncome : 0

  return {
    result,
    thailandForeignSalary: {
      foreignSalaryGross: foreignGross,
      foreignSalaryTaxableGross: foreignTaxableGross,
      foreignSalaryExcluded: foreignExcluded,
      remittanceEstimate,
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

/** LTR: иностранный доход полностью освобождён от PIT; облагается только тайский доход. */
export function calculateThailandLtrInvestment(
  residenceIncomes: RecurringItem[],
  settings: BudgetSettings,
): SpainAdjustedResidenceTax {
  const baseCurrency = settings.baseCurrency
  const foreignItems = residenceIncomes.filter(isRussiaSalaryInThaiBase)
  const localItems = residenceIncomes.filter((item) => !isRussiaSalaryInThaiBase(item))
  const foreignGross = sumAnnualGrossIncomes(foreignItems, baseCurrency)
  const localGross = sumAnnualGrossIncomes(localItems, baseCurrency)
  const localEmploymentGross = sumAnnualGrossIncomes(
    residenceIncomes.filter(isLocalThailandEmployment),
    baseCurrency,
  )

  const russianSummary =
    foreignItems.length > 0 ? summarizeRussiaSalaries(foreignItems, settings.dependents) : null
  const russianNdflInBase = russianSummary
    ? convertCurrency(russianSummary.ndfl, 'RUB', baseCurrency)
    : 0

  const input = {
    grossAnnualIncome: localGross,
    familySize: settings.familySize,
    dependents: settings.dependents,
  }

  const result = buildThailandTaxResult(localGross, baseCurrency, input, settings.thailandDeductions, {
    localEmploymentGrossBase: localEmploymentGross,
    includeSocialSecurity: false,
    foreignSalaryTaxableBase: 0,
    foreignSalaryFullBase: foreignGross,
    foreignSalaryExcludedBase: foreignGross,
    foreignTaxCreditBase: 0,
  })

  result.breakdown = [
    {
      label: 'LTR / инвестиции (жильё)',
      amount: 0,
      description: THAILAND_LTR_INVESTMENT.summary,
      kind: 'info',
    },
    {
      label: 'Иностранный доход (освобождён, RD 743)',
      amount: foreignGross,
      description: THAILAND_LTR_INVESTMENT.tax,
      kind: 'info',
    },
    {
      label: 'Доход из Таиланда (в базе PIT)',
      amount: localGross,
      kind: 'gross',
    },
    ...result.breakdown,
  ]

  const pitNet = result.incomeTax
  const socialOnLocal = result.socialContributions
  const totalTaxBurdenInBase = pitNet + socialOnLocal + russianNdflInBase
  result.effectiveRate =
    localGross + foreignGross > 0 ? totalTaxBurdenInBase / (localGross + foreignGross) : 0

  return {
    result,
    thailandForeignSalary: {
      foreignSalaryGross: foreignGross,
      foreignSalaryTaxableGross: 0,
      foreignSalaryExcluded: foreignGross,
      remittanceEstimate: 0,
      localIncomeGross: localGross,
      taxableBaseThb: convertCurrency(localGross, baseCurrency, 'THB'),
      pitGross: pitNet,
      pitOnForeignSalary: 0,
      russianNdflInBase,
      foreignTaxCredit: 0,
      pitNetAfterCredit: pitNet,
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
  expenses: RecurringItem[] = [],
  oneTimeExpenses: OneTimeExpense[] = [],
): SpainAdjustedResidenceTax {
  if (isThailandLtrInvestmentRegime(calculator)) {
    return calculateThailandLtrInvestment(residenceIncomes, settings)
  }

  const includeSocialSecurity = calculator.id === 'th-employed'
  const mixed = calculateThailandWithRussianIncome(
    residenceIncomes,
    settings,
    includeSocialSecurity,
    expenses,
    oneTimeExpenses,
  )
  const adjusted =
    mixed ??
    ({
      result: calculateThailandResidenceTax(residenceIncomes, settings, calculator),
    } satisfies SpainAdjustedResidenceTax)

  if (calculator.id === 'th-property-3m') {
    adjusted.result = {
      ...adjusted.result,
      breakdown: [
        {
          label: '฿3M — condo / lease (виза)',
          amount: 0,
          description: THAILAND_PROPERTY_3M.summary,
          kind: 'info',
        },
        {
          label: 'Налоги: без льготы LTR',
          amount: 0,
          description: THAILAND_PROPERTY_3M.tax,
          kind: 'info',
        },
        ...adjusted.result.breakdown,
      ],
    }
  }

  return adjusted
}

/** Для тестов: PIT на базе в THB без конвертации. */
export function calculateThailandPitOnTaxableThb(taxableThb: number): number {
  return calculateProgressiveTax(taxableThb, TH_PIT_BRACKETS)
}
