import { formatCurrency, formatPercent } from '../../lib/format'
import type { DailySnapshot, MonthlySnapshot } from '../../types/budget'
import { Card } from '../ui/FormControls'

interface SummaryCardsProps {
  snapshots: MonthlySnapshot[]
  dailySnapshots: DailySnapshot[]
  currency: string
  annualTaxes: number
  initialBalance: number
}

export function SummaryCards({
  snapshots,
  dailySnapshots,
  currency,
  annualTaxes,
  initialBalance,
}: SummaryCardsProps) {
  const avgNet =
    snapshots.length > 0
      ? snapshots.reduce((s, m) => s + m.netIncome, 0) / snapshots.length
      : 0
  const avgExpenses =
    snapshots.length > 0
      ? snapshots.reduce((s, m) => s + m.recurringExpenses + m.oneTimeExpenses, 0) /
        snapshots.length
      : 0
  const lastBalance = snapshots.at(-1)?.cumulativeBalance ?? 0
  const minDailyBalance =
    dailySnapshots.length > 0
      ? Math.min(...dailySnapshots.map((d) => d.cumulativeBalance))
      : initialBalance

  const cards = [
    { label: 'Начальный остаток', value: formatCurrency(initialBalance, currency) },
    { label: 'Средний чистый доход / мес.', value: formatCurrency(avgNet, currency) },
    { label: 'Средние расходы / мес.', value: formatCurrency(avgExpenses, currency) },
    { label: 'Налоги / год', value: formatCurrency(annualTaxes, currency) },
    {
      label: 'Мин. баланс (по дням)',
      value: formatCurrency(minDailyBalance, currency),
      warn: minDailyBalance < 0,
    },
    { label: 'Баланс на конец периода', value: formatCurrency(lastBalance, currency) },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {cards.map((card) => (
        <Card key={card.label}>
          <p className="text-sm text-slate-500">{card.label}</p>
          <p
            className={`mt-2 text-2xl font-semibold ${'warn' in card && card.warn ? 'text-red-600' : 'text-slate-900'}`}
          >
            {card.value}
          </p>
        </Card>
      ))}
    </div>
  )
}

interface TaxBreakdownProps {
  regimeName: string
  effectiveRate: number
  breakdown: { label: string; amount: number }[]
  currency: string
}

export function TaxBreakdown({
  regimeName,
  effectiveRate,
  breakdown,
  currency,
}: TaxBreakdownProps) {
  return (
    <Card>
      <h2 className="mb-3 text-lg font-semibold">Налоговая детализация</h2>
      <p className="text-sm text-slate-500">
        Режим: <span className="font-medium text-slate-700">{regimeName}</span> · Эффективная
        ставка: <span className="font-medium text-slate-700">{formatPercent(effectiveRate)}</span>
      </p>
      <ul className="mt-4 space-y-2">
        {breakdown.map((item) => (
          <li key={item.label} className="flex justify-between text-sm">
            <span className="text-slate-600">{item.label}</span>
            <span className="font-medium">{formatCurrency(item.amount, currency)}</span>
          </li>
        ))}
      </ul>
    </Card>
  )
}
