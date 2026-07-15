import { formatCurrency, formatPercent } from '../../lib/format'
import type { TaxBreakdownItem, TaxResult } from '../../tax/types'
import { THAILAND_FOREIGN_SALARY_RULES } from '../../tax/thailandResidenceTax'
import { Card } from '../ui/FormControls'

const SECTION_TITLES: Record<string, string> = {
  gross: 'Исходный доход',
  deduction: 'Вычеты из налоговой базы',
  base: 'Налоговая база',
  bracket: 'PIT по ступеням',
  tax: 'Налоги',
  info: 'Дополнительно',
  total: 'Итог',
}

const SECTION_ORDER = ['gross', 'info', 'deduction', 'base', 'bracket', 'tax'] as const

function groupByKind(items: TaxBreakdownItem[]): Map<string, TaxBreakdownItem[]> {
  const map = new Map<string, TaxBreakdownItem[]>()
  for (const item of items) {
    const kind = item.kind ?? 'info'
    const list = map.get(kind) ?? []
    list.push(item)
    map.set(kind, list)
  }
  return map
}

function BreakdownRow({ item, currency }: { item: TaxBreakdownItem; currency: string }) {
  return (
    <li className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
      <div className="flex justify-between gap-4 text-sm">
        <span className="font-medium text-slate-700">{item.label}</span>
        <span className="shrink-0 font-semibold text-slate-900">
          {formatCurrency(item.amount, currency)}
        </span>
      </div>
      {item.description && (
        <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{item.description}</p>
      )}
      {item.formula && (
        <p className="mt-1 font-mono text-xs text-slate-600">{item.formula}</p>
      )}
    </li>
  )
}

interface ThailandTaxDetailPanelProps {
  regimeName: string
  regimeDescription?: string
  taxRegimeId?: string
  result: TaxResult
  currency: string
  embedded?: boolean
  footer?: string
}

export function ThailandTaxDetailPanel({
  regimeName,
  regimeDescription,
  taxRegimeId,
  result,
  currency,
  embedded,
  footer,
}: ThailandTaxDetailPanelProps) {
  const isEmployed = taxRegimeId === 'th-employed'
  const panelTitle = isEmployed
    ? 'Налоги Таиланда — наёмный работник (PIT + SSO)'
    : 'Налоги Таиланда — подробная расшифровка PIT'
  const grouped = groupByKind(result.breakdown)

  const inner = (
    <>
      {!embedded && <h2 className="mb-2 text-lg font-semibold">{panelTitle}</h2>}
      <p className="text-sm text-slate-500">
        Режим: <span className="font-medium text-slate-700">{regimeName}</span>
        {' · '}
        Эффективная ставка:{' '}
        <span className="font-medium text-slate-700">{formatPercent(result.effectiveRate)}</span>
      </p>
      {regimeDescription && (
        <p className="mt-1 text-xs leading-relaxed text-slate-500">{regimeDescription}</p>
      )}

      <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2.5 text-xs leading-relaxed text-amber-900">
        <p className="font-medium">{THAILAND_FOREIGN_SALARY_RULES.title}</p>
        <p className="mt-1">{THAILAND_FOREIGN_SALARY_RULES.summary}</p>
        <p className="mt-1">{THAILAND_FOREIGN_SALARY_RULES.remittance}</p>
      </div>

      <div className="mt-5 space-y-5">
        {SECTION_ORDER.map((kind) => {
          const items = grouped.get(kind)
          if (!items?.length) return null
          return (
            <section key={kind}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                {SECTION_TITLES[kind]}
              </h3>
              <ul className="space-y-2">
                {items.map((item) => (
                  <BreakdownRow key={item.label} item={item} currency={currency} />
                ))}
              </ul>
            </section>
          )
        })}
      </div>

      <p className="mt-5 text-xs text-slate-500">
        {footer ??
          `Шкала PIT и вычеты считаются в THB, в дашборде показаны в ${currency}. Суммы вычетов в настройках указываются в THB.`}
      </p>
    </>
  )

  return embedded ? inner : <Card>{inner}</Card>
}
