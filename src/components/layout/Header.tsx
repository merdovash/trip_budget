import { useState } from 'react'

export function Header() {
  return (
    <header className="relative z-50 shrink-0 border-b border-slate-200 bg-white px-4 py-3 md:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-slate-900">Семейный бюджет</h1>
          <p className="mt-1 text-sm text-slate-500">
            Планирование доходов, расходов и налогов при переезде
          </p>
        </div>
        <Disclaimer />
      </div>
    </header>
  )
}

export function Disclaimer() {
  const [expanded, setExpanded] = useState(false)

  return (
    <aside
      className="shrink-0 text-amber-900"
      aria-label="Ограничение ответственности"
    >
      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-700 transition-colors hover:bg-amber-100 sm:hidden"
          aria-expanded={false}
          aria-controls="disclaimer-text"
          title="Ограничение ответственности"
        >
          <WarningIcon className="h-5 w-5" />
          <span className="sr-only">Показать ограничение ответственности</span>
        </button>
      )}

      <div
        id="disclaimer-text"
        className={`max-w-xs rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-snug sm:max-w-sm ${
          expanded ? 'block' : 'hidden sm:block'
        }`}
      >
        <div className="flex items-start gap-2">
          <WarningIcon className="mt-0.5 hidden h-4 w-4 shrink-0 text-amber-600 sm:block" />
          <p className="min-w-0 flex-1">
            Расчёты ознакомительные, не налоговая и не юридическая консультация. Суммы зависят от
            статуса резидента, источников дохода и местного законодательства.
          </p>
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="-m-1 shrink-0 rounded p-1 text-amber-700 hover:bg-amber-100 sm:hidden"
            aria-expanded={true}
            aria-controls="disclaimer-text"
            title="Свернуть"
          >
            <CloseIcon className="h-4 w-4" />
            <span className="sr-only">Свернуть</span>
          </button>
        </div>
      </div>
    </aside>
  )
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
      />
    </svg>
  )
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}
