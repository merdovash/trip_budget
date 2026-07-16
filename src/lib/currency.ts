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

function convertViaFallback(amount: number, from: string, to: string): number {
  const fromRate = FALLBACK_RATES_TO_EUR[from] ?? 1
  const toRate = FALLBACK_RATES_TO_EUR[to] ?? 1
  return (amount * fromRate) / toRate
}

export function convertCurrency(amount: number, from: string, to: string): number {
  if (from === to) return amount

  const { pivotPerUnit, status } = useExchangeRateStore.getState()
  if (status === 'loaded' && Object.keys(pivotPerUnit).length > 0) {
    const viaCbr = convertViaCbr(amount, from, to, pivotPerUnit)
    if (viaCbr !== null) return viaCbr
  }

  return convertViaFallback(amount, from, to)
}

export function isCbrRateUsed(from: string, to: string): boolean {
  if (from === to) return false
  const { pivotPerUnit, status } = useExchangeRateStore.getState()
  if (status !== 'loaded') return false

  const pivotFrom = from === 'RUB' ? 1 : pivotPerUnit[from]
  const pivotTo = to === 'RUB' ? 1 : pivotPerUnit[to]
  return Boolean(pivotFrom && pivotTo)
}

export function getRateLabel(from: string, to: string): string {
  const rate = convertCurrency(1, from, to)
  return `1 ${from} ≈ ${rate.toFixed(4)} ${to}`
}
