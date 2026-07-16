import type { BudgetSettings, InitialBalanceEntry } from '../../types/budget'
import { Button, Field, Input, DateInput } from '../ui/FormControls'
import { CurrencySelect } from '../ui/CurrencySelect'
import { CurrencyConversionHint } from '../ui/CurrencyConversionHint'
import { formatCurrency, todayIsoDate } from '../../lib/format'
import {
  createInitialBalanceEntry,
  getInitialBalanceInBase,
  getInitialBalances,
} from '../../lib/initialBalance'

interface InitialBalanceEditorProps {
  settings: BudgetSettings
  onChange: (patch: Partial<BudgetSettings>) => void
}

function TrashButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
      onClick={onClick}
      aria-label="Удалить остаток"
      title="Удалить"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M8.75 1A1.75 1.75 0 0 0 7 2.75V3H4.25a.75.75 0 0 0 0 1.5h.34l.92 11.03A2.25 2.25 0 0 0 7.75 17.5h4.5a2.25 2.25 0 0 0 2.24-1.97L15.41 4.5h.34a.75.75 0 0 0 0-1.5H13v-.25A1.75 1.75 0 0 0 11.25 1h-2.5ZM9.5 3h1v-.25a.25.25 0 0 0-.25-.25h-2.5a.25.25 0 0 0-.25.25V3h2Zm-1.8 3.25a.75.75 0 0 0-1.5.1l.5 8a.75.75 0 0 0 1.5-.1l-.5-8Zm5.1.1a.75.75 0 1 0-1.5-.1l-.5 8a.75.75 0 0 0 1.5.1l.5-8ZM10 6.5a.75.75 0 0 0-.75.75v8a.75.75 0 0 0 1.5 0v-8A.75.75 0 0 0 10 6.5Z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  )
}

function entryRowClass(showRates: boolean) {
  return showRates
    ? 'flex flex-col gap-2 sm:grid sm:grid-cols-[5.5rem_minmax(0,1fr)_4.5rem_minmax(0,1.5fr)_2rem] sm:items-center'
    : 'flex flex-col gap-2 sm:grid sm:grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,1.5fr)_2rem] sm:items-center'
}

export function InitialBalanceEditor({ settings, onChange }: InitialBalanceEditorProps) {
  const entries = getInitialBalances(settings)
  const totalInBase = getInitialBalanceInBase(settings)
  const showRates = Boolean(settings.parkBalanceOnSavingsAccount)
  const defaultRate = settings.savingsAnnualRate ?? 16

  function setEntries(next: InitialBalanceEntry[]) {
    onChange({ initialBalances: next })
  }

  function updateEntry(id: string, patch: Partial<InitialBalanceEntry>) {
    setEntries(entries.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)))
  }

  function addEntry() {
    setEntries([
      ...entries,
      createInitialBalanceEntry({ currency: settings.baseCurrency }, defaultRate),
    ])
  }

  function removeEntry(id: string) {
    setEntries(entries.filter((entry) => entry.id !== id))
  }

  return (
    <div className="min-w-0 space-y-3">
      <Field label="Дата начального остатка">
        <DateInput
          value={settings.initialBalanceDate ?? todayIsoDate()}
          onChange={(initialBalanceDate) => onChange({ initialBalanceDate })}
        />
        <p className="mt-1 text-xs text-slate-500">
          График и прогноз бюджета начинаются с этого месяца.
        </p>
      </Field>

      <div className="min-w-0">
        <p className="mb-2 text-sm font-medium text-slate-700">Суммы</p>
        <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200">
          <div
            className={`hidden gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500 sm:grid ${
              showRates
                ? 'sm:grid-cols-[5.5rem_minmax(0,1fr)_4.5rem_minmax(0,1.5fr)_2rem]'
                : 'sm:grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,1.5fr)_2rem]'
            }`}
          >
            <span>Валюта</span>
            <span>Сумма</span>
            {showRates && <span>Ставка %</span>}
            <span>Комментарий</span>
            <span />
          </div>

          {entries.length === 0 && (
            <p className="px-3 py-4 text-sm text-slate-500">Список пуст — добавьте остаток.</p>
          )}

          <ul className="divide-y divide-slate-100">
            {entries.map((entry) => (
              <li key={entry.id} className="min-w-0 px-3 py-3 sm:py-2">
                <div className={entryRowClass(showRates)}>
                  <div className="min-w-0">
                    <span className="mb-1 block text-xs font-medium text-slate-500 sm:hidden">
                      Валюта
                    </span>
                    <CurrencySelect
                      value={entry.currency}
                      onChange={(currency) => updateEntry(entry.id, { currency })}
                      className="w-full"
                    />
                  </div>
                  <div className="min-w-0">
                    <span className="mb-1 block text-xs font-medium text-slate-500 sm:hidden">
                      Сумма
                    </span>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="0"
                      value={entry.amount || ''}
                      onChange={(e) =>
                        updateEntry(entry.id, { amount: Number(e.target.value) || 0 })
                      }
                    />
                  </div>
                  {showRates && (
                    <div className="min-w-0">
                      <span className="mb-1 block text-xs font-medium text-slate-500 sm:hidden">
                        Ставка %
                      </span>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={0.1}
                        value={entry.annualRate ?? defaultRate}
                        onChange={(e) =>
                          updateEntry(entry.id, { annualRate: Number(e.target.value) || 0 })
                        }
                      />
                    </div>
                  )}
                  <div className="flex min-w-0 items-end gap-2 sm:contents">
                    <div className="min-w-0 flex-1">
                      <span className="mb-1 block text-xs font-medium text-slate-500 sm:hidden">
                        Комментарий
                      </span>
                      <Input
                        type="text"
                        placeholder="Краткий комментарий"
                        maxLength={80}
                        value={entry.comment ?? ''}
                        onChange={(e) => updateEntry(entry.id, { comment: e.target.value })}
                      />
                    </div>
                    <TrashButton onClick={() => removeEntry(entry.id)} />
                  </div>
                </div>
                {entry.amount > 0 && (
                  <div className="mt-1 min-w-0 break-words">
                    <CurrencyConversionHint
                      amount={entry.amount}
                      currency={entry.currency}
                      baseCurrency={settings.baseCurrency}
                      side="neutral"
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Button variant="secondary" type="button" onClick={addEntry}>
            Добавить остаток
          </Button>
          {totalInBase > 0 && (
            <p className="min-w-0 break-words text-sm text-slate-600">
              Итого в {settings.baseCurrency}:{' '}
              <span className="font-medium">
                {formatCurrency(totalInBase, settings.baseCurrency)}
              </span>
            </p>
          )}
        </div>
        {showRates && (
          <p className="mt-2 text-xs text-slate-500">
            Ставка задаётся для каждой валюты; проценты — в последний день месяца.
          </p>
        )}
      </div>
    </div>
  )
}
