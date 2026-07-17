import { useBudgetStore } from '../../store/budgetStore'
import { useExchangeRateStore } from '../../store/exchangeRateStore'
import { CURRENCIES, CURRENCY_LABELS, DEFAULT_SETTINGS } from '../../types/budget'
import { Button, Card, Field, Input, Select } from '../ui/FormControls'
import { routeIncludesCountry } from '../../config/residenceRoute'
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
    <section className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {description && <p className="mt-1 text-xs text-slate-500">{description}</p>}
      <div className="mt-4 grid min-w-0 gap-4 [&>*]:min-w-0 md:grid-cols-2">{children}</div>
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
  const showThailandDependentsHint = routeIncludesCountry(settings, 'TH')

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

        <SettingsSection
          title="Параметры расчёта"
          description="Валюта отчёта, комиссия конвертации, курсы и горизонт прогноза."
        >
          <Field label="Базовая валюта">
            <Select
              value={settings.baseCurrency}
              onChange={(e) => setSettings({ baseCurrency: e.target.value })}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c === settings.baseCurrency ? c : `${CURRENCY_LABELS[c]} (${c})`}
                </option>
              ))}
            </Select>
            <p className="mt-1 break-words text-xs text-slate-500">
              Дашборд и налоги считаются в базовой валюте. Конвертация — по официальным курсам
              ЦБ РФ (обновляются ежедневно).
            </p>
          </Field>

          <Field label="Комиссия за конвертацию, %">
            <Input
              type="number"
              min={0}
              max={20}
              step={0.1}
              value={settings.currencyConversionFeePercent ?? 0}
              onChange={(e) =>
                setSettings({
                  currencyConversionFeePercent: Math.max(0, Number(e.target.value) || 0),
                })
              }
            />
            <p className="mt-1 break-words text-xs text-slate-500">
              Одна ставка на все расчёты. К курсу ЦБ: расходы дороже на этот %, доходы — дешевле.
              При совпадении валют комиссия не применяется.
            </p>
          </Field>

          <Field label="Курсы валют ЦБ РФ">
            <div className="min-w-0 break-words rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
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

          <Field label="Горизонт прогноза (мес.)">
            <Input
              type="number"
              min={1}
              max={60}
              value={settings.horizonMonths}
              onChange={(e) => setSettings({ horizonMonths: Number(e.target.value) })}
            />
          </Field>
        </SettingsSection>
      </div>

      <div className="mt-4">
        <Button
          variant="secondary"
          type="button"
          onClick={() => setSettings({ ...DEFAULT_SETTINGS })}
        >
          Сбросить настройки
        </Button>
      </div>
    </Card>
  )
}
