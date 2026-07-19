import { useState } from 'react'

/** Compact disclaimer for the navigation menu footer. */
export function Disclaimer() {
  const [expanded, setExpanded] = useState(false)

  return (
    <aside className="text-amber-900" aria-label="Ограничение ответственности">
      {!expanded ? (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex w-full items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-left text-xs text-amber-800 transition-colors hover:bg-amber-100"
          aria-expanded={false}
        >
          <WarningIcon className="h-4 w-4 shrink-0" />
          <span>Ограничение ответственности</span>
        </button>
      ) : (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs leading-snug">
          <div className="flex items-start gap-2">
            <WarningIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="min-w-0 flex-1">
              Расчёты ознакомительные, не налоговая и не юридическая консультация. Суммы зависят от
              статуса резидента, источников дохода и местного законодательства.
            </p>
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="-m-1 shrink-0 rounded p-1 text-amber-700 hover:bg-amber-100"
              title="Свернуть"
            >
              <CloseIcon className="h-4 w-4" />
              <span className="sr-only">Свернуть</span>
            </button>
          </div>
        </div>
      )}
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
