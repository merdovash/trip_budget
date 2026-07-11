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
import { formatCurrency, formatDateDisplay, formatShortDate } from '../../lib/format'
import type { DailySnapshot } from '../../types/budget'
import { Card } from '../ui/FormControls'

interface CashFlowChartProps {
  snapshots: DailySnapshot[]
  currency: string
}

export function CashFlowChart({ snapshots, currency }: CashFlowChartProps) {
  const tickInterval = Math.max(1, Math.floor(snapshots.length / 12))

  const data = snapshots.map((s) => ({
    date: s.date,
    label: formatShortDate(s.date),
    netIncome: Math.round(s.netIncome),
    expenses: Math.round(s.recurringExpenses + s.oneTimeExpenses),
    balance: Math.round(s.balance),
    cumulative: Math.round(s.cumulativeBalance),
    isGap: s.cumulativeBalance < 0,
  }))

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold">Cash flow по дням</h2>
      <p className="mb-4 text-sm text-slate-500">
        Накопленный баланс по дням — помогает увидеть кассовый разрыв между поступлениями и
        расходами. «Еда» начисляется ежедневно (сумма ÷ 30).
      </p>
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data}>
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
            <Bar dataKey="expenses" name="Расходы" fill="#f87171" radius={[2, 2, 0, 0]} />
            <Bar dataKey="netIncome" name="Чистый доход" fill="#34d399" radius={[2, 2, 0, 0]} />
            <Line
              type="monotone"
              dataKey="cumulative"
              name="Накопленный баланс"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </Card>
  )
}
