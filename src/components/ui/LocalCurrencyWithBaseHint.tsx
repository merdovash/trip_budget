import { convertAmountFromBase } from '../../lib/taxCurrencyDisplay'
import { formatCurrency } from '../../lib/format'
import { isCbrRateUsed } from '../../lib/currency'
import { useExchangeRateStore } from '../../store/exchangeRateStore'

interface LocalCurrencyWithBaseHintProps {
  /** Сумма в базовой валюте (как в движке). */
  amountInBase: number
  localCurrency: string
  baseCurrency: string
  className?: string
}

/** Основная сумма в местной валюте страны; при отличии от базовой — эквивалент рядом. */
export function LocalCurrencyWithBaseHint({
  amountInBase,
  localCurrency,
  baseCurrency,
  className = 'font-semibold text-slate-900',
}: LocalCurrencyWithBaseHintProps) {
  const rateStatus = useExchangeRateStore((s) => s.status)
  const amountLocal = convertAmountFromBase(amountInBase, baseCurrency, localCurrency)

  if (localCurrency === baseCurrency) {
    return <span className={className}>{formatCurrency(amountInBase, baseCurrency)}</span>
  }

  const usesCbr = isCbrRateUsed(localCurrency, baseCurrency) || isCbrRateUsed(baseCurrency, localCurrency)

  return (
    <span className="text-right">
      <span className={className}>{formatCurrency(amountLocal, localCurrency)}</span>
      <span className="mt-0.5 block text-xs font-normal text-slate-500">
        ≈ {formatCurrency(amountInBase, baseCurrency)}
        {usesCbr && rateStatus === 'loaded' && ' · курс ЦБ РФ'}
      </span>
    </span>
  )
}

export function residenceTaxDisplayNote(localCurrency: string, baseCurrency: string): string | null {
  if (localCurrency === baseCurrency) return null
  return `Суммы в ${localCurrency}; эквивалент в ${baseCurrency} — по курсу ЦБ РФ.`
}
