import { useState } from 'react'
import {
  COUNTRY_LABELS,
  getCalculatorsByCountry,
  getTaxCalculator,
} from '../../tax/registry'
import { describeResidenceRoute } from '../../config/residenceRoute'
import { formatDateDisplay } from '../../lib/format'
import {
  deleteSettingsSnapshot,
  getSettingsSnapshot,
  listSettingsSnapshots,
  saveSettingsSnapshot,
} from '../../lib/settingsSnapshots'
import type { SettingsSnapshotSummary } from '../../types/settingsSnapshot'
import { useBudgetStore } from '../../store/budgetStore'
import { Button, Field, Input } from '../ui/FormControls'

function SettingsSnapshotDetails({ id }: { id: string }) {
  const snapshot = getSettingsSnapshot(id)
  if (!snapshot) return null

  const regime = getTaxCalculator(snapshot.settings.taxRegimeId)
  const rows: Array<{ label: string; value: string }> = [
    { label: 'Страна проживания', value: COUNTRY_LABELS[snapshot.settings.countryCode] ?? snapshot.settings.countryCode },
    { label: 'Налоговый режим', value: regime?.name ?? snapshot.settings.taxRegimeId },
    { label: 'Базовая валюта', value: snapshot.settings.baseCurrency },
    { label: 'Начальный остаток', value: `${snapshot.settings.initialBalance ?? 0} ${snapshot.settings.initialBalanceCurrency ?? snapshot.settings.baseCurrency}` },
    { label: 'Дата начального остатка', value: formatDateDisplay(snapshot.settings.initialBalanceDate) },
    {
      label: 'Способ переезда',
      value:
        snapshot.settings.relocationMode === 'sole_proprietorship'
          ? 'ИП в стране проживания'
          : 'Работа в другой стране',
    },
    {
      label: 'Дата переезда',
      value: formatDateDisplay(snapshot.settings.relocationDate ?? snapshot.settings.initialBalanceDate),
    },
    {
      label: 'Маршрут проживания',
      value: describeResidenceRoute(snapshot.settings),
    },
    ...(snapshot.settings.relocationMode !== 'sole_proprietorship'
      ? [
          {
            label: 'Страна работы',
            value: snapshot.settings.employmentCountryCode === 'ES' ? 'Испания' : 'Россия',
          },
        ]
      : []),
    { label: 'Горизонт прогноза', value: `${snapshot.settings.horizonMonths} мес.` },
    {
      label: 'Накопительный счёт RUB',
      value: snapshot.settings.parkRubOnSavingsAccount
        ? `Да, ${snapshot.settings.rubSavingsAnnualRate ?? 16}% годовых`
        : 'Нет',
    },
    { label: 'Размер семьи', value: String(snapshot.settings.familySize) },
    { label: 'Иждивенцы', value: String(snapshot.settings.dependents) },
  ]

  return (
    <dl className="mt-3 space-y-2 rounded-lg border border-slate-200 bg-white p-3 text-sm">
      {rows.map((row) => (
        <div key={row.label} className="flex justify-between gap-4">
          <dt className="text-slate-500">{row.label}</dt>
          <dd className="font-medium text-slate-800">{row.value}</dd>
        </div>
      ))}
      {regime?.description && (
        <p className="border-t border-slate-100 pt-2 text-xs text-slate-500">{regime.description}</p>
      )}
    </dl>
  )
}

export function SavedSettingsPanel() {
  const settings = useBudgetStore((s) => s.settings)
  const setSettings = useBudgetStore((s) => s.setSettings)

  const [name, setName] = useState('')
  const [snapshots, setSnapshots] = useState<SettingsSnapshotSummary[]>(() => listSettingsSnapshots())
  const [viewId, setViewId] = useState<string | null>(null)

  function reload() {
    setSnapshots(listSettingsSnapshots())
  }

  function handleSave() {
    if (!name.trim()) return
    saveSettingsSnapshot(name, settings)
    setName('')
    reload()
  }

  function handleApply(snapshot: SettingsSnapshotSummary) {
    const full = getSettingsSnapshot(snapshot.id)
    if (!full) return
    if (!confirm(`Применить настройки «${full.name}»? Текущие значения будут заменены.`)) {
      return
    }
    setSettings(full.settings)
  }

  function handleDelete(snapshot: SettingsSnapshotSummary) {
    if (!confirm(`Удалить сохранённые настройки «${snapshot.name}»?`)) return
    deleteSettingsSnapshot(snapshot.id)
    if (viewId === snapshot.id) setViewId(null)
    reload()
  }

  const currentRegime = getCalculatorsByCountry(settings.countryCode).find(
    (regime) => regime.id === settings.taxRegimeId,
  )

  return (
    <div className="mt-6 border-t border-slate-200 pt-6">
      <h3 className="text-base font-semibold text-slate-900">Сохранённые настройки</h3>
      <p className="mt-1 text-sm text-slate-500">
        Сохраните текущий профиль ({COUNTRY_LABELS[settings.countryCode] ?? settings.countryCode}
        {currentRegime ? ` · ${currentRegime.name}` : ''}), чтобы позже открыть и сравнить или
        применить.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <Field label="Название профиля" className="min-w-[14rem] flex-1">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например: Испания, nómina"
          />
        </Field>
        <Button type="button" onClick={handleSave} disabled={!name.trim()}>
          Сохранить текущие
        </Button>
      </div>

      {snapshots.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Пока нет сохранённых профилей настроек.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {snapshots.map((snapshot) => {
            const regime = getTaxCalculator(snapshot.taxRegimeId)
            const isOpen = viewId === snapshot.id
            return (
              <li
                key={snapshot.id}
                className="rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-slate-900">{snapshot.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatDateDisplay(snapshot.savedAt.slice(0, 10))} ·{' '}
                      {COUNTRY_LABELS[snapshot.countryCode] ?? snapshot.countryCode} ·{' '}
                      {regime?.name ?? snapshot.taxRegimeId} · {snapshot.baseCurrency}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setViewId(isOpen ? null : snapshot.id)}
                    >
                      {isOpen ? 'Скрыть' : 'Открыть'}
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => handleApply(snapshot)}>
                      Применить
                    </Button>
                    <Button type="button" variant="danger" onClick={() => handleDelete(snapshot)}>
                      Удалить
                    </Button>
                  </div>
                </div>
                {isOpen && <SettingsSnapshotDetails id={snapshot.id} />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
