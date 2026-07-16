import { useMemo, useState } from 'react'
import { formatCurrency, formatPercent } from '../../lib/format'
import {
  buildExpenseReport,
  type ExpenseReportDimension,
} from '../../lib/expenseReport'
import { useBudgetStore } from '../../store/budgetStore'
import { useExchangeRateStore } from '../../store/exchangeRateStore'
import { Card, EmptyState } from '../ui/FormControls'

const DIMENSIONS: { id: ExpenseReportDimension; label: string }[] = [
  { id: 'categories', label: 'Категории' },
  { id: 'folders', label: 'Папки' },
  { id: 'items', label: 'Статьи' },
]

export function ExpenseReportPanel() {
  const settings = useBudgetStore((s) => s.settings)
  const expenses = useBudgetStore((s) => s.expenses)
  const folders = useBudgetStore((s) => s.folders)
  const rateDate = useExchangeRateStore((s) => s.rateDate)
  const [dimension, setDimension] = useState<ExpenseReportDimension>('categories')

  const report = useMemo(
    () => buildExpenseReport(expenses, folders, settings, dimension),
    [expenses, folders, settings, dimension, rateDate],
  )

  if (expenses.length === 0) {
    return (
      <Card>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Сводный отчёт</h2>
        <EmptyState
          title="Нет расходов"
          description="Добавьте расходы, чтобы увидеть сводку по категориям, папкам и статьям."
        />
      </Card>
    )
  }

  const columnLabel =
    dimension === 'categories' ? 'Категория' : dimension === 'folders' ? 'Папка' : 'Статья'

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Сводный отчёт</h2>
            <p className="mt-1 text-sm text-slate-500">
              Суммы за горизонт {report.horizonMonths} мес. в {report.baseCurrency}. Исключённые
              папки не учитываются.
            </p>
          </div>
          <div className="flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {DIMENSIONS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDimension(tab.id)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  dimension === tab.id
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-sm text-slate-500">Итого расходов за горизонт</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">
            {formatCurrency(report.grandTotalInBase, report.baseCurrency)}
          </p>
        </div>

        {report.rows.length === 0 ? (
          <EmptyState
            title="Нечего показывать"
            description="Все расходы в исключённых папках или суммы равны нулю."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4 font-medium">{columnLabel}</th>
                  {dimension !== 'items' && (
                    <th className="py-2 pr-4 font-medium">Статей</th>
                  )}
                  <th className="py-2 pr-4 font-medium tabular-nums">Сумма</th>
                  <th className="py-2 font-medium tabular-nums">Доля</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.id} className="border-b border-slate-100">
                    <td className="py-2 pr-4 font-medium text-slate-800">{row.label}</td>
                    {dimension !== 'items' && (
                      <td className="py-2 pr-4 text-slate-500">{row.itemCount ?? '—'}</td>
                    )}
                    <td className="py-2 pr-4 tabular-nums text-slate-800">
                      {formatCurrency(row.totalInBase, report.baseCurrency)}
                    </td>
                    <td className="py-2 tabular-nums text-slate-500">
                      {formatPercent(row.share)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
