import { useState, type FormEvent } from 'react'
import { todayIsoDate, formatCurrency, formatDateDisplay } from '../../lib/format'
import { convertCurrency } from '../../lib/currency'
import { useExchangeRateStore } from '../../store/exchangeRateStore'
import { oneTimeExpenseSchema, type OneTimeExpenseFormData } from '../../lib/validation'
import {
  getExpenseCountryScope,
  getExpenseCountryScopeLabel,
  getExpenseCountryScopeOptions,
} from '../../lib/expenseCountry'
import { useBudgetStore } from '../../store/budgetStore'
import type { BudgetSettings, OneTimeExpense } from '../../types/budget'
import { Button, Card, EmptyState, Field, Input, Select, DateInput } from '../ui/FormControls'
import { CurrencySelect } from '../ui/CurrencySelect'
import { CurrencyConversionHint } from '../ui/CurrencyConversionHint'

const ONE_TIME_CATEGORIES = ['Переезд', 'Депозит', 'Мебель', 'Авто', 'Ремонт', 'Обучение', 'Другое']

function oneTimeToFormData(item: OneTimeExpense, settings: BudgetSettings): OneTimeExpenseFormData {
  return {
    name: item.name,
    amount: item.amount,
    currency: item.currency,
    date: item.date,
    category: item.category ?? '',
    expenseCountryScope: getExpenseCountryScope(item, settings),
  }
}

interface OneTimeFormProps {
  initialItem?: OneTimeExpense
  onSubmit: (data: OneTimeExpenseFormData) => void
  onCancel?: () => void
}

function OneTimeForm({ initialItem, onSubmit, onCancel }: OneTimeFormProps) {
  const settings = useBudgetStore((s) => s.settings)
  const [form, setForm] = useState<OneTimeExpenseFormData>(() =>
    initialItem
      ? oneTimeToFormData(initialItem, settings)
      : {
          name: '',
          amount: 0,
          currency: settings.baseCurrency,
          date: todayIsoDate(),
          category: '',
          expenseCountryScope: 'residence',
        },
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const isEditing = Boolean(initialItem)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const result = oneTimeExpenseSchema.safeParse(form)
    if (!result.success) {
      const next: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const key = issue.path[0]?.toString()
        if (key) next[key] = issue.message
      }
      setErrors(next)
      return
    }
    setErrors({})
    onSubmit(result.data)
    if (!isEditing) {
      setForm({
        name: '',
        amount: 0,
        currency: settings.baseCurrency,
        date: todayIsoDate(),
        category: '',
        expenseCountryScope: 'residence',
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
      <Field label="Название" error={errors.name}>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>
      <Field label="Сумма" error={errors.amount}>
        <div className="flex gap-2">
          <CurrencySelect
            value={form.currency}
            onChange={(currency) => setForm({ ...form, currency })}
            className="w-24 shrink-0"
          />
          <Input
            type="number"
            min={0}
            step={0.01}
            placeholder="Сумма"
            className="min-w-0 flex-1"
            value={form.amount || ''}
            onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
          />
        </div>
        <CurrencyConversionHint
          amount={form.amount}
          currency={form.currency}
          baseCurrency={settings.baseCurrency}
        />
      </Field>
      <Field label="Дата" error={errors.date}>
        <DateInput value={form.date} onChange={(date) => setForm({ ...form, date })} />
      </Field>
      <Field label="Категория">
        <Select
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        >
          <option value="">—</option>
          {ONE_TIME_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Страна расхода" error={errors.expenseCountryScope}>
        <Select
          value={form.expenseCountryScope}
          onChange={(e) =>
            setForm({
              ...form,
              expenseCountryScope: e.target.value as OneTimeExpenseFormData['expenseCountryScope'],
            })
          }
        >
          {getExpenseCountryScopeOptions(settings).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-xs text-slate-500">
          Для remittance в Таиланде учитываются только расходы в стране проживания.
        </p>
      </Field>
      <div className="flex flex-wrap gap-2 md:col-span-2">
        <Button type="submit">{isEditing ? 'Сохранить' : 'Добавить трату'}</Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Отмена
          </Button>
        )}
      </div>
    </form>
  )
}

function OneTimeList({
  editingId,
  onEdit,
  onRemove,
}: {
  editingId: string | null
  onEdit: (id: string) => void
  onRemove: (id: string) => void
}) {
  const oneTimeExpenses = useBudgetStore((s) => s.oneTimeExpenses)
  const settings = useBudgetStore((s) => s.settings)
  useExchangeRateStore((s) => s.rateDate)

  if (oneTimeExpenses.length === 0) {
    return (
      <EmptyState
        title="Нет разовых трат"
        description="Добавьте депозит, переезд, покупку мебели или другие крупные расходы."
      />
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            <th className="py-2 pr-4">Название</th>
            <th className="py-2 pr-4">Сумма</th>
            <th className="py-2 pr-4">Дата</th>
            <th className="py-2 pr-4">Категория</th>
            <th className="py-2 pr-4">Страна</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {oneTimeExpenses.map((item) => {
            const converted = convertCurrency(item.amount, item.currency, settings.baseCurrency)
            const showConversion = item.currency !== settings.baseCurrency

            return (
              <tr
                key={item.id}
                className={`border-b border-slate-100 ${editingId === item.id ? 'bg-blue-50' : ''}`}
              >
                <td className="py-2 pr-4 font-medium">{item.name}</td>
                <td className="py-2 pr-4">
                  <div>{formatCurrency(item.amount, item.currency)}</div>
                  {showConversion && (
                    <div className="text-xs text-slate-500">
                      ≈ {formatCurrency(converted, settings.baseCurrency)}
                    </div>
                  )}
                </td>
                <td className="py-2 pr-4">{formatDateDisplay(item.date)}</td>
                <td className="py-2 pr-4 text-slate-500">{item.category ?? '—'}</td>
                <td className="py-2 pr-4 text-slate-500">
                  {getExpenseCountryScopeLabel(getExpenseCountryScope(item, settings), settings)}
                </td>
                <td className="py-2 text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="secondary" type="button" onClick={() => onEdit(item.id)}>
                      Изменить
                    </Button>
                    <Button
                      variant="danger"
                      type="button"
                      onClick={() => onRemove(item.id)}
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
  )
}

export function OneTimePanel() {
  const oneTimeExpenses = useBudgetStore((s) => s.oneTimeExpenses)
  const addOneTimeExpense = useBudgetStore((s) => s.addOneTimeExpense)
  const updateOneTimeExpense = useBudgetStore((s) => s.updateOneTimeExpense)
  const removeOneTimeExpense = useBudgetStore((s) => s.removeOneTimeExpense)
  const [editingId, setEditingId] = useState<string | null>(null)

  const editingItem = editingId ? oneTimeExpenses.find((e) => e.id === editingId) : undefined

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-4 text-lg font-semibold">
          {editingId ? 'Редактировать трату' : 'Добавить разовую трату'}
        </h2>
        <OneTimeForm
          key={editingId ?? 'new'}
          initialItem={editingItem}
          onSubmit={(data) => {
            if (editingId) {
              updateOneTimeExpense(editingId, data)
              setEditingId(null)
            } else {
              addOneTimeExpense(data)
            }
          }}
          onCancel={editingId ? () => setEditingId(null) : undefined}
        />
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Разовые траты</h2>
        <OneTimeList
          editingId={editingId}
          onEdit={setEditingId}
          onRemove={(id) => {
            removeOneTimeExpense(id)
            if (editingId === id) setEditingId(null)
          }}
        />
      </Card>
    </div>
  )
}
