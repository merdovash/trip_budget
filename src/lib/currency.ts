import { convertViaCbr } from './cbrRates'
import { useExchangeRateStore } from '../store/exchangeRateStore'

// Fallback when CBR has no rate for a currency (MYR, MXN, etc.)
const FALLBACK_RATES_TO_EUR: Record<string, number> = {
  EUR: 1,
  USD: 0.92,
  RUB: 0.01,
  BYN: 0.28,
  AMD: 0.0024,
  GBP: 1.17,
  THB: 0.026,
  MYR: 0.2,
  AED: 0.25,
  GEL: 0.34,
  MXN: 0.048,
  IDR: 0.000058,
  VND: 0.000037,
}

/** expense — дороже курса ЦБ; income — дешевле; neutral — без комиссии. */
export type CurrencyConversionSide = 'expense' | 'income' | 'neutral'

export interface ConvertCurrencyOptions {
  /** Комиссия к курсу ЦБ, %. */
  feePercent?: number
  side?: CurrencyConversionSide
}

function convertViaFallback(amount: number, from: string, to: string): number {
  const fromRate = FALLBACK_RATES_TO_EUR[from] ?? 1
  const toRate = FALLBACK_RATES_TO_EUR[to] ?? 1
  return (amount * fromRate) / toRate
}

function applyConversionFee(
  midAmount: number,
  feePercent: number,
  side: CurrencyConversionSide,
): number {
  if (!feePercent || side === 'neutral') return midAmount
  if (side === 'expense') return midAmount * (1 + feePercent / 100)
  return midAmount * (1 - feePercent / 100)
}

export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  options?: ConvertCurrencyOptions,
): number {
  if (from === to) return amount

  const { pivotPerUnit, status } = useExchangeRateStore.getState()
  let mid: number
  if (status === 'loaded' && Object.keys(pivotPerUnit).length > 0) {
    const viaCbr = convertViaCbr(amount, from, to, pivotPerUnit)
    mid = viaCbr !== null ? viaCbr : convertViaFallback(amount, from, to)
  } else {
    mid = convertViaFallback(amount, from, to)
  }

  return applyConversionFee(mid, options?.feePercent ?? 0, options?.side ?? 'neutral')
}

export function isCbrRateUsed(from: string, to: string): boolean {
  if (from === to) return false
  const { pivotPerUnit, status } = useExchangeRateStore.getState()
  if (status !== 'loaded') return false

  const pivotFrom = from === 'RUB' ? 1 : pivotPerUnit[from]
  const pivotTo = to === 'RUB' ? 1 : pivotPerUnit[to]
  return Boolean(pivotFrom && pivotTo)
}

export function getRateLabel(from: string, to: string, feePercent = 0): string {
  const rate = convertCurrency(1, from, to, {
    feePercent,
    side: feePercent > 0 ? 'expense' : 'neutral',
  })
  return `1 ${from} ≈ ${rate.toFixed(4)} ${to}`
}

export function getConversionFeePercent(settings: {
  currencyConversionFeePercent?: number
}): number {
  const fee = settings.currencyConversionFeePercent ?? 0
  return Number.isFinite(fee) && fee > 0 ? fee : 0
}
