import { useState, type FormEvent } from 'react'
import { formatCurrency, formatDayOfMonth, isValidIsoDate } from '../../lib/format'
import { convertCurrency } from '../../lib/currency'
import { useExchangeRateStore } from '../../store/exchangeRateStore'
import {
  createEmptyPaymentEntries,
  createInitialIncomeForm,
  getIncomeCategoryDef,
  incomeItemToFormState,
  INCOME_CATEGORY_DEFS,
  type IncomeFormState,
  type IncomePaymentEntry,
} from '../../config/incomeCategories'
import { useBudgetStore } from '../../store/budgetStore'
import { FREQUENCY_LABELS, type Frequency, type IncomePayment, type RecurringItem } from '../../types/budget'
import { Button, Card, EmptyState, Field, Input, Select, DateInput } from '../ui/FormControls'
import { CurrencySelect } from '../ui/CurrencySelect'
import { CurrencyConversionHint } from '../ui/CurrencyConversionHint'

interface IncomeFormProps {
  initialItem?: RecurringItem
  onSubmit: (item: Omit<RecurringItem, 'id'>) => void
  onCancel?: () => void
}

function IncomeForm({ initialItem, onSubmit, onCancel }: IncomeFormProps) {
  const settings = useBudgetStore((s) => s.settings)
  const [form, setForm] = useState<IncomeFormState>(() =>
    initialItem ? incomeItemToFormState(initialItem) : createInitialIncomeForm(settings.baseCurrency),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})

  const categoryDef = getIncomeCategoryDef(form.categoryId)
  const totalAmount = Object.values(form.payments).reduce((sum, entry) => sum + (entry.amount || 0), 0)
  const hasMultiplePayments = (categoryDef?.paymentFields.length ?? 0) > 1
  const isEditing = Boolean(initialItem)

  function handleCategoryChange(categoryId: string) {
    const def = getIncomeCategoryDef(categoryId)
    setForm({
      ...form,
      categoryId,
      name: '',
      payments: createEmptyPaymentEntries(categoryId),
      frequency: def?.defaultFrequency ?? 'monthly',
    })
    setErrors({})
  }

  function updatePayment(fieldId: string, patch: Partial<IncomePaymentEntry>) {
    setForm({
      ...form,
      payments: {
        ...form.payments,
        [fieldId]: { ...form.payments[fieldId], ...patch },
      },
    })
  }

  function validate(): Record<string, string> {
    const next: Record<string, string> = {}
    if (!form.categoryId) {
      next.categoryId = 'Выберите категорию'
      return next
    }
    if (!categoryDef) return next

    if (categoryDef.showCustomName && !form.name.trim()) {
      next.name = 'Укажите название'
    }

    for (const field of categoryDef.paymentFields) {
      const entry = form.payments[field.id]
      const value = entry?.amount ?? 0
      if (value <= 0) {
        next[`payment_${field.id}`] = 'Укажите сумму больше 0'
      }
      if (field.requireDayOfMonth) {
        const day = entry?.dayOfMonth ?? 0
        if (day < 1 || day > 31) {
          next[`day_${field.id}`] = 'Укажите день от 1 до 31'
        }
      }
    }

    if (!form.startDate) {
      next.startDate = 'Укажите дату'
    } else if (!isValidIsoDate(form.startDate)) {
      next.startDate = 'Формат: ДД.ММ.ГГГГ'
    }

    if (form.endDate && !isValidIsoDate(form.endDate)) {
      next.endDate = 'Формат: ДД.ММ.ГГГГ'
    }

    return next
  }

  function buildItem(): Omit<RecurringItem, 'id'> | null {
    if (!categoryDef) return null

    const payments: IncomePayment[] = categoryDef.paymentFields.map((field) => {
      const entry = form.payments[field.id]
      return {
        label: field.label,
        amount: entry?.amount ?? 0,
        dayOfMonth: field.requireDayOfMonth ? entry?.dayOfMonth : undefined,
      }
    })

    return {
      name: categoryDef.showCustomName ? form.name.trim() : categoryDef.label,
      amount: totalAmount,
      currency: form.currency,
      frequency: form.frequency,
      category: categoryDef.label,
      categoryId: categoryDef.id,
      payments: hasMultiplePayments ? payments : undefined,
      startDate: form.startDate,
      endDate: form.endDate || undefined,
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const validationErrors = validate()
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      return
    }
    const item = buildItem()
    if (!item) return

    setErrors({})
    onSubmit(item)
    if (!isEditing) {
      setForm(createInitialIncomeForm(settings.baseCurrency))
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Категория" error={errors.categoryId}>
        <Select value={form.categoryId} onChange={(e) => handleCategoryChange(e.target.value)}>
          <option value="">— Выберите категорию —</option>
          {INCOME_CATEGORY_DEFS.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>

      {categoryDef && (
        <>
          {categoryDef.showCustomName && (
            <Field label="Название" error={errors.name}>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
          )}

          <div className="space-y-3">
            {categoryDef.paymentFields.map((field, index) => {
              const entry = form.payments[field.id] ?? { amount: 0, dayOfMonth: 1 }
              const amountError = errors[`payment_${field.id}`]
              const dayError = errors[`day_${field.id}`]
              const combinedError = [amountError, dayError].filter(Boolean).join(' · ')

              return (
                <Field key={field.id} label={field.label} error={combinedError || undefined}>
                  <div className="flex items-center gap-2">
                    {index === 0 ? (
                      <CurrencySelect
                        value={form.currency}
                        onChange={(currency) => setForm({ ...form, currency })}
                        className="w-[5.5rem] shrink-0"
                      />
                    ) : (
                      <div className="w-[5.5rem] shrink-0" aria-hidden />
                    )}
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      placeholder="Сумма"
                      className="min-w-0 flex-1"
                      value={entry.amount || ''}
                      onChange={(e) => updatePayment(field.id, { amount: Number(e.target.value) })}
                    />
                    {field.requireDayOfMonth ? (
                      <Input
                        type="number"
                        min={1}
                        max={31}
                        placeholder="День"
                        className="w-[5.5rem] shrink-0"
                        value={entry.dayOfMonth || ''}
                        onChange={(e) =>
                          updatePayment(field.id, { dayOfMonth: Number(e.target.value) })
                        }
                      />
                    ) : null}
                  </div>
                  {field.hint && <span className="text-xs text-slate-500">{field.hint}</span>}
                  {!hasMultiplePayments && (
                    <CurrencyConversionHint
                      amount={entry.amount}
                      currency={form.currency}
                      baseCurrency={settings.baseCurrency}
                    />
                  )}
                </Field>
              )
            })}
          </div>

          {hasMultiplePayments && totalAmount > 0 && (
            <div>
              <CurrencyConversionHint
                amount={totalAmount}
                currency={form.currency}
                baseCurrency={settings.baseCurrency}
              />
              <p className="mt-1 text-sm text-slate-600">
                Итого за месяц:{' '}
                <span className="font-medium">{formatCurrency(totalAmount, form.currency)}</span>
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {categoryDef.showFrequency !== false ? (
              <Field label="Периодичность">
                <Select
                  value={form.frequency}
                  onChange={(e) => setForm({ ...form, frequency: e.target.value as Frequency })}
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
            ) : (
              <Field label="Периодичность">
                <Input value={FREQUENCY_LABELS[categoryDef.defaultFrequency]} disabled />
              </Field>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Дата начала (период)" error={errors.startDate}>
              <DateInput
                value={form.startDate}
                onChange={(startDate) => setForm({ ...form, startDate })}
              />
            </Field>

            <Field label="Дата окончания (опц.)" error={errors.endDate}>
              <DateInput
                value={form.endDate}
                onChange={(endDate) => setForm({ ...form, endDate })}
              />
            </Field>
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={!categoryDef}>
          {isEditing ? 'Сохранить' : 'Добавить доход'}
        </Button>
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Отмена
          </Button>
        )}
      </div>
    </form>
  )
}

function AmountCell({ item, baseCurrency }: { item: RecurringItem; baseCurrency: string }) {
  useExchangeRateStore((s) => s.rateDate)

  if (item.payments && item.payments.length > 1) {
    return (
      <td className="py-2 pr-4">
        {item.payments.map((payment) => {
          const converted = convertCurrency(payment.amount, item.currency, baseCurrency)
          const showConversion = item.currency !== baseCurrency
          return (
            <div key={payment.label} className="text-sm">
              <span className="text-slate-500">{payment.label}: </span>
              {formatCurrency(payment.amount, item.currency)}
              {payment.dayOfMonth && (
                <span className="text-slate-500"> · {formatDayOfMonth(payment.dayOfMonth)}</span>
              )}
              {showConversion && (
                <span className="ml-1 text-xs text-slate-400">
                  (≈ {formatCurrency(converted, baseCurrency)})
                </span>
              )}
            </div>
          )
        })}
        <div className="mt-1 border-t border-slate-100 pt-1 font-medium">
          Итого: {formatCurrency(item.amount, item.currency)}
        </div>
      </td>
    )
  }

  const converted = convertCurrency(item.amount, item.currency, baseCurrency)
  const showConversion = item.currency !== baseCurrency

  return (
    <td className="py-2 pr-4">
      <div>{formatCurrency(item.amount, item.currency)}</div>
      {showConversion && (
        <div className="text-xs text-slate-500">≈ {formatCurrency(converted, baseCurrency)}</div>
      )}
    </td>
  )
}

function IncomeList({
  editingId,
  onEdit,
  onRemove,
}: {
  editingId: string | null
  onEdit: (id: string) => void
  onRemove: (id: string) => void
}) {
  const incomes = useBudgetStore((s) => s.incomes)
  const settings = useBudgetStore((s) => s.settings)

  if (incomes.length === 0) {
    return (
      <EmptyState
        title="Нет доходов"
        description="Выберите категорию и добавьте зарплату, фриланс или другие источники дохода."
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
          {incomes.map((item) => (
            <tr
              key={item.id}
              className={`border-b border-slate-100 ${editingId === item.id ? 'bg-blue-50' : ''}`}
            >
              <td className="py-2 pr-4 font-medium">{item.name}</td>
              <AmountCell item={item} baseCurrency={settings.baseCurrency} />
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

export function IncomePanel() {
  const incomes = useBudgetStore((s) => s.incomes)
  const addIncome = useBudgetStore((s) => s.addIncome)
  const updateIncome = useBudgetStore((s) => s.updateIncome)
  const removeIncome = useBudgetStore((s) => s.removeIncome)
  const [editingId, setEditingId] = useState<string | null>(null)

  const editingItem = editingId ? incomes.find((i) => i.id === editingId) : undefined

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-4 text-lg font-semibold">
          {editingId ? 'Редактировать доход' : 'Добавить доход'}
        </h2>
        <IncomeForm
          key={editingId ?? 'new'}
          initialItem={editingItem}
          onSubmit={(data) => {
            if (editingId) {
              updateIncome(editingId, data)
              setEditingId(null)
            } else {
              addIncome(data)
            }
          }}
          onCancel={editingId ? () => setEditingId(null) : undefined}
        />
      </Card>
      <Card>
        <h2 className="mb-4 text-lg font-semibold">Список доходов</h2>
        <IncomeList
          editingId={editingId}
          onEdit={setEditingId}
          onRemove={(id) => {
            removeIncome(id)
            if (editingId === id) setEditingId(null)
          }}
        />
      </Card>
    </div>
  )
}
