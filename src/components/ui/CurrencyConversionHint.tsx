import { convertCurrency, isCbrRateUsed, getConversionFeePercent } from '../../lib/currency'
import { formatCurrency } from '../../lib/format'
import { useBudgetStore } from '../../store/budgetStore'
import { useExchangeRateStore } from '../../store/exchangeRateStore'

interface CurrencyConversionHintProps {
  amount: number
  currency: string
  baseCurrency: string
  /** expense — по умолчанию; income — для доходов; neutral — без комиссии (остатки). */
  side?: 'expense' | 'income' | 'neutral'
}

export function CurrencyConversionHint({
  amount,
  currency,
  baseCurrency,
  side = 'expense',
}: CurrencyConversionHintProps) {
  const rateStatus = useExchangeRateStore((s) => s.status)
  const feePercent = useBudgetStore((s) => getConversionFeePercent(s.settings))

  if (!amount || currency === baseCurrency) return null

  const converted = convertCurrency(amount, currency, baseCurrency, { feePercent, side })
  const usesCbr = isCbrRateUsed(currency, baseCurrency)

  return (
    <p className="mt-1 text-sm text-slate-600">
      ≈ <span className="font-medium">{formatCurrency(converted, baseCurrency)}</span>
      <span className="text-slate-500"> в базовой валюте ({baseCurrency})</span>
      {usesCbr && rateStatus === 'loaded' && (
        <span className="text-slate-400">
          {' '}
          · курс ЦБ РФ
          {feePercent > 0 ? ` + комиссия ${feePercent}%` : ''}
        </span>
      )}
      {!usesCbr && feePercent > 0 && (
        <span className="text-slate-400"> · с комиссией {feePercent}%</span>
      )}
      {rateStatus === 'loading' && (
        <span className="text-slate-400"> · загрузка курса ЦБ…</span>
      )}
    </p>
  )
}
