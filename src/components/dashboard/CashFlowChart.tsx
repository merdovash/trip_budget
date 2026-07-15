import { useMemo } from 'react'
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrency, formatDateDisplay, formatMonth, formatShortDate } from '../../lib/format'
import type { DailySnapshot, MonthlySnapshot } from '../../types/budget'
import { Card } from '../ui/FormControls'

/** Свыше этого числа точек график переходит на помесячный вид. */
export const CHART_DAILY_POINT_LIMIT = 400
/** Бары рисуем только при умеренном числе точек — иначе DOM тормозит. */
const CHART_BARS_POINT_LIMIT = 120
/** Максимум точек в дневном режиме (сэмплирование). */
const CHART_MAX_SAMPLED_POINTS = 240

interface CashFlowChartProps {
  dailySnapshots: DailySnapshot[]
  monthlySnapshots: MonthlySnapshot[]
  currency: string
  onDayClick?: (date: string) => void
}

function sampleDailySnapshots(snapshots: DailySnapshot[]): DailySnapshot[] {
  if (snapshots.length <= CHART_MAX_SAMPLED_POINTS) return snapshots
  const step = Math.ceil(snapshots.length / CHART_MAX_SAMPLED_POINTS)
  const sampled: DailySnapshot[] = []
  for (let i = 0; i < snapshots.length; i += step) {
    sampled.push(snapshots[i])
  }
  const last = snapshots[snapshots.length - 1]
  if (sampled[sampled.length - 1]?.date !== last.date) {
    sampled.push(last)
  }
  return sampled
}

export function CashFlowChart({
  dailySnapshots,
  monthlySnapshots,
  currency,
  onDayClick,
}: CashFlowChartProps) {
  const useMonthly = dailySnapshots.length > CHART_DAILY_POINT_LIMIT

  const chartRows = useMemo(() => {
    if (useMonthly) {
      return monthlySnapshots.map((s) => ({
        date: `${s.month}-01`,
        label: formatMonth(s.month),
        netIncome: Math.round(s.netIncome),
        expenses: Math.round(s.recurringExpenses + s.oneTimeExpenses),
        cumulative: Math.round(s.cumulativeBalance),
      }))
    }
    return sampleDailySnapshots(dailySnapshots).map((s) => ({
      date: s.date,
      label: formatShortDate(s.date),
      netIncome: Math.round(s.netIncome),
      expenses: Math.round(s.recurringExpenses + s.oneTimeExpenses),
      cumulative: Math.round(s.cumulativeBalance),
    }))
  }, [useMonthly, dailySnapshots, monthlySnapshots])

  const showBars = chartRows.length <= CHART_BARS_POINT_LIMIT
  const tickInterval = Math.max(1, Math.floor(chartRows.length / 12))

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold">
        {useMonthly ? 'Cash flow по месяцам' : 'Cash flow по дням'}
      </h2>
      <p className="mb-4 text-sm text-slate-500">
        {useMonthly
          ? 'Горизонт большой — график агрегирован по месяцам для скорости. Клик открывает первый день месяца.'
          : 'Накопленный баланс по дням — помогает увидеть кассовый разрыв между поступлениями и расходами. «Еда» начисляется ежедневно (сумма ÷ 30). Клик по точке открывает статьи дня.'}
      </p>
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartRows}
            onClick={(state) => {
              if (!onDayClick) return
              const date = state?.activePayload?.[0]?.payload?.date as string | undefined
              if (date) onDayClick(date)
            }}
            style={onDayClick ? { cursor: 'pointer' } : undefined}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11 }}
              interval={tickInterval}
              angle={-45}
              textAnchor="end"
              height={56}
            />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value: number) => formatCurrency(value, currency)}
              labelFormatter={(_, payload) => {
                const date = payload?.[0]?.payload?.date as string | undefined
                return date ? formatDateDisplay(date) : ''
              }}
              labelStyle={{ color: '#334155' }}
            />
            <Legend />
            <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="4 4" />
            {showBars && (
              <Bar
                dataKey="expenses"
                name="Расходы"
                fill="#f87171"
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
            )}
            {showBars && (
              <Bar
                dataKey="netIncome"
                name="Чистый доход"
                fill="#34d399"
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
            )}
            <Line
              type="monotone"
              dataKey="cumulative"
              name="Накопленный баланс"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
