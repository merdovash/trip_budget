import { useMemo, useState, type FormEvent } from 'react'
import { useBudgetStore } from '../../store/budgetStore'
import {
  COUNTRY_LABELS,
  getAvailableCountries,
  getCalculatorsByCountry,
  getTaxCalculator,
} from '../../tax/registry'
import type { ResidenceRoutePoint, ThailandDeductionSettings } from '../../types/budget'
import {
  createResidenceRoutePoint,
  ensureExplicitResidenceRoute,
  getResidenceRoute,
  syncLegacyFromRoute,
} from '../../config/residenceRoute'
import { getRegimeParamsSchema } from '../../config/regimeParams'
import {
  getRelocationMode,
  RELOCATION_MODE_LABELS,
  suggestTaxRegimeForMode,
} from '../../config/relocationMode'
import type { RelocationMode } from '../../types/budget'
import { formatDateDisplay } from '../../lib/format'
import { Button, Card, DateInput, EmptyState, Field, Select } from '../ui/FormControls'
import { StackPanel } from '../ui/StackPanel'
import { SwipeRow } from '../ui/SwipeRow'
import { RegimeParamsFields } from './RegimeParamsFields'

const FORM_ID = 'route-point-form'

type PointFormState = {
  countryCode: string
  taxRegimeId: string
  startDate: string
  endDate: string
  regimeParams?: ThailandDeductionSettings
}

function pointToForm(point: ResidenceRoutePoint): PointFormState {
  return {
    countryCode: point.countryCode,
    taxRegimeId: point.taxRegimeId,
    startDate: point.startDate,
    endDate: point.endDate === '9999-12-31' ? '' : point.endDate,
    regimeParams: point.regimeParams,
  }
}

function formToPoint(form: PointFormState, id?: string): ResidenceRoutePoint {
  return createResidenceRoutePoint({
    id,
    countryCode: form.countryCode,
    taxRegimeId: form.taxRegimeId,
    startDate: form.startDate,
    endDate: form.endDate || '9999-12-31',
    regimeParams: form.regimeParams,
  })
}

function blankPointForm(settings: {
  countryCode: string
  taxRegimeId: string
  startDate: string
}): PointFormState {
  return {
    countryCode: settings.countryCode,
    taxRegimeId: settings.taxRegimeId,
    startDate: settings.startDate,
    endDate: settings.startDate,
  }
}

function RoutePointForm({
  formId,
  initial,
  onSubmit,
}: {
  formId: string
  initial: PointFormState
  onSubmit: (form: PointFormState) => void
}) {
  const [form, setForm] = useState(initial)
  const countries = getAvailableCountries()
  const regimes = getCalculatorsByCountry(form.countryCode)
  const regime = getTaxCalculator(form.taxRegimeId)
  const paramSchema = getRegimeParamsSchema(form.countryCode, form.taxRegimeId)

  function handleCountryChange(countryCode: string) {
    const nextRegimes = getCalculatorsByCountry(countryCode)
    setForm({
      ...form,
      countryCode,
      taxRegimeId: nextRegimes[0]?.id ?? form.taxRegimeId,
      regimeParams: undefined,
    })
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form.startDate) return
    onSubmit(form)
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="grid min-w-0 gap-3 [&>*]:min-w-0 md:grid-cols-2">
      <Field label="Страна">
        <Select value={form.countryCode} onChange={(e) => handleCountryChange(e.target.value)}>
          {countries.map((code) => (
            <option key={code} value={code}>
              {COUNTRY_LABELS[code] ?? code}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Налоговый режим">
        <Select
          value={form.taxRegimeId}
          onChange={(e) => setForm({ ...form, taxRegimeId: e.target.value, regimeParams: undefined })}
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
          value={form.startDate}
          onChange={(startDate) => setForm({ ...form, startDate })}
        />
      </Field>
      <Field label="Дата окончания">
        <DateInput
          value={form.endDate}
          onChange={(endDate) => setForm({ ...form, endDate })}
        />
        <p className="mt-1 text-[11px] text-slate-400">Пусто = без ограничения срока</p>
      </Field>
      {regime?.description && (
        <p className="break-words text-xs text-slate-500 md:col-span-2">{regime.description}</p>
      )}
      {paramSchema && (
        <div className="min-w-0 border-t border-slate-100 pt-3 md:col-span-2">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {paramSchema.title}
          </h4>
          {paramSchema.description && (
            <p className="mb-2 break-words text-xs text-slate-500">{paramSchema.description}</p>
          )}
          <RegimeParamsFields
            fields={paramSchema.fields}
            values={form.regimeParams}
            onChange={(key, value) =>
              setForm({
                ...form,
                regimeParams: { ...form.regimeParams, [key]: value },
              })
            }
          />
        </div>
      )}
    </form>
  )
}

export function ResidenceRoutePanel() {
  const settings = useBudgetStore((s) => s.settings)
  const setSettings = useBudgetStore((s) => s.setSettings)
  const relocationMode = getRelocationMode(settings)
  const route = getResidenceRoute(settings)
  const [panelMode, setPanelMode] = useState<'closed' | 'create' | 'edit'>('closed')
  const [editingId, setEditingId] = useState<string | null>(null)

  const editingPoint = useMemo(
    () => (panelMode === 'edit' && editingId ? route.find((p) => p.id === editingId) : undefined),
    [panelMode, editingId, route],
  )

  function commit(next: ResidenceRoutePoint[]) {
    setSettings(syncLegacyFromRoute(next))
  }

  function workingRoute(): ResidenceRoutePoint[] {
    return ensureExplicitResidenceRoute(settings)
  }

  function openCreate() {
    setEditingId(null)
    setPanelMode('create')
  }

  function openEdit(id: string) {
    setEditingId(id)
    setPanelMode('edit')
  }

  function closePanel() {
    setPanelMode('closed')
    setEditingId(null)
  }

  function removePoint(id: string) {
    const next = workingRoute().filter((point) => point.id !== id)
    if (next.length === 0) return
    commit(next)
    if (editingId === id) closePanel()
  }

  function handleSave(form: PointFormState) {
    const base = workingRoute()
    if (panelMode === 'edit' && editingId) {
      commit(base.map((point) => (point.id === editingId ? formToPoint(form, editingId) : point)))
    } else {
      const last = [...base].sort((a, b) => a.endDate.localeCompare(b.endDate)).at(-1)
      const nextPoint = formToPoint(form)
      const closed = base.map((point) =>
        point.id === last?.id && point.endDate === '9999-12-31'
          ? { ...point, endDate: form.startDate || point.endDate }
          : point,
      )
      commit([...closed, nextPoint])
    }
    closePanel()
  }

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

  const createDefaults = (() => {
    const base = workingRoute()
    const last = [...base].sort((a, b) => a.endDate.localeCompare(b.endDate)).at(-1)
    const startDate = last
      ? last.endDate === '9999-12-31'
        ? last.startDate
        : last.endDate
      : settings.relocationDate ?? settings.initialBalanceDate
    return blankPointForm({
      countryCode: last?.countryCode ?? settings.countryCode,
      taxRegimeId: last?.taxRegimeId ?? settings.taxRegimeId,
      startDate,
    })
  })()

  const formInitial = editingPoint ? pointToForm(editingPoint) : createDefaults

  return (
    <div className="space-y-4">
      <div className="sticky -top-4 z-10 -mx-4 -mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 md:-top-6 md:-mx-6 md:-mt-6 md:px-6">
        <h2 className="text-lg font-semibold text-slate-900">Маршрут</h2>
        <Button type="button" onClick={openCreate}>
          Добавить точку
        </Button>
      </div>

      <Card>
        {route.length === 0 ? (
          <EmptyState
            title="Нет точек маршрута"
            description="Добавьте страну проживания с датами и налоговым режимом."
          />
        ) : (
          <>
            <div className="divide-y divide-slate-100 md:hidden">
              {route.map((point, index) => {
                const regime = getTaxCalculator(point.taxRegimeId)
                const endLabel =
                  point.endDate === '9999-12-31' ? '…' : formatDateDisplay(point.endDate)
                return (
                  <SwipeRow
                    key={point.id}
                    active={editingId === point.id}
                    onOpen={() => openEdit(point.id)}
                    onEdit={() => openEdit(point.id)}
                    onRemove={() => removePoint(point.id)}
                  >
                    <div className="flex items-start gap-3 px-1 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium text-slate-900">
                          {index + 1}. {COUNTRY_LABELS[point.countryCode] ?? point.countryCode}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-slate-500">
                          {regime?.name ?? point.taxRegimeId} · {formatDateDisplay(point.startDate)}–
                          {endLabel}
                        </div>
                      </div>
                    </div>
                  </SwipeRow>
                )
              })}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 pr-4">Страна</th>
                    <th className="py-2 pr-4">Режим</th>
                    <th className="py-2 pr-4">Период</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {route.map((point) => {
                    const regime = getTaxCalculator(point.taxRegimeId)
                    const endLabel =
                      point.endDate === '9999-12-31' ? '…' : formatDateDisplay(point.endDate)
                    return (
                      <tr
                        key={point.id}
                        className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${
                          editingId === point.id ? 'bg-blue-50' : ''
                        }`}
                        onClick={() => openEdit(point.id)}
                      >
                        <td className="py-2 pr-4 font-medium">
                          {COUNTRY_LABELS[point.countryCode] ?? point.countryCode}
                        </td>
                        <td className="py-2 pr-4 text-slate-600">{regime?.name ?? point.taxRegimeId}</td>
                        <td className="py-2 pr-4 text-slate-500">
                          {formatDateDisplay(point.startDate)}–{endLabel}
                        </td>
                        <td className="py-2 text-right">
                          <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button variant="secondary" type="button" onClick={() => openEdit(point.id)}>
                              Изменить
                            </Button>
                            <Button
                              variant="danger"
                              type="button"
                              onClick={() => removePoint(point.id)}
                              disabled={route.length <= 1}
                            >
                              Удалить
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <Card>
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
      </Card>

      <StackPanel
        open={panelMode !== 'closed'}
        title={panelMode === 'edit' ? 'Точка маршрута' : 'Новая точка'}
        onClose={closePanel}
        headerActions={
          <Button type="submit" form={FORM_ID}>
            {panelMode === 'edit' ? 'Сохранить' : 'Добавить'}
          </Button>
        }
      >
        <RoutePointForm
          key={editingId ?? 'new'}
          formId={FORM_ID}
          initial={formInitial}
          onSubmit={handleSave}
        />
      </StackPanel>
    </div>
  )
}
