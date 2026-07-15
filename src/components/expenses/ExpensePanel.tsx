import { useMemo, useState, type FormEvent } from 'react'
import { todayIsoDate, formatCurrency } from '../../lib/format'
import { convertCurrency } from '../../lib/currency'
import {
  buildLoanExpense,
  isLoanExpense,
  loanMonthlyPayment,
} from '../../lib/loanAmortization'
import { useExchangeRateStore } from '../../store/exchangeRateStore'
import { expenseFormSchema, type ExpenseFormData } from '../../lib/validation'
import { useBudgetStore } from '../../store/budgetStore'
import {
  FREQUENCY_LABELS,
  LOAN_EXPENSE_CATEGORY,
  type BudgetSettings,
  type RecurringItem,
} from '../../types/budget'
import {
  FOOD_EXPENSE_CATEGORY,
  getCountryLocalCurrency,
  getTypicalFoodBudget,
} from '../../config/foodBudget'
import { COUNTRY_LABELS } from '../../tax/registry'
import {
  getExpenseCountryScope,
  getExpenseCountryScopeLabel,
  getExpenseCountryScopeOptions,
} from '../../lib/expenseCountry'
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
  'Переезд',
  'Депозит',
  'Мебель',
  'Авто',
  'Ремонт',
  'Обучение',
  'Другое',
]

function formatRateInput(rate: number): string {
  return String(rate)
}

function parseRateInput(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (normalized === '' || normalized === '.') return 0
  const num = Number(normalized)
  return Number.isFinite(num) ? num : null
}

function loanAnnualRateFromItem(item: RecurringItem): string {
  return formatRateInput(item.annualRate ?? 0)
}

function currentScope(form: ExpenseFormData): ExpenseFormData['expenseCountryScope'] {
  return form.expenseCountryScope
}

function expenseToFormData(item: RecurringItem, settings: BudgetSettings): ExpenseFormData {
  const expenseCountryScope = getExpenseCountryScope(item, settings)
  const folderId = item.folderId ?? ''
  if (isLoanExpense(item)) {
    return {
      kind: 'loan',
      name: item.name,
      principal: item.principal ?? item.amount,
      currency: item.currency,
      termMonths: item.termMonths ?? 1,
      annualRate: item.annualRate ?? 0,
      folderId,
      expenseCountryScope,
      startDate: item.startDate,
    }
  }
  if (item.frequency === 'once') {
    return {
      kind: 'once',
      name: item.name,
      amount: item.amount,
      currency: item.currency,
      category: item.category ?? '',
      folderId,
      expenseCountryScope,
      startDate: item.startDate,
    }
  }
  return {
    kind: 'regular',
    name: item.name,
    amount: item.amount,
    currency: item.currency,
    frequency: item.frequency,
    category: item.category ?? '',
    folderId,
    expenseCountryScope,
    startDate: item.startDate,
    endDate: item.endDate ?? '',
  }
}

function formDataToExpense(data: ExpenseFormData): Omit<RecurringItem, 'id'> {
  const folderId = data.folderId || undefined
  if (data.kind === 'loan') {
    return buildLoanExpense({ ...data, folderId })
  }
  if (data.kind === 'once') {
    return {
      expenseKind: 'regular',
      name: data.name,
      amount: data.amount,
      currency: data.currency,
      frequency: 'once',
      category: data.category || undefined,
      lifecycle: 'any',
      folderId,
      expenseCountryScope: data.expenseCountryScope,
      startDate: data.startDate,
    }
  }
  return {
    expenseKind: 'regular',
    name: data.name,
    amount: data.amount,
    currency: data.currency,
    frequency: data.frequency,
    category: data.category || undefined,
    lifecycle: 'destination',
    folderId,
    expenseCountryScope: data.expenseCountryScope,
    startDate: data.startDate,
    endDate: data.endDate || undefined,
  }
}

function blankRegularForm(baseCurrency: string): Extract<ExpenseFormData, { kind: 'regular' }> {
  return {
    kind: 'regular',
    name: '',
    amount: 0,
    currency: baseCurrency,
    frequency: 'monthly',
    category: '',
    folderId: '',
    expenseCountryScope: 'residence',
    startDate: todayIsoDate(),
    endDate: '',
  }
}

function FolderField({
  value,
  onChange,
}: {
  value: string | undefined
  onChange: (folderId: string) => void
}) {
  const folders = useBudgetStore((s) => s.folders)

  return (
    <Field label="Папка">
      <Select value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">Без папки</option>
        {folders.map((folder) => (
          <option key={folder.id} value={folder.id}>
            {folder.name}
          </option>
        ))}
      </Select>
    </Field>
  )
}

function ExpenseCountryField({
  value,
  onChange,
  error,
}: {
  value: ExpenseFormData['expenseCountryScope']
  onChange: (scope: ExpenseFormData['expenseCountryScope']) => void
  error?: string
}) {
  const settings = useBudgetStore((s) => s.settings)
  const options = getExpenseCountryScopeOptions(settings)

  return (
    <Field label="Страна расхода" error={error}>
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value as ExpenseFormData['expenseCountryScope'])}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      <p className="mt-1 text-xs text-slate-500">
        Для remittance в Таиланде учитываются только расходы в стране проживания.
      </p>
    </Field>
  )
}

function AmountCell({
  item,
  baseCurrency,
}: {
  item: RecurringItem
  baseCurrency: string
}) {
  useExchangeRateStore((s) => s.rateDate)
  const amount = isLoanExpense(item) ? loanMonthlyPayment(item) : item.amount
  const converted = convertCurrency(amount, item.currency, baseCurrency)
  const showConversion = item.currency !== baseCurrency

  return (
    <td className="py-2 pr-4">
      <div>{formatCurrency(amount, item.currency)}</div>
      {isLoanExpense(item) && (
        <div className="text-xs text-slate-500">
          кредит {formatCurrency(item.principal ?? item.amount, item.currency)}
        </div>
      )}
      {showConversion && (
        <div className="text-xs text-slate-500">≈ {formatCurrency(converted, baseCurrency)}</div>
      )}
    </td>
  )
}

interface ExpenseFormProps {
  initialItem?: RecurringItem
  onSubmit: (data: ExpenseFormData) => void
  onCancel?: () => void
}

function ExpenseForm({ initialItem, onSubmit, onCancel }: ExpenseFormProps) {
  const settings = useBudgetStore((s) => s.settings)
  const [form, setForm] = useState<ExpenseFormData>(() =>
    initialItem ? expenseToFormData(initialItem, settings) : blankRegularForm(settings.baseCurrency),
  )
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [annualRateInput, setAnnualRateInput] = useState(() =>
    initialItem && isLoanExpense(initialItem) ? loanAnnualRateFromItem(initialItem) : '0',
  )
  const isEditing = Boolean(initialItem)

  const loanPreviewPayment = useMemo(() => {
    if (form.kind !== 'loan' || form.principal <= 0 || form.termMonths <= 0) return null
    const annualRate = parseRateInput(annualRateInput)
    if (annualRate === null) return null
    return loanMonthlyPayment({
      id: '',
      name: '',
      expenseKind: 'loan',
      principal: form.principal,
      currency: form.currency,
      termMonths: form.termMonths,
      annualRate,
      amount: form.principal,
      frequency: 'monthly',
      startDate: form.startDate,
    })
  }, [form, annualRateInput])

  function handleCategoryChange(category: string) {
    if (form.kind !== 'regular' && form.kind !== 'once') return
    if (form.kind === 'regular' && category === FOOD_EXPENSE_CATEGORY) {
      const amount = getTypicalFoodBudget(settings.countryCode, settings.familySize)
      const currency = getCountryLocalCurrency(settings.countryCode)
      setForm({
        ...form,
        category,
        amount,
        currency,
        frequency: 'monthly',
        name: form.name.trim() ? form.name : FOOD_EXPENSE_CATEGORY,
      })
      return
    }
    setForm({ ...form, category })
  }

  const foodBudgetHint =
    form.kind === 'regular' && form.category === FOOD_EXPENSE_CATEGORY
      ? `Типовой бюджет на ${settings.familySize} чел. в ${COUNTRY_LABELS[settings.countryCode] ?? settings.countryCode}`
      : null

  function switchKind(kind: ExpenseFormData['kind']) {
    const scope = currentScope(form)
    const name = form.name
    const folderId = form.folderId ?? ''
    setAnnualRateInput('0')
    if (kind === 'loan') {
      setForm({
        kind: 'loan',
        name,
        principal: 0,
        currency: settings.baseCurrency,
        termMonths: 12,
        annualRate: 0,
        folderId,
        expenseCountryScope: scope,
        startDate: todayIsoDate(),
      })
    } else if (kind === 'once') {
      setForm({
        kind: 'once',
        name,
        amount: 0,
        currency: settings.baseCurrency,
        category: '',
        folderId,
        expenseCountryScope: scope,
        startDate: todayIsoDate(),
      })
    } else {
      setForm({
        ...blankRegularForm(settings.baseCurrency),
        name,
        folderId,
        expenseCountryScope: scope,
      })
    }
    setErrors({})
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()

    let payload: ExpenseFormData = form
    if (form.kind === 'loan') {
      const annualRate = parseRateInput(annualRateInput)
      if (annualRate === null) {
        setErrors({ annualRate: 'Укажите число, например 5.25' })
        return
      }
      payload = { ...form, annualRate }
    }

    const result = expenseFormSchema.safeParse(payload)
    if (!result.success) {
      const next: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const key = issue.path.join('.')
        if (key) next[key] = issue.message
      }
      setErrors(next)
      return
    }
    setErrors({})
    onSubmit(result.data)
    if (!isEditing) {
      setForm(blankRegularForm(settings.baseCurrency))
      setAnnualRateInput('0')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 md:grid-cols-2">
      <Field label="Вид расхода" className="md:col-span-2">
        <Select value={form.kind} onChange={(e) => switchKind(e.target.value as ExpenseFormData['kind'])}>
          <option value="regular">Обычный</option>
          <option value="once">Разовый</option>
          <option value="loan">Кредит</option>
        </Select>
      </Field>

      <Field label="Название" error={errors.name}>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </Field>

      {form.kind === 'regular' && (
        <>
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
            {foodBudgetHint && <p className="mt-1 text-xs text-slate-500">{foodBudgetHint}</p>}
          </Field>
          <Field label="Периодичность">
            <Select
              value={form.frequency}
              onChange={(e) =>
                setForm({
                  ...form,
                  frequency: e.target.value as Extract<ExpenseFormData, { kind: 'regular' }>['frequency'],
                })
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
            <DateInput
              value={form.endDate ?? ''}
              onChange={(endDate) => setForm({ ...form, endDate })}
            />
          </Field>
          <FolderField
            value={form.folderId}
            onChange={(folderId) => setForm({ ...form, folderId })}
          />
          <ExpenseCountryField
            value={form.expenseCountryScope}
            onChange={(expenseCountryScope) => setForm({ ...form, expenseCountryScope })}
            error={errors.expenseCountryScope}
          />
        </>
      )}

      {form.kind === 'once' && (
        <>
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
          <Field label="Дата" error={errors.startDate}>
            <DateInput
              value={form.startDate}
              onChange={(startDate) => setForm({ ...form, startDate })}
            />
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
          <FolderField
            value={form.folderId}
            onChange={(folderId) => setForm({ ...form, folderId })}
          />
          <ExpenseCountryField
            value={form.expenseCountryScope}
            onChange={(expenseCountryScope) => setForm({ ...form, expenseCountryScope })}
            error={errors.expenseCountryScope}
          />
        </>
      )}

      {form.kind === 'loan' && (
        <>
          <Field label="Сумма кредита" error={errors.principal}>
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
                value={form.principal || ''}
                onChange={(e) => setForm({ ...form, principal: Number(e.target.value) })}
              />
            </div>
            <CurrencyConversionHint
              amount={form.principal}
              currency={form.currency}
              baseCurrency={settings.baseCurrency}
            />
          </Field>
          <Field label="Срок, месяцев" error={errors.termMonths}>
            <Input
              type="number"
              min={1}
              step={1}
              value={form.termMonths || ''}
              onChange={(e) => setForm({ ...form, termMonths: Number(e.target.value) })}
            />
          </Field>
          <Field label="Ставка, % годовых" error={errors.annualRate}>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0"
              value={annualRateInput}
              onChange={(e) => {
                const raw = e.target.value
                if (raw !== '' && !/^\d*[,.]?\d*$/.test(raw)) return
                setAnnualRateInput(raw)
                const parsed = parseRateInput(raw)
                if (parsed !== null && form.kind === 'loan') {
                  setForm({ ...form, annualRate: parsed })
                }
              }}
            />
          </Field>
          <Field label="Дата выдачи и первого платежа" error={errors.startDate}>
            <DateInput
              value={form.startDate}
              onChange={(startDate) => setForm({ ...form, startDate })}
            />
            <p className="mt-1 text-xs text-slate-500">
              В этот день номинал кредита поступает в бюджет и списывается первый платёж.
            </p>
          </Field>
          {loanPreviewPayment !== null && (
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 md:col-span-2">
              Ежемесячный платёж:{' '}
              <span className="font-medium text-slate-800">
                {formatCurrency(loanPreviewPayment, form.currency)}
              </span>
              {form.currency !== settings.baseCurrency && (
                <span className="ml-2 text-slate-500">
                  ≈{' '}
                  {formatCurrency(
                    convertCurrency(loanPreviewPayment, form.currency, settings.baseCurrency),
                    settings.baseCurrency,
                  )}
                </span>
              )}
            </div>
          )}
          <FolderField
            value={form.folderId}
            onChange={(folderId) => setForm({ ...form, folderId })}
          />
          <ExpenseCountryField
            value={form.expenseCountryScope}
            onChange={(expenseCountryScope) => setForm({ ...form, expenseCountryScope })}
            error={errors.expenseCountryScope}
          />
        </>
      )}

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

function FoldersManager() {
  const folders = useBudgetStore((s) => s.folders)
  const addFolder = useBudgetStore((s) => s.addFolder)
  const updateFolder = useBudgetStore((s) => s.updateFolder)
  const removeFolder = useBudgetStore((s) => s.removeFolder)
  const [newName, setNewName] = useState('')

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Input
          className="min-w-[12rem] flex-1"
          placeholder="Название папки"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => {
            if (!newName.trim()) return
            addFolder(newName)
            setNewName('')
          }}
        >
          Создать папку
        </Button>
      </div>
      {folders.length > 0 && (
        <ul className="space-y-2">
          {folders.map((folder) => (
            <li key={folder.id} className="flex flex-wrap items-center gap-2">
              <Input
                className="min-w-[12rem] flex-1"
                value={folder.name}
                onChange={(e) => updateFolder(folder.id, { name: e.target.value })}
              />
              <Button type="button" variant="danger" onClick={() => removeFolder(folder.id)}>
                Удалить
              </Button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-slate-500">
        Удаление папки не удаляет расходы — они переходят в «Без папки».
      </p>
    </div>
  )
}

function ExpenseRows({
  items,
  editingId,
  onEdit,
  onRemove,
  baseCurrency,
  settings,
}: {
  items: RecurringItem[]
  editingId: string | null
  onEdit: (id: string) => void
  onRemove: (id: string) => void
  baseCurrency: string
  settings: BudgetSettings
}) {
  return (
    <>
      {items.map((item) => (
        <tr
          key={item.id}
          className={`border-b border-slate-100 ${editingId === item.id ? 'bg-blue-50' : ''}`}
        >
          <td className="py-2 pr-4 font-medium">{item.name}</td>
          <AmountCell item={item} baseCurrency={baseCurrency} />
          <td className="py-2 pr-4">
            {isLoanExpense(item)
              ? `${item.termMonths} мес. (кредит)`
              : FREQUENCY_LABELS[item.frequency]}
          </td>
          <td className="py-2 pr-4 text-slate-500">
            {isLoanExpense(item) ? LOAN_EXPENSE_CATEGORY : (item.category ?? '—')}
          </td>
          <td className="py-2 pr-4 text-slate-500">
            {getExpenseCountryScopeLabel(getExpenseCountryScope(item, settings), settings)}
          </td>
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
    </>
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
  const folders = useBudgetStore((s) => s.folders)
  const settings = useBudgetStore((s) => s.settings)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const grouped = useMemo(() => {
    const sortedFolders = [...folders].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name),
    )
    const folderIds = new Set(sortedFolders.map((f) => f.id))
    const ungrouped = expenses.filter((item) => !item.folderId || !folderIds.has(item.folderId))
    const groups = sortedFolders.map((folder) => ({
      id: folder.id,
      name: folder.name,
      items: expenses.filter((item) => item.folderId === folder.id),
    }))
    return { groups, ungrouped }
  }, [expenses, folders])

  if (expenses.length === 0) {
    return (
      <EmptyState
        title="Нет расходов"
        description="Добавьте аренду, еду, разовые траты, кредиты и другие расходы."
      />
    )
  }

  function toggleGroup(id: string) {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const tableHead = (
    <tr className="border-b border-slate-200 text-left text-slate-500">
      <th className="py-2 pr-4">Название</th>
      <th className="py-2 pr-4">Сумма</th>
      <th className="py-2 pr-4">Периодичность</th>
      <th className="py-2 pr-4">Категория</th>
      <th className="py-2 pr-4">Страна</th>
      <th className="py-2" />
    </tr>
  )

  return (
    <div className="space-y-4">
      {grouped.groups.map((group) => (
        <div key={group.id} className="rounded-lg border border-slate-200">
          <button
            type="button"
            className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={() => toggleGroup(group.id)}
          >
            <span>
              {group.name}{' '}
              <span className="font-normal text-slate-400">({group.items.length})</span>
            </span>
            <span className="text-slate-400">{collapsed[group.id] ? '▸' : '▾'}</span>
          </button>
          {!collapsed[group.id] && (
            <div className="overflow-x-auto border-t border-slate-100 px-3 pb-2">
              {group.items.length === 0 ? (
                <p className="py-3 text-sm text-slate-500">В папке пока нет расходов.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>{tableHead}</thead>
                  <tbody>
                    <ExpenseRows
                      items={group.items}
                      editingId={editingId}
                      onEdit={onEdit}
                      onRemove={onRemove}
                      baseCurrency={settings.baseCurrency}
                      settings={settings}
                    />
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      ))}

      <div className="rounded-lg border border-slate-200">
        <button
          type="button"
          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
          onClick={() => toggleGroup('__none')}
        >
          <span>
            Без папки{' '}
            <span className="font-normal text-slate-400">({grouped.ungrouped.length})</span>
          </span>
          <span className="text-slate-400">{collapsed.__none ? '▸' : '▾'}</span>
        </button>
        {!collapsed.__none && (
          <div className="overflow-x-auto border-t border-slate-100 px-3 pb-2">
            {grouped.ungrouped.length === 0 ? (
              <p className="py-3 text-sm text-slate-500">Нет расходов вне папок.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>{tableHead}</thead>
                <tbody>
                  <ExpenseRows
                    items={grouped.ungrouped}
                    editingId={editingId}
                    onEdit={onEdit}
                    onRemove={onRemove}
                    baseCurrency={settings.baseCurrency}
                    settings={settings}
                  />
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
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
        <h2 className="mb-4 text-lg font-semibold">Папки расходов</h2>
        <FoldersManager />
      </Card>
      <Card>
        <h2 className="mb-4 text-lg font-semibold">
          {editingId ? 'Редактировать расход' : 'Добавить расход'}
        </h2>
        <ExpenseForm
          key={editingId ?? 'new'}
          initialItem={editingItem}
          onSubmit={(data) => {
            const expense = formDataToExpense(data)
            if (editingId) {
              updateExpense(editingId, expense)
              setEditingId(null)
            } else {
              addExpense(expense)
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
