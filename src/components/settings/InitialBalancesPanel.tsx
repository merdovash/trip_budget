import { useBudgetStore } from '../../store/budgetStore'
import { Card, Field, Select } from '../ui/FormControls'
import { InitialBalanceEditor } from './InitialBalanceEditor'

export function InitialBalancesPanel() {
  const settings = useBudgetStore((s) => s.settings)
  const setSettings = useBudgetStore((s) => s.setSettings)

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Начальные остатки</h2>
      <p className="mb-4 text-sm text-slate-500">
        Стартовые суммы по валютам и накопительный счёт. Дата остатка задаёт начало прогноза.
      </p>

      <div className="min-w-0 space-y-4">
        <InitialBalanceEditor settings={settings} onChange={setSettings} />

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
            Остатки по валютам учитываются на накопительных счетах; ставка задаётся у каждой суммы.
            Проценты — в последний день месяца.
          </p>
        </Field>
      </div>
    </Card>
  )
}
