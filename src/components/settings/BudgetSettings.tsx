import { useBudgetStore } from '../../store/budgetStore'
import { useExchangeRateStore } from '../../store/exchangeRateStore'
import { getTaxCalculator } from '../../tax/registry'
import { CURRENCIES, CURRENCY_LABELS, DEFAULT_SETTINGS } from '../../types/budget'
import { todayIsoDate } from '../../lib/format'
import { Button, Card, Field, Input, Select, DateInput } from '../ui/FormControls'
import { SavedSettingsPanel } from './SavedSettingsPanel'
import { ResidenceRouteEditor } from './ResidenceRouteEditor'
import { InitialBalanceEditor } from './InitialBalanceEditor'
import {
  getRelocationMode,
  RELOCATION_MODE_LABELS,
  suggestTaxRegimeForMode,
} from '../../config/relocationMode'
import {
  ensureExplicitResidenceRoute,
  getResidenceRoute,
  routeIncludesCountry,
  syncLegacyFromRoute,
} from '../../config/residenceRoute'
import type { RelocationMode } from '../../types/budget'
import type { ReactNode } from 'react'

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
      <div className="mt-4 grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  )
}

export function BudgetSettingsPanel() {
  const settings = useBudgetStore((s) => s.settings)
  const setSettings = useBudgetStore((s) => s.setSettings)
  const rateDate = useExchangeRateStore((s) => s.rateDate)
  const rateStatus = useExchangeRateStore((s) => s.status)
  const rateError = useExchangeRateStore((s) => s.error)
  const fetchRates = useExchangeRateStore((s) => s.fetchRates)
  const relocationMode = getRelocationMode(settings)
  const route = getResidenceRoute(settings)
  const primaryRegime = getTaxCalculator(settings.taxRegimeId)
  const showThailandDependentsHint = routeIncludesCountry(settings, 'TH')

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
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Настройки бюджета</h2>

      <div className="space-y-4">
        <SettingsSection
          title="О себе"
          description="Семья и иждивенцы влияют на налоговые вычеты в странах проживания."
        >
          <Field label="Размер семьи">
            <Input
              type="number"
              min={1}
              value={settings.familySize}
              onChange={(e) => setSettings({ familySize: Number(e.target.value) })}
            />
          </Field>

          <Field label="Иждивенцы">
            <Input
              type="number"
              min={0}
              value={settings.dependents}
              onChange={(e) => setSettings({ dependents: Number(e.target.value) })}
            />
            {showThailandDependentsHint && (
              <p className="mt-1 text-xs text-slate-500">
                Для PIT Таиланда: вычет ฿30 000 на каждого ребёнка (в точке маршрута TH).
              </p>
            )}
          </Field>
        </SettingsSection>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-800">Маршрут проживания</h3>
          <p className="mt-1 text-xs text-slate-500">
            Страны, налоговые режимы, даты и параметры режима (например, вычеты PIT в Таиланде).
          </p>
          <div className="mt-4">
            <ResidenceRouteEditor settings={settings} onChange={setSettings} />
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
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
        </section>

        <SettingsSection
          title="Параметры расчёта"
          description="Валюта отчёта, горизонт прогноза, начальный остаток и накопительный счёт."
        >
          <Field label="Базовая валюта">
            <Select
              value={settings.baseCurrency}
              onChange={(e) => setSettings({ baseCurrency: e.target.value })}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {CURRENCY_LABELS[c]} ({c})
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-slate-500">
              Дашборд и налоги считаются в базовой валюте. Конвертация — по официальным курсам
              ЦБ РФ (обновляются ежедневно).
            </p>
          </Field>

          <Field label="Курсы валют ЦБ РФ">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              {rateStatus === 'loading' && 'Загрузка курсов…'}
              {rateStatus === 'loaded' && rateDate && (
                <>
                  Загружено:{' '}
                  {new Date(rateDate).toLocaleString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </>
              )}
              {rateStatus === 'error' && (
                <span className="text-red-600">{rateError ?? 'Ошибка загрузки'}</span>
              )}
              {rateStatus === 'idle' && 'Курсы ещё не загружены'}
            </div>
            <Button
              variant="secondary"
              type="button"
              className="mt-2"
              onClick={() => fetchRates()}
              disabled={rateStatus === 'loading'}
            >
              Обновить курсы
            </Button>
          </Field>

          <Field label="Начальные остатки">
            <InitialBalanceEditor settings={settings} onChange={setSettings} />
          </Field>

          <Field label="Дата начального остатка">
            <DateInput
              value={settings.initialBalanceDate ?? todayIsoDate()}
              onChange={(initialBalanceDate) => setSettings({ initialBalanceDate })}
            />
            <p className="mt-1 text-xs text-slate-500">
              График и прогноз бюджета начинаются с этого месяца.
            </p>
          </Field>

          <Field label="Горизонт прогноза (мес.)">
            <Input
              type="number"
              min={1}
              max={60}
              value={settings.horizonMonths}
              onChange={(e) => setSettings({ horizonMonths: Number(e.target.value) })}
            />
          </Field>

          <Field label="Накопительный счёт">
            <Select
              value={settings.parkBalanceOnSavingsAccount ? 'yes' : 'no'}
              onChange={(e) =>
                setSettings({ parkBalanceOnSavingsAccount: e.target.value === 'yes' })
              }
            >
              <option value="no">Нет</option>
              <option value="yes">Да</option>
            </Select>
            <p className="mt-1 text-xs text-slate-500">
              Остатки по валютам из блока «Начальные остатки» учитываются на накопительных счетах;
              ставка задаётся у каждой суммы. Проценты — в последний день месяца.
            </p>
          </Field>
        </SettingsSection>
      </div>

      {primaryRegime && route.length === 1 && (
        <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-800">{primaryRegime.name}</p>
          <p className="mt-1">{primaryRegime.description}</p>
        </div>
      )}

      <div className="mt-4">
        <Button
          variant="secondary"
          type="button"
          onClick={() => setSettings({ ...DEFAULT_SETTINGS })}
        >
          Сбросить настройки
        </Button>
      </div>

      <SavedSettingsPanel />
    </Card>
  )
}
