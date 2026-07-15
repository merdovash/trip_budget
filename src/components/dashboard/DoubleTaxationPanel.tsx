import { getDoubleTaxationRules, type DoubleTaxationLine } from '../../tax/doubleTaxation'
import { Card } from '../ui/FormControls'

interface DoubleTaxationPanelProps {
  lines: DoubleTaxationLine[]
  countryCode?: string
  embedded?: boolean
}

export function DoubleTaxationPanel({ lines, countryCode = 'ES', embedded }: DoubleTaxationPanelProps) {
  if (lines.length === 0) return null

  const rules = getDoubleTaxationRules(countryCode)

  const content = (
    <>
      {!embedded && <h2 className="text-lg font-semibold">Двойное налогообложение</h2>}
      <p className={`text-sm text-slate-500 ${embedded ? '' : 'mt-1'}`}>
        Каждый доход облагается в одной или двух юрисдикциях по выбранным правилам.
        {countryCode === 'TH'
          ? ' При зачёте НДФЛ применяется кредит по договору РФ–Таиланд (упрощ.).'
          : countryCode === 'GE'
            ? ' При зачёте НДФЛ применяется кредит по договору РФ–Грузия (упрощ.).'
            : ' При зачёте НДФЛ применяется deducción por doble imposición internacional (упрощ.).'}
      </p>

      <div className="mt-4 space-y-3">
        {rules.map((rule) => (
          <div key={rule.title} className="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
            <p className="text-sm font-medium text-slate-800">{rule.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">{rule.text}</p>
          </div>
        ))}
      </div>

      <div className="mt-5">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Ваши доходы
        </h3>
        <ul className="space-y-2">
          {lines.map((line) => (
            <li
              key={line.incomeId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm"
            >
              <span className="font-medium text-slate-800">{line.incomeName}</span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  line.treatment === 'source_withholding'
                    ? 'bg-slate-100 text-slate-700'
                    : line.treatment === 'residence' || line.treatment === 'residence_with_credit'
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-amber-50 text-amber-700'
                }`}
              >
                {line.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  )

  return embedded ? content : <Card>{content}</Card>
}
