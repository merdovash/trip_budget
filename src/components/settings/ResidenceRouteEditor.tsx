import {
  COUNTRY_LABELS,
  getAvailableCountries,
  getCalculatorsByCountry,
  getTaxCalculator,
} from '../../tax/registry'
import type { BudgetSettings, ResidenceRoutePoint } from '../../types/budget'
import {
  createResidenceRoutePoint,
  ensureExplicitResidenceRoute,
  getResidenceRoute,
  syncLegacyFromRoute,
} from '../../config/residenceRoute'
import { getRegimeParamsSchema } from '../../config/regimeParams'
import type { ThailandDeductionSettings } from '../../types/budget'
import { Button, DateInput, Field, Select } from '../ui/FormControls'
import { RegimeParamsFields } from './RegimeParamsFields'

interface ResidenceRouteEditorProps {
  settings: BudgetSettings
  onChange: (patch: Partial<BudgetSettings>) => void
}

export function ResidenceRouteEditor({ settings, onChange }: ResidenceRouteEditorProps) {
  const countries = getAvailableCountries()
  const route = getResidenceRoute(settings)

  function commit(next: ResidenceRoutePoint[]) {
    onChange(syncLegacyFromRoute(next))
  }

  function workingRoute(): ResidenceRoutePoint[] {
    return ensureExplicitResidenceRoute(settings)
  }

  function updatePoint(id: string, patch: Partial<ResidenceRoutePoint>) {
    const next = workingRoute().map((point) => {
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
    const base = workingRoute()
    const last = [...base].sort((a, b) => a.endDate.localeCompare(b.endDate)).at(-1)
    const startDate = last
      ? last.endDate === '9999-12-31'
        ? last.startDate
        : last.endDate
      : settings.relocationDate ?? settings.initialBalanceDate
    const nextPoint = createResidenceRoutePoint({
      countryCode: last?.countryCode ?? settings.countryCode,
      taxRegimeId: last?.taxRegimeId ?? settings.taxRegimeId,
      startDate,
      endDate: startDate,
    })
    // Закрываем «открытый» конец предыдущей точки перед добавлением следующей
    const closed = base.map((point) =>
      point.id === last?.id && point.endDate === '9999-12-31'
        ? { ...point, endDate: startDate }
        : point,
    )
    commit([...closed, nextPoint])
  }

  function removePoint(id: string) {
    const next = workingRoute().filter((point) => point.id !== id)
    if (next.length === 0) return
    commit(next)
  }

  function updateRegimeParam(
    pointId: string,
    key: keyof ThailandDeductionSettings,
    value: number,
  ) {
    const next = workingRoute().map((point) => {
      if (point.id !== pointId) return point
      return {
        ...point,
        regimeParams: {
          ...point.regimeParams,
          [key]: value,
        },
      }
    })
    commit(next)
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-800">Маршрут проживания</h3>
          <p className="mt-1 text-xs text-slate-500">
            Страна, налоговый режим и даты каждого периода. Налоги считаются по активной точке на
            каждую дату.
          </p>
        </div>
        <Button type="button" onClick={addPoint}>
          Добавить точку
        </Button>
      </div>

      <div className="space-y-3">
        {route.map((point, index) => {
          const regimes = getCalculatorsByCountry(point.countryCode)
          const regime = getTaxCalculator(point.taxRegimeId)
          const paramSchema = getRegimeParamsSchema(point.countryCode, point.taxRegimeId)
          return (
            <div key={point.id} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
                    {regimes.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
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
                    value={point.endDate === '9999-12-31' ? '' : point.endDate}
                    onChange={(endDate) =>
                      updatePoint(point.id, {
                        endDate: endDate || '9999-12-31',
                      })
                    }
                  />
                  <p className="mt-1 text-[11px] text-slate-400">Пусто = без ограничения срока</p>
                </Field>
                <div className="flex items-end justify-end">
                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => removePoint(point.id)}
                    disabled={route.length <= 1}
                    aria-label="Удалить точку маршрута"
                    title="Удалить"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-5 w-5"
                      aria-hidden="true"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.75 1A1.75 1.75 0 0 0 7 2.75V3H4.25a.75.75 0 0 0 0 1.5h.34l.92 11.03A2.25 2.25 0 0 0 7.75 17.5h4.5a2.25 2.25 0 0 0 2.24-1.97L15.41 4.5h.34a.75.75 0 0 0 0-1.5H13v-.25A1.75 1.75 0 0 0 11.25 1h-2.5ZM9.5 3h1v-.25a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25V3h2Zm-1.8 3.25a.75.75 0 0 0-1.5.1l.5 8a.75.75 0 0 0 1.5-.1l-.5-8Zm5.1.1a.75.75 0 1 0-1.5-.1l-.5 8a.75.75 0 0 0 1.5.1l.5-8ZM10 6.5a.75.75 0 0 0-.75.75v8a.75.75 0 0 0 1.5 0v-8A.75.75 0 0 0 10 6.5Z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </button>
                </div>
              </div>
              {regime?.description && (
                <p className="text-xs text-slate-500">{regime.description}</p>
              )}
              {paramSchema && (
                <div className="border-t border-slate-100 pt-3">
                  <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {paramSchema.title}
                  </h4>
                  {paramSchema.description && (
                    <p className="mb-2 text-xs text-slate-500">{paramSchema.description}</p>
                  )}
                  <RegimeParamsFields
                    fields={paramSchema.fields}
                    values={point.regimeParams}
                    onChange={(key, value) => updateRegimeParam(point.id, key, value)}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
