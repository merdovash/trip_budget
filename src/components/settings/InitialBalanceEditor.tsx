import type { BudgetSettings, InitialBalanceEntry } from '../../types/budget'
import { Button, Field, Input } from '../ui/FormControls'
import { CurrencySelect } from '../ui/CurrencySelect'
import { CurrencyConversionHint } from '../ui/CurrencyConversionHint'
import { formatCurrency } from '../../lib/format'
import {
  createInitialBalanceEntry,
  getInitialBalanceInBase,
  getInitialBalances,
} from '../../lib/initialBalance'

interface InitialBalanceEditorProps {
  settings: BudgetSettings
  onChange: (patch: Partial<BudgetSettings>) => void
}

function TrashButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
      onClick={onClick}
      disabled={disabled}
      aria-label="Удалить остаток"
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
  )
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
      createInitialBalanceEntry(
        { currency: settings.baseCurrency },
        defaultRate,
      ),
    ])
  }

  function removeEntry(id: string) {
    setEntries(entries.filter((entry) => entry.id !== id))
  }

  return (
    <div className="md:col-span-2 space-y-3">
      {entries.length === 0 && (
        <p className="text-sm text-slate-500">Добавьте один или несколько начальных остатков.</p>
      )}
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2"
        >
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Валюта" className="w-28 shrink-0">
              <CurrencySelect
                value={entry.currency}
                onChange={(currency) => updateEntry(entry.id, { currency })}
              />
            </Field>
            <Field label="Сумма" className="min-w-[8rem] flex-1">
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
            </Field>
            {showRates && (
              <Field label="Ставка % год." className="w-28 shrink-0">
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
              </Field>
            )}
            <Field label="Комментарий" className="min-w-[10rem] flex-[2]">
              <Input
                type="text"
                placeholder="Напр. накопительный"
                maxLength={80}
                value={entry.comment ?? ''}
                onChange={(e) => updateEntry(entry.id, { comment: e.target.value })}
              />
            </Field>
            <TrashButton onClick={() => removeEntry(entry.id)} />
          </div>
          {entry.amount > 0 && (
            <CurrencyConversionHint
              amount={entry.amount}
              currency={entry.currency}
              baseCurrency={settings.baseCurrency}
            />
          )}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" type="button" onClick={addEntry}>
          Добавить остаток
        </Button>
        {totalInBase > 0 && (
          <p className="text-sm text-slate-600">
            Итого в {settings.baseCurrency}:{' '}
            <span className="font-medium">{formatCurrency(totalInBase, settings.baseCurrency)}</span>
          </p>
        )}
      </div>
      {showRates && (
        <p className="text-xs text-slate-500">
          Ставка задаётся для каждой валюты остатка; проценты начисляются в последний день месяца.
        </p>
      )}
    </div>
  )
}
