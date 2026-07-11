export interface TaxInput {
  grossAnnualIncome: number
  familySize: number
  dependents: number
}

export interface TaxScheduleContext {
  year: number
  quarterlyGross: [number, number, number, number]
}

export interface ScheduledTaxPayment {
  month: number
  day: number
  year?: number
  social: number
  incomeTax: number
  label: string
  /** Пояснение основания платежа */
  description?: string
  /** Формула расчёта суммы */
  formula?: string
}

export interface TaxBreakdownItem {
  label: string
  amount: number
  /** Пояснение основания суммы */
  description?: string
  /** Формула расчёта */
  formula?: string
  kind?: 'gross' | 'deduction' | 'base' | 'tax' | 'bracket' | 'payment' | 'total' | 'info'
}

export interface BracketTaxLine {
  from: number
  to: number | null
  rate: number
  taxableInBracket: number
  tax: number
}

export interface TaxResult {
  grossIncome: number
  incomeTax: number
  socialContributions: number
  netIncome: number
  effectiveRate: number
  breakdown: TaxBreakdownItem[]
  bracketLines?: BracketTaxLine[]
}

export interface TaxCalculator {
  id: string
  countryCode: string
  name: string
  description: string
  /** with_income — удержание пропорционально поступлениям; scheduled — по календарю платежей */
  taxDistribution?: 'with_income' | 'scheduled'
  calculate: (input: TaxInput) => TaxResult
  buildTaxSchedule?: (
    input: TaxInput,
    result: TaxResult,
    context: TaxScheduleContext,
  ) => ScheduledTaxPayment[]
}

export interface TaxBracket {
  upTo: number | null
  rate: number
}

export function breakdownProgressiveTax(income: number, brackets: TaxBracket[]): BracketTaxLine[] {
  const lines: BracketTaxLine[] = []
  let remaining = income
  let previousLimit = 0

  for (const bracket of brackets) {
    const limit = bracket.upTo ?? Infinity
    const taxableInBracket = Math.min(remaining, limit - previousLimit)
    if (taxableInBracket <= 0) break
    lines.push({
      from: previousLimit,
      to: bracket.upTo,
      rate: bracket.rate,
      taxableInBracket,
      tax: taxableInBracket * bracket.rate,
    })
    remaining -= taxableInBracket
    previousLimit = limit
    if (remaining <= 0) break
  }

  return lines
}

export function calculateProgressiveTax(income: number, brackets: TaxBracket[]): number {
  return breakdownProgressiveTax(income, brackets).reduce((sum, line) => sum + line.tax, 0)
}

export function buildTaxResult(
  grossIncome: number,
  incomeTax: number,
  socialContributions: number,
  breakdown: TaxBreakdownItem[],
  bracketLines?: BracketTaxLine[],
): TaxResult {
  const totalDeductions = incomeTax + socialContributions
  const netIncome = grossIncome - totalDeductions
  const effectiveRate = grossIncome > 0 ? totalDeductions / grossIncome : 0

  return {
    grossIncome,
    incomeTax,
    socialContributions,
    netIncome,
    effectiveRate,
    breakdown,
    bracketLines,
  }
}
