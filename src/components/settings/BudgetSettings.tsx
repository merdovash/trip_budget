import { useBudgetStore } from '../../store/budgetStore'
import { useExchangeRateStore } from '../../store/exchangeRateStore'
import {
  COUNTRY_LABELS,
  getAvailableCountries,
  getCalculatorsByCountry,
} from '../../tax/registry'
import { CURRENCIES } from '../../types/budget'
import { todayIsoDate } from '../../lib/format'
import { Button, Card, Field, Input, Select, DateInput } from '../ui/FormControls'
import { CurrencySelect } from '../ui/CurrencySelect'
import { CurrencyConversionHint } from '../ui/CurrencyConversionHint'

export function BudgetSettingsPanel() {
  const settings = useBudgetStore((s) => s.settings)
  const setSettings = useBudgetStore((s) => s.setSettings)
  const rateDate = useExchangeRateStore((s) => s.rateDate)
  const rateStatus = useExchangeRateStore((s) => s.status)
  const rateError = useExchangeRateStore((s) => s.error)
  const fetchRates = useExchangeRateStore((s) => s.fetchRates)
  const countries = getAvailableCountries()
  const regimes = getCalculatorsByCountry(settings.countryCode)
  const selectedRegime = regimes.find((r) => r.id === settings.taxRegimeId)

  return (
    <Card>
      <h2 className="mb-4 text-lg font-semibold text-slate-900">Настройки бюджета</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Страна проживания">
          <Select
            value={settings.countryCode}
            onChange={(e) => {
              const countryCode = e.target.value
              const firstRegime = getCalculatorsByCountry(countryCode)[0]
              setSettings({
                countryCode,
                taxRegimeId: firstRegime?.id ?? settings.taxRegimeId,
              })
            }}
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
            value={settings.taxRegimeId}
            onChange={(e) => setSettings({ taxRegimeId: e.target.value })}
          >
            {regimes.map((regime) => (
              <option key={regime.id} value={regime.id}>
                {regime.name}
              </option>
            ))}
          </Select>
        </Field>

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
        </Field>
      </div>

      {selectedRegime && (
        <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
          <p className="font-medium text-slate-800">{selectedRegime.name}</p>
          <p className="mt-1">{selectedRegime.description}</p>
        </div>
      )}

      <div className="mt-4">
        <Button
          variant="secondary"
          type="button"
          onClick={() =>
            setSettings({
              baseCurrency: 'EUR',
              countryCode: 'ES',
              taxRegimeId: 'es-standard',
              familySize: 2,
              dependents: 0,
              horizonMonths: 12,
              initialBalance: 0,
              initialBalanceCurrency: 'EUR',
              initialBalanceDate: todayIsoDate(),
            })
          }
        >
          Сбросить настройки
        </Button>
      </div>
    </Card>
  )
}
