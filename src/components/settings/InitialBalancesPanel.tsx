import { useMemo, useState, type FormEvent } from 'react'
import { useBudgetStore } from '../../store/budgetStore'
import type { InitialBalanceEntry } from '../../types/budget'
import { Button, Card, DateInput, EmptyState, Field, Input, Select } from '../ui/FormControls'
import { CurrencySelect } from '../ui/CurrencySelect'
import { CurrencyConversionHint } from '../ui/CurrencyConversionHint'
import { StackPanel } from '../ui/StackPanel'
import { SwipeRow } from '../ui/SwipeRow'
import { formatCurrency, formatDateDisplay, todayIsoDate } from '../../lib/format'
import { convertCurrency } from '../../lib/currency'
import {
  createInitialBalanceEntry,
  getInitialBalanceInBase,
  getInitialBalances,
} from '../../lib/initialBalance'

const FORM_ID = 'balance-entry-form'

type BalanceFormState = {
  amount: number
  currency: string
  comment: string
  annualRate: number
}

function entryToForm(entry: InitialBalanceEntry, defaultRate: number): BalanceFormState {
  return {
    amount: entry.amount,
    currency: entry.currency,
    comment: entry.comment ?? '',
    annualRate: entry.annualRate ?? defaultRate,
  }
}

function BalanceEntryForm({
  formId,
  initial,
  showRate,
  baseCurrency,
  onSubmit,
}: {
  formId: string
  initial: BalanceFormState
  showRate: boolean
  baseCurrency: string
  onSubmit: (form: BalanceFormState) => void
}) {
  const [form, setForm] = useState(initial)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (form.amount < 0) {
      setError('Сумма не может быть отрицательной')
      return
    }
    setError(null)
    onSubmit(form)
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="grid min-w-0 gap-3 [&>*]:min-w-0 md:grid-cols-2">
      <Field label="Валюта">
        <CurrencySelect
          value={form.currency}
          onChange={(currency) => setForm({ ...form, currency })}
          className="w-full"
        />
      </Field>
      <Field label="Сумма" error={error ?? undefined}>
        <Input
          type="number"
          min={0}
          step={0.01}
          placeholder="0"
          value={form.amount || ''}
          onChange={(e) => setForm({ ...form, amount: Number(e.target.value) || 0 })}
        />
        <CurrencyConversionHint
          amount={form.amount}
          currency={form.currency}
          baseCurrency={baseCurrency}
          side="neutral"
        />
      </Field>
      {showRate && (
        <Field label="Ставка накопительного, %">
          <Input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={form.annualRate}
            onChange={(e) => setForm({ ...form, annualRate: Number(e.target.value) || 0 })}
          />
        </Field>
      )}
      <Field label="Комментарий" className={showRate ? undefined : 'md:col-span-2'}>
        <Input
          type="text"
          placeholder="Краткий комментарий"
          maxLength={80}
          value={form.comment}
          onChange={(e) => setForm({ ...form, comment: e.target.value })}
        />
      </Field>
    </form>
  )
}

export function InitialBalancesPanel() {
  const settings = useBudgetStore((s) => s.settings)
  const setSettings = useBudgetStore((s) => s.setSettings)
  const entries = getInitialBalances(settings)
  const totalInBase = getInitialBalanceInBase(settings)
  const showRates = Boolean(settings.parkBalanceOnSavingsAccount)
  const defaultRate = settings.savingsAnnualRate ?? 16
  const [panelMode, setPanelMode] = useState<'closed' | 'create' | 'edit'>('closed')
  const [editingId, setEditingId] = useState<string | null>(null)

  const editingEntry = useMemo(
    () => (panelMode === 'edit' && editingId ? entries.find((e) => e.id === editingId) : undefined),
    [panelMode, editingId, entries],
  )

  function setEntries(next: InitialBalanceEntry[]) {
    setSettings({ initialBalances: next })
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

  function removeEntry(id: string) {
    setEntries(entries.filter((entry) => entry.id !== id))
    if (editingId === id) closePanel()
  }

  function handleSave(form: BalanceFormState) {
    if (panelMode === 'edit' && editingId) {
      setEntries(
        entries.map((entry) =>
          entry.id === editingId
            ? {
                ...entry,
                amount: form.amount,
                currency: form.currency,
                comment: form.comment.trim() || undefined,
                annualRate: form.annualRate,
              }
            : entry,
        ),
      )
    } else {
      setEntries([
        ...entries,
        createInitialBalanceEntry(
          {
            amount: form.amount,
            currency: form.currency,
            comment: form.comment.trim() || undefined,
            annualRate: form.annualRate,
          },
          defaultRate,
        ),
      ])
    }
    closePanel()
  }

  const formInitial: BalanceFormState = editingEntry
    ? entryToForm(editingEntry, defaultRate)
    : {
        amount: 0,
        currency: settings.baseCurrency,
        comment: '',
        annualRate: defaultRate,
      }

  return (
    <div className="space-y-4">
      <div className="sticky -top-4 z-10 -mx-4 -mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 md:-top-6 md:-mx-6 md:-mt-6 md:px-6">
        <h2 className="text-lg font-semibold text-slate-900">Остатки</h2>
        <Button type="button" onClick={openCreate}>
          Добавить остаток
        </Button>
      </div>

      <Card>
        <div className="mb-4 grid min-w-0 gap-4 [&>*]:min-w-0 md:grid-cols-2">
          <Field label="Дата начального остатка">
            <DateInput
              value={settings.initialBalanceDate ?? todayIsoDate()}
              onChange={(initialBalanceDate) => setSettings({ initialBalanceDate })}
            />
            <p className="mt-1 text-xs text-slate-500">
              График и прогноз бюджета начинаются с этого месяца.
            </p>
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
              Ставка задаётся у каждой суммы; проценты — в последний день месяца.
            </p>
          </Field>
        </div>

        {entries.length === 0 ? (
          <EmptyState
            title="Нет остатков"
            description="Добавьте стартовые суммы по валютам."
          />
        ) : (
          <>
            <div className="divide-y divide-slate-100 border-t border-slate-100 md:hidden">
              {entries.map((entry) => (
                <SwipeRow
                  key={entry.id}
                  active={editingId === entry.id}
                  onOpen={() => openEdit(entry.id)}
                  onEdit={() => openEdit(entry.id)}
                  onRemove={() => removeEntry(entry.id)}
                >
                  <div className="flex items-start gap-3 px-1 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-slate-900">
                        {formatCurrency(entry.amount, entry.currency)}
                      </div>
                      <div className="mt-0.5 truncate text-xs text-slate-500">
                        {entry.currency}
                        {showRates ? ` · ${entry.annualRate ?? defaultRate}%` : ''}
                        {entry.comment ? ` · ${entry.comment}` : ''}
                      </div>
                    </div>
                  </div>
                </SwipeRow>
              ))}
            </div>

            <div className="hidden overflow-x-auto border-t border-slate-100 md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 pr-4">Валюта</th>
                    <th className="py-2 pr-4">Сумма</th>
                    {showRates && <th className="py-2 pr-4">Ставка %</th>}
                    <th className="py-2 pr-4">Комментарий</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr
                      key={entry.id}
                      className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${
                        editingId === entry.id ? 'bg-blue-50' : ''
                      }`}
                      onClick={() => openEdit(entry.id)}
                    >
                      <td className="py-2 pr-4 font-medium">{entry.currency}</td>
                      <td className="py-2 pr-4">
                        <div>{formatCurrency(entry.amount, entry.currency)}</div>
                        {entry.amount > 0 && entry.currency !== settings.baseCurrency && (
                          <div className="text-xs text-slate-400">
                            ≈{' '}
                            {formatCurrency(
                              convertCurrency(entry.amount, entry.currency, settings.baseCurrency),
                              settings.baseCurrency,
                            )}
                          </div>
                        )}
                      </td>
                      {showRates && (
                        <td className="py-2 pr-4 text-slate-600">
                          {entry.annualRate ?? defaultRate}
                        </td>
                      )}
                      <td className="py-2 pr-4 text-slate-500">{entry.comment || '—'}</td>
                      <td className="py-2 text-right">
                        <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="secondary"
                            type="button"
                            onClick={() => openEdit(entry.id)}
                          >
                            Изменить
                          </Button>
                          <Button variant="danger" type="button" onClick={() => removeEntry(entry.id)}>
                            Удалить
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalInBase > 0 && (
              <p className="mt-3 min-w-0 break-words text-sm text-slate-600">
                Итого в {settings.baseCurrency}:{' '}
                <span className="font-medium">
                  {formatCurrency(totalInBase, settings.baseCurrency)}
                </span>
                {settings.initialBalanceDate && (
                  <span className="text-slate-400">
                    {' '}
                    · с {formatDateDisplay(settings.initialBalanceDate)}
                  </span>
                )}
              </p>
            )}
          </>
        )}
      </Card>

      <StackPanel
        open={panelMode !== 'closed'}
        title={panelMode === 'edit' ? 'Карточка остатка' : 'Новый остаток'}
        onClose={closePanel}
        headerActions={
          <Button type="submit" form={FORM_ID}>
            {panelMode === 'edit' ? 'Сохранить' : 'Добавить'}
          </Button>
        }
      >
        <BalanceEntryForm
          key={editingId ?? 'new'}
          formId={FORM_ID}
          initial={formInitial}
          showRate={showRates}
          baseCurrency={settings.baseCurrency}
          onSubmit={handleSave}
        />
      </StackPanel>
    </div>
  )
}
