import { formatCurrency, formatPercent } from '../../lib/format'
import { computeSummaryAverages } from '../../engine/budgetEngine'
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
  const { avgInflow, avgExpenses } = computeSummaryAverages(snapshots)
  const lastBalance = snapshots.at(-1)?.cumulativeBalance ?? 0
  const minDailyBalance =
    dailySnapshots.length > 0
      ? Math.min(...dailySnapshots.map((d) => d.cumulativeBalance))
      : initialBalance

  const cards = [
    { label: 'Начальный остаток', value: formatCurrency(initialBalance, currency) },
    {
      label: 'Средний приток / мес.',
      value: formatCurrency(avgInflow, currency),
      hint: 'Чистый доход + выдача кредитов за горизонт / число месяцев',
    },
    {
      label: 'Средние расходы / мес.',
      value: formatCurrency(avgExpenses, currency),
      hint: 'Регулярные (с учётом дат начала/конца), разовые и платежи по кредитам',
    },
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
          {'hint' in card && card.hint && (
            <p className="mt-1 text-xs leading-snug text-slate-400">{card.hint}</p>
          )}
        </Card>
      ))}
    </div>
  )
}

interface TaxBreakdownProps {
  title?: string
  regimeName: string
  effectiveRate: number
  breakdown: { label: string; amount: number; description?: string; formula?: string }[]
  currency: string
  footer?: string
  embedded?: boolean
}

export function TaxBreakdown({
  title = 'Налоговая детализация',
  regimeName,
  effectiveRate,
  breakdown,
  currency,
  footer,
  embedded,
}: TaxBreakdownProps) {
  const hasDetails = breakdown.some((item) => item.description || item.formula)

  const inner = (
    <>
      {!embedded && <h2 className="mb-3 text-lg font-semibold">{title}</h2>}
      <p className="text-sm text-slate-500">
        Режим: <span className="font-medium text-slate-700">{regimeName}</span> · Эффективная
        ставка: <span className="font-medium text-slate-700">{formatPercent(effectiveRate)}</span>
      </p>
      <ul className={`mt-4 space-y-2 ${hasDetails ? '' : ''}`}>
        {breakdown.map((item) => (
          <li
            key={item.label}
            className={hasDetails ? 'rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2' : ''}
          >
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">{item.label}</span>
              <span className="font-medium">{formatCurrency(item.amount, currency)}</span>
            </div>
            {item.description && (
              <p className="mt-1 text-xs text-slate-500">{item.description}</p>
            )}
            {item.formula && (
              <p className="mt-0.5 font-mono text-xs text-slate-600">{item.formula}</p>
            )}
          </li>
        ))}
      </ul>
      {footer && <p className="mt-3 text-xs text-slate-500">{footer}</p>}
    </>
  )

  return embedded ? inner : <Card>{inner}</Card>
}
