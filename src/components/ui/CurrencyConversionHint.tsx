import { convertCurrency, isCbrRateUsed } from '../../lib/currency'
import { formatCurrency } from '../../lib/format'
import { useExchangeRateStore } from '../../store/exchangeRateStore'

interface CurrencyConversionHintProps {
  amount: number
  currency: string
  baseCurrency: string
}

export function CurrencyConversionHint({
  amount,
  currency,
  baseCurrency,
}: CurrencyConversionHintProps) {
  const rateStatus = useExchangeRateStore((s) => s.status)

  if (!amount || currency === baseCurrency) return null

  const converted = convertCurrency(amount, currency, baseCurrency)
  const usesCbr = isCbrRateUsed(currency, baseCurrency)

  return (
    <p className="mt-1 text-sm text-slate-600">
      ≈ <span className="font-medium">{formatCurrency(converted, baseCurrency)}</span>
      <span className="text-slate-500"> в базовой валюте ({baseCurrency})</span>
      {usesCbr && rateStatus === 'loaded' && (
        <span className="text-slate-400"> · курс ЦБ РФ</span>
      )}
      {rateStatus === 'loading' && (
        <span className="text-slate-400"> · загрузка курса ЦБ…</span>
      )}
    </p>
  )
}
