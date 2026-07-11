export interface TaxInput {
  grossAnnualIncome: number
  familySize: number
  dependents: number
}

export interface TaxBreakdownItem {
  label: string
  amount: number
}

export interface TaxResult {
  grossIncome: number
  incomeTax: number
  socialContributions: number
  netIncome: number
  effectiveRate: number
  breakdown: TaxBreakdownItem[]
}

export interface TaxCalculator {
  id: string
  countryCode: string
  name: string
  description: string
  calculate: (input: TaxInput) => TaxResult
}

export interface TaxBracket {
  upTo: number | null
  rate: number
}

export function calculateProgressiveTax(income: number, brackets: TaxBracket[]): number {
  let remaining = income
  let previousLimit = 0
  let tax = 0

  for (const bracket of brackets) {
    const limit = bracket.upTo ?? Infinity
    const taxable = Math.min(remaining, limit - previousLimit)
    if (taxable <= 0) break
    tax += taxable * bracket.rate
    remaining -= taxable
    previousLimit = limit
    if (remaining <= 0) break
  }

  return tax
}

export function buildTaxResult(
  grossIncome: number,
  incomeTax: number,
  socialContributions: number,
  breakdown: TaxBreakdownItem[],
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
  }
}
