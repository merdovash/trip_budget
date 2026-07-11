import { DOUBLE_TAXATION_RULES, type DoubleTaxationLine } from '../../tax/doubleTaxation'
import { Card } from '../ui/FormControls'

interface DoubleTaxationPanelProps {
  lines: DoubleTaxationLine[]
}

export function DoubleTaxationPanel({ lines }: DoubleTaxationPanelProps) {
  if (lines.length === 0) return null

  return (
    <Card>
      <h2 className="text-lg font-semibold">Двойное налогообложение</h2>
      <p className="mt-1 text-sm text-slate-500">
        Каждый доход облагается только в одной юрисдикции модели — либо у источника (РФ), либо в
        стране проживания. Это упрощённая схема без зачёта иностранного налога.
      </p>

      <div className="mt-4 space-y-3">
        {DOUBLE_TAXATION_RULES.map((rule) => (
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
                  line.treatment === 'source_russia'
                    ? 'bg-slate-100 text-slate-700'
                    : line.treatment === 'residence'
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
    </Card>
  )
}
