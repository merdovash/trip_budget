export function Header() {
  return (
    <header className="relative z-50 shrink-0 border-b border-slate-200 bg-white px-6 py-4">
      <h1 className="text-xl font-semibold text-slate-900">Семейный бюджет</h1>
      <p className="mt-1 text-sm text-slate-500">
        Планирование доходов, расходов и налогов при переезде
      </p>
    </header>
  )
}

export function Disclaimer() {
  return (
    <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-6 py-3 text-sm text-amber-900">
      Расчёты носят ознакомительный характер и не являются налоговой или юридической консультацией.
      Реальные суммы зависят от статуса резидента, источников дохода и местного законодательства.
    </div>
  )
}
