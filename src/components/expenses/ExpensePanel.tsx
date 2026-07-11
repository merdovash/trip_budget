import { useState, type FormEvent } from 'react'
import { todayIsoDate, formatCurrency } from '../../lib/format'
import { convertCurrency } from '../../lib/currency'
import { useExchangeRateStore } from '../../store/exchangeRateStore'
import { recurringItemSchema, type RecurringItemFormData } from '../../lib/validation'
import { useBudgetStore } from '../../store/budgetStore'
import { FREQUENCY_LABELS, type RecurringItem } from '../../types/budget'
import {
  FOOD_EXPENSE_CATEGORY,
  getCountryLocalCurrency,
  getTypicalFoodBudget,
} from '../../config/foodBudget'
import { COUNTRY_LABELS } from '../../tax/registry'
import { Button, Card, EmptyState, Field, Input, Select, DateInput } from '../ui/FormControls'
import { CurrencySelect } from '../ui/CurrencySelect'
import { CurrencyConversionHint } from '../ui/CurrencyConversionHint'

const EXPENSE_CATEGORIES = [
  'Жильё',
  'Еда',
  'Транспорт',
  'Страховка',
  'Образование',
  'Здоровье',
  'Развлечения',
  'Связь',
  'Другое',
]

function expenseToFormData(item: RecurringItem): RecurringItemFormData {
  return {
    name: item.name,
    amount: item.amount,
    currency: item.currency,
    frequency: item.frequency,
    category: item.category ?? '',
    startDate: item.startDate,
    endDate: item.endDate ?? '',
  }
}

function AmountCell({
  amount,
  currency,
  baseCurrency,
}: {
  amount: number
  currency: string
  baseCurrency: string
}) {
  useExchangeRateStore((s) => s.rateDate)
  const converted = convertCurrency(amount, currency, baseCurrency)
  const showConversion = currency !== baseCurrency

  return (
    <td className="py-2 pr-4">
      <div>{formatCurrency(amount, currency)}</div>
      {showConversion && (
        <div className="text-xs text-slate-500">≈ {formatCurrency(converted, baseCurrency)}</div>
      )}
    </td>
  )
}

interface ExpenseFormProps {
  initialItem?: RecurringItem
  onSubmit: (data: RecurringItemFormData) => void
  onCancel?: () => void
}

function ExpenseForm({ initialItem, onSubmit, onCancel }: ExpenseFormProps) {
  const settings = useBudgetStore((s) => s.settings)
  const [form, setForm] = useState<RecurringItemFormData>(() =>
    initialItem
      ? expenseToFormData(initialItem)
      : {
          name: '',
          amount: 0,
          currency: settings.baseCurrency,
          frequency: 'monthly',
          category: '',
          startDate: todayIsoDate(),
          endDate: '',
        },
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const isEditing = Boolean(initialItem)

  function handleCategoryChange(category: string) {
    if (category === FOOD_EXPENSE_CATEGORY) {
      const amount = getTypicalFoodBudget(settings.countryCode, settings.familySize)
      const currency = getCountryLocalCurrency(settings.countryCode)
      setForm((prev) => ({
        ...prev,
        category,
        amount,
        currency,
        frequency: 'monthly',
        name: prev.name.trim() ? prev.name : FOOD_EXPENSE_CATEGORY,
      }))
      return
    }
    setForm((prev) => ({ ...prev, category }))
  }

  const foodBudgetHint =
    form.category === FOOD_EXPENSE_CATEGORY
      ? `Типовой бюджет на ${settings.familySize} чел. в ${COUNTRY_LABELS[settings.countryCode] ?? settings.countryCode}`
      : null

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const result = recurringItemSchema.safeParse(form)
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
        frequency: 'monthly',
        category: '',
        startDate: todayIsoDate(),
        endDate: '',
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
        {foodBudgetHint && (
          <p className="mt-1 text-xs text-slate-500">{foodBudgetHint}</p>
        )}
      </Field>
      <Field label="Периодичность">
        <Select
          value={form.frequency}
          onChange={(e) =>
            setForm({ ...form, frequency: e.target.value as RecurringItem['frequency'] })
          }
        >
          {Object.entries(FREQUENCY_LABELS)
            .filter(([k]) => k !== 'once')
            .map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
        </Select>
      </Field>
      <Field label="Категория">
        <Select value={form.category} onChange={(e) => handleCategoryChange(e.target.value)}>
          <option value="">—</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Дата начала" error={errors.startDate}>
        <DateInput
          value={form.startDate}
          onChange={(startDate) => setForm({ ...form, startDate })}
        />
      </Field>
      <Field label="Дата окончания (опц.)" error={errors.endDate}>
        <DateInput value={form.endDate ?? ''} onChange={(endDate) => setForm({ ...form, endDate })} />
      </Field>
      <div className="flex flex-wrap gap-2 md:col-span-2">
        <Button type="submit">{isEditing ? 'Сохранить' : 'Добавить расход'}</Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Отмена
          </Button>
        )}
      </div>
    </form>
  )
}

function ExpenseList({
  editingId,
  onEdit,
  onRemove,
}: {
  editingId: string | null
  onEdit: (id: string) => void
  onRemove: (id: string) => void
}) {
  const expenses = useBudgetStore((s) => s.expenses)
  const settings = useBudgetStore((s) => s.settings)

  if (expenses.length === 0) {
    return (
      <EmptyState
        title="Нет расходов"
        description="Добавьте аренду, еду, транспорт и другие регулярные траты."
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
            <th className="py-2 pr-4">Периодичность</th>
            <th className="py-2 pr-4">Категория</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {expenses.map((item) => (
            <tr
              key={item.id}
              className={`border-b border-slate-100 ${editingId === item.id ? 'bg-blue-50' : ''}`}
            >
              <td className="py-2 pr-4 font-medium">{item.name}</td>
              <AmountCell
                amount={item.amount}
                currency={item.currency}
                baseCurrency={settings.baseCurrency}
              />
              <td className="py-2 pr-4">{FREQUENCY_LABELS[item.frequency]}</td>
              <td className="py-2 pr-4 text-slate-500">{item.category ?? '—'}</td>
              <td className="py-2 text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" type="button" onClick={() => onEdit(item.id)}>
                    Изменить
                  </Button>
                  <Button variant="danger" type="button" onClick={() => onRemove(item.id)}>
                    Удалить
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ExpensePanel() {
  const expenses = useBudgetStore((s) => s.expenses)
  const addExpense = useBudgetStore((s) => s.addExpense)
  const updateExpense = useBudgetStore((s) => s.updateExpense)
  const removeExpense = useBudgetStore((s) => s.removeExpense)
  const [editingId, setEditingId] = useState<string | null>(null)

  const editingItem = editingId ? expenses.find((e) => e.id === editingId) : undefined

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-4 text-lg font-semibold">
          {editingId ? 'Редактировать расход' : 'Добавить расход'}
        </h2>
        <ExpenseForm
          key={editingId ?? 'new'}
          initialItem={editingItem}
          onSubmit={(data) => {
            if (editingId) {
              updateExpense(editingId, data)
              setEditingId(null)
            } else {
              addExpense(data)
            }
          }}
          onCancel={editingId ? () => setEditingId(null) : undefined}
        />
      </Card>
      <Card>
        <h2 className="mb-4 text-lg font-semibold">Список расходов</h2>
        <ExpenseList
          editingId={editingId}
          onEdit={setEditingId}
          onRemove={(id) => {
            removeExpense(id)
            if (editingId === id) setEditingId(null)
          }}
        />
      </Card>
    </div>
  )
}
