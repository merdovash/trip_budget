import type {
  BracketTaxLine,
  TaxBreakdownItem,
  TaxCalculator,
  TaxInput,
  TaxResult,
  TaxBracket,
} from '../types'
import { breakdownProgressiveTax, buildTaxResult, calculateProgressiveTax } from '../types'
import type { ThailandDeductionSettings } from '../../types/budget'
import { convertCurrency } from '../../lib/currency'
import { formatCurrency } from '../../lib/format'

/** Прогрессивная шкала PIT (налогооблагаемый доход, THB). */
export const TH_PIT_BRACKETS: TaxBracket[] = [
  { upTo: 150_000, rate: 0 },
  { upTo: 300_000, rate: 0.05 },
  { upTo: 500_000, rate: 0.1 },
  { upTo: 750_000, rate: 0.15 },
  { upTo: 1_000_000, rate: 0.2 },
  { upTo: 2_000_000, rate: 0.25 },
  { upTo: 5_000_000, rate: 0.3 },
  { upTo: null, rate: 0.35 },
]

export const TH_EMPLOYMENT_EXPENSE_RATE = 0.5
export const TH_EMPLOYMENT_EXPENSE_CAP = 100_000
export const TH_PERSONAL_ALLOWANCE = 60_000
export const TH_SPOUSE_ALLOWANCE = 60_000
export const TH_CHILD_ALLOWANCE = 30_000
export const TH_PARENT_ALLOWANCE = 30_000
export const TH_LIFE_HEALTH_COMBINED_CAP = 100_000
export const TH_HEALTH_INSURANCE_CAP = 25_000
export const TH_MORTGAGE_INTEREST_CAP = 100_000
export const TH_RETIREMENT_COMBINED_CAP = 500_000
export const TH_SOCIAL_SECURITY_EMPLOYEE_CAP = 10_500
export const TH_SSO_MONTHLY_SALARY_CAP = 17_500
export const TH_SSO_EMPLOYEE_RATE = 0.05

export interface ThailandAllowances {
  personal: number
  spouse: number
  children: number
  parents: number
  lifeInsurance: number
  healthInsurance: number
  mortgageInterest: number
  providentFund: number
  rmf: number
  socialSecurityPaid: number
  employmentExpense: number
  total: number
}

function formatLocal(amount: number): string {
  return formatCurrency(amount, 'THB')
}

export function formatThBracketRange(from: number, to: number | null): string {
  if (to === null) return `свыше ${formatLocal(from)}`
  return `${formatLocal(from)} – ${formatLocal(to)}`
}

function bracketBreakdownItems(lines: BracketTaxLine[]): TaxBreakdownItem[] {
  return lines.map((line) => ({
    label: `Ступень ${formatThBracketRange(line.from, line.to)}`,
    amount: line.tax,
    description: `Налогооблагаемый доход в ступени: ${formatLocal(line.taxableInBracket)}`,
    formula: `${formatLocal(line.taxableInBracket)} × ${(line.rate * 100).toFixed(0)}% = ${formatLocal(line.tax)}`,
    kind: 'bracket' as const,
  }))
}

export function computeThailandAllowances(
  input: TaxInput,
  gross: number,
  thaiSettings?: ThailandDeductionSettings,
): ThailandAllowances {
  const employmentExpense = Math.min(
    gross * TH_EMPLOYMENT_EXPENSE_RATE,
    TH_EMPLOYMENT_EXPENSE_CAP,
  )
  const personal = TH_PERSONAL_ALLOWANCE
  const spouse = input.familySize >= 2 ? TH_SPOUSE_ALLOWANCE : 0
  const children = input.dependents * TH_CHILD_ALLOWANCE
  const parents = (thaiSettings?.parentAllowances ?? 0) * TH_PARENT_ALLOWANCE

  const lifeRaw = thaiSettings?.lifeInsurance ?? 0
  const healthRaw = thaiSettings?.healthInsurance ?? 0
  const lifeHealthCombined = Math.min(lifeRaw + healthRaw, TH_LIFE_HEALTH_COMBINED_CAP)
  const healthInsurance = Math.min(healthRaw, TH_HEALTH_INSURANCE_CAP, lifeHealthCombined)
  const lifeInsurance = Math.min(lifeRaw, lifeHealthCombined - healthInsurance)

  const mortgageInterest = Math.min(thaiSettings?.mortgageInterest ?? 0, TH_MORTGAGE_INTEREST_CAP)
  const providentFund = Math.min(
    thaiSettings?.providentFund ?? 0,
    TH_RETIREMENT_COMBINED_CAP,
  )
  const rmf = Math.min(
    thaiSettings?.rmfContribution ?? 0,
    Math.max(0, TH_RETIREMENT_COMBINED_CAP - providentFund),
  )
  const socialSecurityPaid = Math.min(
    thaiSettings?.socialSecurityPaid ?? 0,
    TH_SOCIAL_SECURITY_EMPLOYEE_CAP,
  )

  const total =
    employmentExpense +
    personal +
    spouse +
    children +
    parents +
    lifeInsurance +
    healthInsurance +
    mortgageInterest +
    providentFund +
    rmf +
    socialSecurityPaid

  return {
    personal,
    spouse,
    children,
    parents,
    lifeInsurance,
    healthInsurance,
    mortgageInterest,
    providentFund,
    rmf,
    socialSecurityPaid,
    employmentExpense,
    total,
  }
}

export function calculateThailandSsoEmployee(localEmploymentGross: number): number {
  const annualCapBase = TH_SSO_MONTHLY_SALARY_CAP * 12
  const base = Math.min(localEmploymentGross, annualCapBase)
  return Math.min(base * TH_SSO_EMPLOYEE_RATE, TH_SOCIAL_SECURITY_EMPLOYEE_CAP)
}

export interface ThailandPitBreakdown {
  gross: number
  allowances: ThailandAllowances
  taxableBase: number
  pitGross: number
  bracketLines: BracketTaxLine[]
  socialContributions: number
}

export function calculateThailandPitBreakdown(
  gross: number,
  input: TaxInput,
  thaiSettings?: ThailandDeductionSettings,
  options?: { localEmploymentGross?: number; includeSocialSecurity?: boolean },
): ThailandPitBreakdown {
  const allowances = computeThailandAllowances(input, gross, thaiSettings)
  const taxableBase = Math.max(0, gross - allowances.total)
  const bracketLines = breakdownProgressiveTax(taxableBase, TH_PIT_BRACKETS)
  const pitGross = calculateProgressiveTax(taxableBase, TH_PIT_BRACKETS)

  let socialContributions = 0
  if (options?.includeSocialSecurity && (options.localEmploymentGross ?? 0) > 0) {
    socialContributions = calculateThailandSsoEmployee(options.localEmploymentGross!)
  }

  return {
    gross,
    allowances,
    taxableBase,
    pitGross,
    bracketLines,
    socialContributions,
  }
}

export function buildThailandBreakdownItems(
  breakdown: ThailandPitBreakdown,
  input: TaxInput,
  extras?: {
    foreignSalaryTaxable?: number
    foreignSalaryFull?: number
    foreignSalaryExcluded?: number
    remittanceFromExpenses?: number
    localIncomeGross?: number
    foreignTaxCredit?: number
    pitNet?: number
  },
): TaxBreakdownItem[] {
  const { allowances, gross, taxableBase, pitGross, bracketLines, socialContributions } =
    breakdown
  const pitNet = extras?.pitNet ?? pitGross

  const items: TaxBreakdownItem[] = [
    {
      label: 'Валовой доход (assessable income)',
      amount: gross,
      description:
        'Сумма доходов, включаемых в тайскую декларацию PIT (в THB). Иностранный доход — при remittance и резидентстве (Por. 161/2566).',
      kind: 'gross',
    },
  ]

  if (extras?.remittanceFromExpenses !== undefined && extras.remittanceFromExpenses >= 0) {
    items.push({
      label: 'Remittance (расходы в стране проживания)',
      amount: extras.remittanceFromExpenses,
      description:
        'Оценка ввезённых средств: сумма годовых расходов с меткой «страна проживания». Иностранный доход в PIT ограничен этой суммой.',
      kind: 'info',
    })
  }

  if (extras?.foreignSalaryFull && extras.foreignSalaryFull > 0) {
    items.push({
      label: 'Доход из России (полный)',
      amount: extras.foreignSalaryFull,
      description: 'Зарплата РФ с флагом «Учитывать в налогах проживания».',
      kind: 'info',
    })
  }

  if (extras?.foreignSalaryTaxable && extras.foreignSalaryTaxable > 0) {
    items.push({
      label: 'в т.ч. доход из России (в PIT, remitted)',
      amount: extras.foreignSalaryTaxable,
      description: 'Часть зарплаты РФ, включаемая в декларацию: min(доход, remittance).',
      kind: 'info',
    })
  }
  if (extras?.foreignSalaryExcluded && extras.foreignSalaryExcluded > 0) {
    items.push({
      label: 'Доход из России вне PIT (не remitted)',
      amount: extras.foreignSalaryExcluded,
      description: 'Превышение зарплаты над remittance — не облагается PIT в Таиланде.',
      kind: 'info',
    })
  }
  if (extras?.localIncomeGross !== undefined && extras.localIncomeGross > 0) {
    items.push({
      label: 'в т.ч. локальный доход в Таиланде',
      amount: extras.localIncomeGross,
      kind: 'info',
    })
  }

  items.push(
    {
      label: 'Вычет на трудовой доход (50%, макс. ฿100 000)',
      amount: allowances.employmentExpense,
      formula: `min(50% × ${formatLocal(gross)}, ${formatLocal(TH_EMPLOYMENT_EXPENSE_CAP)})`,
      kind: 'deduction',
    },
    {
      label: 'Личный вычет (personal allowance)',
      amount: allowances.personal,
      kind: 'deduction',
    },
  )

  if (allowances.spouse > 0) {
    items.push({
      label: 'Вычет на супруга (без дохода)',
      amount: allowances.spouse,
      kind: 'deduction',
    })
  }
  if (allowances.children > 0) {
    items.push({
      label: `Вычет на детей (${input.dependents} × ฿30 000)`,
      amount: allowances.children,
      kind: 'deduction',
    })
  }
  if (allowances.parents > 0) {
    items.push({
      label: 'Вычет на родителей',
      amount: allowances.parents,
      description: 'Родители 60+, проживают в Таиланде.',
      kind: 'deduction',
    })
  }
  if (allowances.lifeInsurance > 0) {
    items.push({
      label: 'Страхование жизни',
      amount: allowances.lifeInsurance,
      kind: 'deduction',
    })
  }
  if (allowances.healthInsurance > 0) {
    items.push({
      label: 'Медстрахование',
      amount: allowances.healthInsurance,
      kind: 'deduction',
    })
  }
  if (allowances.mortgageInterest > 0) {
    items.push({
      label: 'Проценты по ипотеке (первое жильё)',
      amount: allowances.mortgageInterest,
      kind: 'deduction',
    })
  }
  if (allowances.providentFund > 0) {
    items.push({
      label: 'Provident Fund (PVD)',
      amount: allowances.providentFund,
      kind: 'deduction',
    })
  }
  if (allowances.rmf > 0) {
    items.push({
      label: 'RMF / пенсионные фонды',
      amount: allowances.rmf,
      kind: 'deduction',
    })
  }
  if (allowances.socialSecurityPaid > 0) {
    items.push({
      label: 'Social Security (взносы работника)',
      amount: allowances.socialSecurityPaid,
      kind: 'deduction',
    })
  }

  items.push({
    label: 'Налогооблагаемый доход (net taxable income)',
    amount: taxableBase,
    description: 'База для прогрессивной шкалы PIT.',
    kind: 'base',
  })

  items.push(...bracketBreakdownItems(bracketLines))

  items.push({
    label: 'PIT до зачёта',
    amount: pitGross,
    kind: 'tax',
  })

  if (extras?.foreignTaxCredit && extras.foreignTaxCredit > 0) {
    items.push({
      label: 'Зачёт НДФЛ РФ (договор РФ–Таиланд, упрощ.)',
      amount: extras.foreignTaxCredit,
      description:
        'Кредит на уплаченный в России налог на доход из РФ, включённый в тайскую декларацию (Art. 23 DTT, упрощ.).',
      kind: 'deduction',
    })
  }

  items.push({
    label: 'PIT к уплате в Таиланде',
    amount: pitNet,
    kind: 'tax',
  })

  if (socialContributions > 0) {
    items.push({
      label: 'Social Security (SSO) — работник',
      amount: socialContributions,
      description: `5% от зарплаты в Таиланде, макс. ${formatLocal(TH_SOCIAL_SECURITY_EMPLOYEE_CAP)}/год.`,
      kind: 'tax',
    })
  }

  return items
}

function toBase(amount: number, baseCurrency: string): number {
  return convertCurrency(amount, 'THB', baseCurrency)
}

function fromBase(amount: number, baseCurrency: string): number {
  return convertCurrency(amount, baseCurrency, 'THB')
}

export function buildThailandTaxResult(
  grossBase: number,
  baseCurrency: string,
  input: TaxInput,
  thaiSettings?: ThailandDeductionSettings,
  options?: {
    localEmploymentGrossBase?: number
    includeSocialSecurity?: boolean
    foreignSalaryTaxableBase?: number
    foreignSalaryFullBase?: number
    foreignSalaryExcludedBase?: number
    remittanceFromExpensesBase?: number
    foreignTaxCreditBase?: number
    pitNetBase?: number
    /** @deprecated используйте foreignSalaryTaxableBase */
    foreignSalaryGrossBase?: number
  },
): TaxResult {
  const grossLocal = fromBase(grossBase, baseCurrency)
  const localEmploymentGrossLocal = options?.localEmploymentGrossBase
    ? fromBase(options.localEmploymentGrossBase, baseCurrency)
    : 0

  const breakdown = calculateThailandPitBreakdown(grossLocal, input, thaiSettings, {
    localEmploymentGross: localEmploymentGrossLocal,
    includeSocialSecurity: options?.includeSocialSecurity,
  })

  const pitNetLocal =
    options?.pitNetBase !== undefined
      ? fromBase(options.pitNetBase, baseCurrency)
      : breakdown.pitGross -
        (options?.foreignTaxCreditBase
          ? fromBase(options.foreignTaxCreditBase, baseCurrency)
          : 0)

  const foreignTaxableBase =
    options?.foreignSalaryTaxableBase ?? options?.foreignSalaryGrossBase
  const foreignFullBase = options?.foreignSalaryFullBase ?? foreignTaxableBase

  const breakdownItems = buildThailandBreakdownItems(breakdown, input, {
    remittanceFromExpenses:
      options?.remittanceFromExpensesBase !== undefined
        ? fromBase(options.remittanceFromExpensesBase, baseCurrency)
        : undefined,
    foreignSalaryFull: foreignFullBase
      ? fromBase(foreignFullBase, baseCurrency)
      : undefined,
    foreignSalaryTaxable: foreignTaxableBase
      ? fromBase(foreignTaxableBase, baseCurrency)
      : undefined,
    foreignSalaryExcluded: options?.foreignSalaryExcludedBase
      ? fromBase(options.foreignSalaryExcludedBase, baseCurrency)
      : undefined,
    localIncomeGross:
      localEmploymentGrossLocal > 0
        ? grossLocal -
          (foreignTaxableBase ? fromBase(foreignTaxableBase, baseCurrency) : 0)
        : undefined,
    foreignTaxCredit: options?.foreignTaxCreditBase
      ? fromBase(options.foreignTaxCreditBase, baseCurrency)
      : undefined,
    pitNet: pitNetLocal,
  })

  const incomeTax = toBase(pitNetLocal, baseCurrency)
  const socialContributions = toBase(breakdown.socialContributions, baseCurrency)

  return buildTaxResult(
    grossBase,
    incomeTax,
    socialContributions,
    breakdownItems.map((item) => ({
      ...item,
      amount: toBase(item.amount, baseCurrency),
    })),
    breakdown.bracketLines.map((line) => ({
      ...line,
      from: toBase(line.from, baseCurrency),
      to: line.to === null ? null : toBase(line.to, baseCurrency),
      taxableInBracket: toBase(line.taxableInBracket, baseCurrency),
      tax: toBase(line.tax, baseCurrency),
    })),
  )
}

function createThailandCalculator(
  id: string,
  name: string,
  description: string,
  includeSocialSecurity: boolean,
): TaxCalculator {
  return {
    id,
    countryCode: 'TH',
    name,
    description,
    taxDistribution: 'with_income',
    calculate(input: TaxInput) {
      return buildThailandTaxResult(input.grossAnnualIncome, 'THB', input, undefined, {
        includeSocialSecurity,
        localEmploymentGrossBase: includeSocialSecurity ? input.grossAnnualIncome : 0,
      })
    },
  }
}

export const thailandStandard: TaxCalculator = createThailandCalculator(
  'th-standard',
  'Стандартный PIT',
  'Прогрессивный подоходный налог Таиланда с вычетами: employment 50%/฿100k, personal/spouse/children, страховки, ипотека, PVD/RMF. Для релоканта из РФ — remittance rule Por. 161/2566.',
  false,
)

export const thailandEmployed: TaxCalculator = createThailandCalculator(
  'th-employed',
  'Наёмный работник (SSO)',
  'PIT + взносы Social Security (5%, макс. ฿10 500/год) на зарплату в Таиланде. Зарплата из РФ в SSO не входит.',
  true,
)

/**
 * LTR Wealthy Global Citizen (инвестиции, в т.ч. покупка жилья ≥ USD 500k).
 * Royal Decree No. 743: освобождение remitted foreign-source income от PIT.
 * Тайский доход облагается обычным прогрессивным PIT.
 */
export const thailandLtrInvestment: TaxCalculator = {
  id: 'th-ltr-investment',
  countryCode: 'TH',
  name: 'LTR — инвестиции / жильё',
  description:
    'Long-Term Resident (Wealthy Global Citizen): инвестиция ≥ USD 500 000 в тайские активы (жильё, гос. облигации, FDI). Иностранный доход, ввезённый в Таиланд, освобождён от PIT (Royal Decree No. 743). Доход из Таиланда — обычный прогрессивный PIT. Условие визы — не налоговый расчёт.',
  taxDistribution: 'with_income',
  calculate(input: TaxInput) {
    return buildThailandTaxResult(input.grossAnnualIncome, 'THB', input, undefined, {
      includeSocialSecurity: false,
      localEmploymentGrossBase: 0,
    })
  },
}

/**
 * Investment extension «฿3M route» (Orders 237/2568, 238/2568):
 * freehold condo or registered long-term lease ≥ THB 3,000,000 → 90-day permission, then annual 12-month renewals.
 * Tax: no LTR exemption — ordinary remittance-based PIT if tax resident (180+ days).
 */
export const thailandProperty3m: TaxCalculator = createThailandCalculator(
  'th-property-3m',
  '฿3M — condo / долгосрочная аренда',
  'Иммиграционный маршрут (Non-Immigrant B investment extension): freehold-кондо или зарегистрированный long-term lease ≥ ฿3 000 000. Сначала 90 дней, затем продление на 12 месяцев ежегодно. Налоги как у обычного резидента: remittance Por. 161/2566, без льготы LTR / RD 743. Покупка жилья — условие визы, не налоговый вычет.',
  false,
)
