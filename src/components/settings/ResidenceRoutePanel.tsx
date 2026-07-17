import { useBudgetStore } from '../../store/budgetStore'
import { getTaxCalculator } from '../../tax/registry'
import { Card, Field, Select } from '../ui/FormControls'
import { ResidenceRouteEditor } from './ResidenceRouteEditor'
import {
  getRelocationMode,
  RELOCATION_MODE_LABELS,
  suggestTaxRegimeForMode,
} from '../../config/relocationMode'
import {
  ensureExplicitResidenceRoute,
  getResidenceRoute,
  syncLegacyFromRoute,
} from '../../config/residenceRoute'
import type { RelocationMode } from '../../types/budget'

export function ResidenceRoutePanel() {
  const settings = useBudgetStore((s) => s.settings)
  const setSettings = useBudgetStore((s) => s.setSettings)
  const relocationMode = getRelocationMode(settings)
  const route = getResidenceRoute(settings)
  const primaryRegime = getTaxCalculator(settings.taxRegimeId)

  function handleRelocationModeChange(mode: RelocationMode) {
    const routePoints = ensureExplicitResidenceRoute(settings)
    const first = [...routePoints].sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
    const suggestedRegime = suggestTaxRegimeForMode(first.countryCode, mode, first.taxRegimeId)
    const nextRoute = suggestedRegime
      ? routePoints.map((point) =>
          point.id === first.id ? { ...point, taxRegimeId: suggestedRegime } : point,
        )
      : routePoints
    setSettings({
      ...syncLegacyFromRoute(nextRoute),
      relocationMode: mode,
    })
  }

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Маршрут проживания</h2>
      <p className="mb-4 text-sm text-slate-500">
        Страны, налоговые режимы, даты и параметры режима (например, вычеты PIT в Таиланде).
      </p>

      <div className="min-w-0">
        <ResidenceRouteEditor settings={settings} onChange={setSettings} />
      </div>

      <div className="mt-4 grid min-w-0 gap-4 [&>*]:min-w-0 md:grid-cols-2">
        <Field label="Способ переезда">
          <Select
            value={relocationMode}
            onChange={(e) => handleRelocationModeChange(e.target.value as RelocationMode)}
          >
            {(Object.entries(RELOCATION_MODE_LABELS) as [RelocationMode, string][]).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ),
            )}
          </Select>
          <p className="mt-1 text-xs text-slate-500">
            {relocationMode === 'sole_proprietorship'
              ? 'Доход как ИП облагается в стране проживания. Подбирается режим для первой точки маршрута.'
              : 'Зарплата и страна выплаты указываются в разделе «Доходы»; налоги считаются у источника и по маршруту проживания.'}
          </p>
        </Field>
      </div>

      {primaryRegime && route.length === 1 && (
        <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-800">{primaryRegime.name}</p>
          <p className="mt-1">{primaryRegime.description}</p>
        </div>
      )}
    </Card>
  )
}
