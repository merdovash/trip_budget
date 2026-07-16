import { CURRENCIES, CURRENCY_LABELS } from '../../types/budget'
import { Select } from './FormControls'

interface CurrencySelectProps {
  value: string
  onChange: (currency: string) => void
  className?: string
}

export function CurrencySelect({ value, onChange, className }: CurrencySelectProps) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={className}
    >
      {CURRENCIES.map((c) => (
        <option key={c} value={c}>
          {CURRENCY_LABELS[c]} ({c})
        </option>
      ))}
    </Select>
  )
}
