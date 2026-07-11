import { formatCurrency, formatMonth } from '../../lib/format'
import type { MonthlySnapshot } from '../../types/budget'
import { Card, EmptyState } from '../ui/FormControls'

interface MonthlyTableProps {
  snapshots: MonthlySnapshot[]
  currency: string
  embedded?: boolean
}

export function MonthlyTable({ snapshots, currency, embedded }: MonthlyTableProps) {
  if (snapshots.length === 0) {
    return (
      <EmptyState
        title="Нет данных для прогноза"
        description="Добавьте доходы и расходы, чтобы увидеть помесячный прогноз."
      />
    )
  }

  const table = (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-slate-200 text-left text-slate-500">
          <th className="py-2 pr-4">Месяц</th>
          <th className="py-2 pr-4">Доход (gross)</th>
          <th className="py-2 pr-4">Налоги</th>
          <th className="py-2 pr-4">Чистый доход</th>
          <th className="py-2 pr-4">Расходы</th>
          <th className="py-2 pr-4">Баланс</th>
          <th className="py-2">Накоплено</th>
        </tr>
      </thead>
      <tbody>
        {snapshots.map((row) => (
          <tr key={row.month} className="border-b border-slate-100">
            <td className="py-2 pr-4 font-medium">{formatMonth(row.month)}</td>
            <td className="py-2 pr-4">{formatCurrency(row.grossIncome, currency)}</td>
            <td className="py-2 pr-4 text-red-600">{formatCurrency(row.taxes, currency)}</td>
            <td className="py-2 pr-4 text-emerald-700">
              {formatCurrency(row.netIncome, currency)}
            </td>
            <td className="py-2 pr-4">
              {formatCurrency(row.recurringExpenses + row.oneTimeExpenses, currency)}
            </td>
            <td
              className={`py-2 pr-4 font-medium ${row.balance >= 0 ? 'text-emerald-700' : 'text-red-600'}`}
            >
              {formatCurrency(row.balance, currency)}
            </td>
            <td
              className={`py-2 font-medium ${row.cumulativeBalance >= 0 ? 'text-blue-700' : 'text-red-600'}`}
            >
              {formatCurrency(row.cumulativeBalance, currency)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  if (embedded) {
    return <div className="overflow-x-auto">{table}</div>
  }

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold">Помесячный прогноз</h2>
      <div className="overflow-x-auto">{table}</div>
    </Card>
  )
}
