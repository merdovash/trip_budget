import {
  COUNTRY_LABELS,
  getAvailableCountries,
  getCalculatorsByCountry,
} from '../../tax/registry'
import type { BudgetSettings, ResidenceRoutePoint } from '../../types/budget'
import {
  createResidenceRoutePoint,
  getResidenceRoute,
  hasExplicitResidenceRoute,
  syncLegacyFromRoute,
} from '../../config/residenceRoute'
import { Button, DateInput, Field, Select } from '../ui/FormControls'

interface ResidenceRouteEditorProps {
  settings: BudgetSettings
  onChange: (patch: Partial<BudgetSettings>) => void
}

export function ResidenceRouteEditor({ settings, onChange }: ResidenceRouteEditorProps) {
  const countries = getAvailableCountries()
  const explicit = hasExplicitResidenceRoute(settings)
  const route = getResidenceRoute(settings)

  function commit(next: ResidenceRoutePoint[]) {
    onChange(syncLegacyFromRoute(next))
  }

  function ensureExplicit(): ResidenceRoutePoint[] {
    if (explicit) return [...(settings.residenceRoute ?? [])]
    const start = settings.relocationDate ?? settings.initialBalanceDate
    const end = new Date(start)
    end.setMonth(end.getMonth() + Math.max(settings.horizonMonths, 1) - 1)
    const endDate = new Date(Date.UTC(end.getFullYear(), end.getMonth() + 1, 0))
      .toISOString()
      .slice(0, 10)
    return [
      createResidenceRoutePoint({
        countryCode: settings.countryCode,
        taxRegimeId: settings.taxRegimeId,
        startDate: start,
        endDate,
      }),
    ]
  }

  function updatePoint(id: string, patch: Partial<ResidenceRoutePoint>) {
    const next = ensureExplicit().map((point) => {
      if (point.id !== id) return point
      const countryCode = patch.countryCode ?? point.countryCode
      let taxRegimeId = patch.taxRegimeId ?? point.taxRegimeId
      if (patch.countryCode && patch.countryCode !== point.countryCode) {
        taxRegimeId = getCalculatorsByCountry(countryCode)[0]?.id ?? taxRegimeId
      }
      return { ...point, ...patch, countryCode, taxRegimeId }
    })
    commit(next)
  }

  function addPoint() {
    const base = ensureExplicit()
    const last = [...base].sort((a, b) => a.endDate.localeCompare(b.endDate)).at(-1)
    const startDate = last ? last.endDate : settings.relocationDate ?? settings.initialBalanceDate
    const nextPoint = createResidenceRoutePoint({
      countryCode: settings.countryCode,
      taxRegimeId: settings.taxRegimeId,
      startDate,
      endDate: startDate,
    })
    commit([...base, nextPoint])
  }

  function removePoint(id: string) {
    const next = ensureExplicit().filter((point) => point.id !== id)
    if (next.length === 0) {
      onChange({ residenceRoute: undefined })
      return
    }
    commit(next)
  }

  function clearRoute() {
    onChange({ residenceRoute: undefined })
  }

  return (
    <div className="md:col-span-2 space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Маршрут проживания</h3>
          <p className="mt-1 text-xs text-slate-500">
            Произвольное число стран с датами начала и окончания. Налоги и режим считаются по
            активной точке на каждую дату.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!explicit && (
            <Button type="button" variant="secondary" onClick={() => commit(ensureExplicit())}>
              Включить маршрут
            </Button>
          )}
          {explicit && (
            <Button type="button" variant="secondary" onClick={clearRoute}>
              Сбросить к одной стране
            </Button>
          )}
          <Button type="button" onClick={addPoint}>
            Добавить точку
          </Button>
        </div>
      </div>

      {!explicit && (
        <p className="text-sm text-slate-600">
          Сейчас используется одна страна: {COUNTRY_LABELS[settings.countryCode] ?? settings.countryCode}{' '}
          с {settings.relocationDate ?? settings.initialBalanceDate}. Нажмите «Включить маршрут» или
          «Добавить точку», чтобы задать несколько периодов.
        </p>
      )}

      {explicit && (
        <div className="space-y-3">
          {route.map((point, index) => {
            const regimes = getCalculatorsByCountry(point.countryCode)
            return (
              <div
                key={point.id}
                className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2 lg:grid-cols-5"
              >
                <Field label={`Точка ${index + 1}: страна`}>
                  <Select
                    value={point.countryCode}
                    onChange={(e) => updatePoint(point.id, { countryCode: e.target.value })}
                  >
                    {countries.map((code) => (
                      <option key={code} value={code}>
                        {COUNTRY_LABELS[code] ?? code}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Налоговый режим">
                  <Select
                    value={point.taxRegimeId}
                    onChange={(e) => updatePoint(point.id, { taxRegimeId: e.target.value })}
                  >
                    {regimes.map((regime) => (
                      <option key={regime.id} value={regime.id}>
                        {regime.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Дата начала">
                  <DateInput
                    value={point.startDate}
                    onChange={(startDate) => updatePoint(point.id, { startDate })}
                  />
                </Field>
                <Field label="Дата окончания">
                  <DateInput
                    value={point.endDate}
                    onChange={(endDate) => updatePoint(point.id, { endDate })}
                  />
                </Field>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="secondary"
                    className="w-full"
                    onClick={() => removePoint(point.id)}
                    disabled={route.length <= 1}
                  >
                    Удалить
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
