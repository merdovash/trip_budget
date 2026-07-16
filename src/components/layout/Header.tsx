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
  return (
    <aside
      className="w-full max-w-xs shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-900 sm:w-auto sm:max-w-sm"
      aria-label="Ограничение ответственности"
    >
      Расчёты ознакомительные, не налоговая и не юридическая консультация. Суммы зависят от
      статуса резидента, источников дохода и местного законодательства.
    </aside>
  )
}
