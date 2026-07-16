import { useBudgetStore } from '../../store/budgetStore'
import { useExchangeRateStore } from '../../store/exchangeRateStore'
import { getTaxCalculator } from '../../tax/registry'
import { CURRENCIES, DEFAULT_SETTINGS } from '../../types/budget'
import { todayIsoDate } from '../../lib/format'
import { Button, Card, Field, Input, Select, DateInput } from '../ui/FormControls'
import { CurrencySelect } from '../ui/CurrencySelect'
import { CurrencyConversionHint } from '../ui/CurrencyConversionHint'
import { SavedSettingsPanel } from './SavedSettingsPanel'
import { ResidenceRouteEditor } from './ResidenceRouteEditor'
import {
  getRelocationProgramsForCountry,
  RELOCATION_PROGRAM_NONE,
} from '../../config/relocationPrograms'
import {
  EMPLOYMENT_COUNTRIES,
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
import { formatCurrency } from '../../lib/format'
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
  const applyRelocationProgramExpenses = useBudgetStore((s) => s.applyRelocationProgramExpenses)
  const rateDate = useExchangeRateStore((s) => s.rateDate)
  const rateStatus = useExchangeRateStore((s) => s.status)
  const rateError = useExchangeRateStore((s) => s.error)
  const fetchRates = useExchangeRateStore((s) => s.fetchRates)
  const relocationMode = getRelocationMode(settings)
  const primaryCountry = settings.countryCode
  const relocationPrograms = getRelocationProgramsForCountry(primaryCountry, relocationMode)
  const selectedProgram = relocationPrograms.find((p) => p.id === settings.relocationProgramId)
  const route = getResidenceRoute(settings)
  const primaryRegime = getTaxCalculator(settings.taxRegimeId)
  const showThailandDependentsHint = routeIncludesCountry(settings, 'TH')

  function handleRelocationModeChange(mode: RelocationMode) {
    const routePoints = ensureExplicitResidenceRoute(settings)
    const first = [...routePoints].sort((a, b) => a.startDate.localeCompare(b.startDate))[0]
    const suggestedRegime = suggestTaxRegimeForMode(first.countryCode, mode, first.taxRegimeId)
    const programs = getRelocationProgramsForCountry(first.countryCode, mode)
    const programStillValid = programs.some((p) => p.id === settings.relocationProgramId)
    const nextRoute = suggestedRegime
      ? routePoints.map((point) =>
          point.id === first.id ? { ...point, taxRegimeId: suggestedRegime } : point,
        )
      : routePoints
    setSettings({
      ...syncLegacyFromRoute(nextRoute),
      relocationMode: mode,
      employmentCountryCode:
        mode === 'remote_employment' ? settings.employmentCountryCode ?? 'RU' : undefined,
      ...(!programStillValid ? { relocationProgramId: RELOCATION_PROGRAM_NONE } : {}),
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
                  : 'Зарплата от работодателя в выбранной стране; налоги у источника и по маршруту проживания.'}
              </p>
            </Field>

            {relocationMode === 'remote_employment' && (
              <Field label="Страна работы (источник зарплаты)">
                <Select
                  value={settings.employmentCountryCode ?? 'RU'}
                  onChange={(e) => setSettings({ employmentCountryCode: e.target.value })}
                >
                  {EMPLOYMENT_COUNTRIES.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country.label}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <Field label="Программа переезда">
              <Select
                value={settings.relocationProgramId ?? RELOCATION_PROGRAM_NONE}
                onChange={(e) => setSettings({ relocationProgramId: e.target.value })}
              >
                <option value={RELOCATION_PROGRAM_NONE}>Без шаблона расходов</option>
                {relocationPrograms.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))}
              </Select>
              <p className="mt-1 text-xs text-slate-500">
                Шаблоны для первой страны маршрута (
                {route[0] ? route[0].countryCode : primaryCountry}).
              </p>
            </Field>
          </div>

          {selectedProgram && (
            <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm text-slate-700">{selectedProgram.description}</p>
              <ul className="mt-3 space-y-1 text-sm text-slate-600">
                {selectedProgram.expenses.map((expense) => (
                  <li key={expense.name} className="flex justify-between gap-4">
                    <span>{expense.name}</span>
                    <span className="shrink-0 font-medium">
                      {formatCurrency(expense.amount, expense.currency)}
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                type="button"
                variant="secondary"
                className="mt-3"
                onClick={() => {
                  const added = applyRelocationProgramExpenses()
                  if (added === 0) {
                    alert('Расходы программы уже добавлены или список пуст.')
                  }
                }}
              >
                Добавить разовые расходы программы
              </Button>
              <p className="mt-2 text-xs text-slate-500">
                Статьи появятся в разделе «Расходы» (вид «Разовый») с датами относительно начала
                маршрута.
              </p>
            </div>
          )}
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
                  {c}
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

          <Field label="Начальный остаток">
            <div className="flex gap-2">
              <CurrencySelect
                value={settings.initialBalanceCurrency ?? settings.baseCurrency}
                onChange={(currency) => setSettings({ initialBalanceCurrency: currency })}
                className="w-24 shrink-0"
              />
              <Input
                type="number"
                min={0}
                step={0.01}
                placeholder="Сумма"
                className="min-w-0 flex-1"
                value={(settings.initialBalance ?? 0) || ''}
                onChange={(e) =>
                  setSettings({ initialBalance: Number(e.target.value) || 0 })
                }
              />
            </div>
            <CurrencyConversionHint
              amount={settings.initialBalance ?? 0}
              currency={settings.initialBalanceCurrency ?? settings.baseCurrency}
              baseCurrency={settings.baseCurrency}
            />
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
              Положительный остаток в валюте счёта ({settings.savingsAccountCurrency ?? 'RUB'})
              учитывается на накопительном счёте; проценты начисляются в последний день месяца.
            </p>
          </Field>

          {settings.parkBalanceOnSavingsAccount && (
            <Field label="Ставка накопительного счёта (% годовых)">
              <Input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={settings.savingsAnnualRate ?? 16}
                onChange={(e) =>
                  setSettings({ savingsAnnualRate: Number(e.target.value) || 0 })
                }
              />
            </Field>
          )}
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
