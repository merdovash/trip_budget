import { formatCurrency } from '../../lib/format'
import type { RoutePointRegimeComparison } from '../../tax/regimeComparison'

interface RegimeComparisonPanelProps {
  comparisons: RoutePointRegimeComparison[]
  baseCurrency: string
}

export function RegimeComparisonPanel({
  comparisons,
  baseCurrency,
}: RegimeComparisonPanelProps) {
  if (comparisons.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Для сравнения нужно минимум два налоговых режима в стране точки маршрута.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Для каждой точки маршрута сравниваются доступные режимы на пересечении дат точки и
        горизонта планирования. Итого — сумма налогов (проживание
        {comparisons.some((c) => c.rows.some((r) => r.years.length > 0)) ? ' ± источник' : ''}
        ) в {baseCurrency}. Выгодный режим подсвечен.
      </p>

      {comparisons.map((comparison) => (
        <section
          key={comparison.pointId}
          className="rounded-xl border border-slate-200 bg-white px-4 py-4"
        >
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-800">
              Точка {comparison.pointIndex + 1}: {comparison.countryLabel}
            </h3>
            <p className="text-xs text-slate-500">{comparison.dateRangeLabel}</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-3 font-medium">Режим</th>
                  {comparison.years.map((year) => (
                    <th key={year} className="py-2 pr-3 font-medium tabular-nums">
                      {year}
                    </th>
                  ))}
                  <th className="py-2 font-medium tabular-nums">Итого</th>
                </tr>
              </thead>
              <tbody>
                {comparison.rows.map((row) => (
                  <tr
                    key={row.regimeId}
                    className={`border-b border-slate-100 ${
                      row.isBest ? 'bg-emerald-50/80' : ''
                    }`}
                  >
                    <td className="py-2 pr-3">
                      <span className="font-medium text-slate-800">{row.regimeName}</span>
                      <span className="ml-2 space-x-1">
                        {row.isSelected && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">
                            текущий
                          </span>
                        )}
                        {row.isBest && (
                          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] text-emerald-800">
                            выгоднее
                          </span>
                        )}
                      </span>
                    </td>
                    {row.years.map((yearTax) => (
                      <td key={yearTax.year} className="py-2 pr-3 tabular-nums text-slate-700">
                        {formatCurrency(yearTax.totalInBase, baseCurrency)}
                      </td>
                    ))}
                    <td
                      className={`py-2 font-semibold tabular-nums ${
                        row.isBest ? 'text-emerald-800' : 'text-slate-900'
                      }`}
                    >
                      {formatCurrency(row.totalInBase, baseCurrency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {comparison.savingsVsSelectedInBase > 0.5 ? (
            <p className="mt-3 text-sm text-emerald-800">
              Рекомендуется{' '}
              <span className="font-semibold">
                {comparison.rows.find((r) => r.isBest)?.regimeName}
              </span>
              : экономия около{' '}
              {formatCurrency(comparison.savingsVsSelectedInBase, baseCurrency)} относительно
              текущего режима.
            </p>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              Текущий режим уже среди наиболее выгодных для этой точки.
            </p>
          )}
        </section>
      ))}
    </div>
  )
}
