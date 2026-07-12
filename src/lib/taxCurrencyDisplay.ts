import { convertCurrency } from './currency'
import type { ScheduledTaxPayment, TaxResult } from '../tax/types'

export function convertAmountFromBase(
  amount: number,
  baseCurrency: string,
  localCurrency: string,
): number {
  if (baseCurrency === localCurrency) return amount
  return convertCurrency(amount, baseCurrency, localCurrency)
}

export function convertTaxResultFromBase(
  result: TaxResult,
  baseCurrency: string,
  localCurrency: string,
): TaxResult {
  if (baseCurrency === localCurrency) return result
  const c = (amount: number) => convertAmountFromBase(amount, baseCurrency, localCurrency)
  return {
    grossIncome: c(result.grossIncome),
    incomeTax: c(result.incomeTax),
    socialContributions: c(result.socialContributions),
    netIncome: c(result.netIncome),
    effectiveRate: result.effectiveRate,
    breakdown: result.breakdown.map((item) => ({ ...item, amount: c(item.amount) })),
    bracketLines: result.bracketLines?.map((line) => ({
      ...line,
      from: c(line.from),
      to: line.to !== null ? c(line.to) : null,
      taxableInBracket: c(line.taxableInBracket),
      tax: c(line.tax),
    })),
  }
}

export function convertScheduledPaymentsFromBase(
  payments: ScheduledTaxPayment[],
  baseCurrency: string,
  localCurrency: string,
): ScheduledTaxPayment[] {
  if (baseCurrency === localCurrency) return payments
  const c = (amount: number) => convertAmountFromBase(amount, baseCurrency, localCurrency)
  return payments.map((payment) => ({
    ...payment,
    social: c(payment.social),
    incomeTax: c(payment.incomeTax),
  }))
}
