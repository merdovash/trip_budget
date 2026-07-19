import { useMemo, useState, type FormEvent } from 'react'
import { todayIsoDate, formatCurrency, formatDateDisplay } from '../../lib/format'
import { convertCurrency } from '../../lib/currency'
import {
  buildLoanExpense,
  isLoanExpense,
  loanMonthlyPayment,
} from '../../lib/loanAmortization'
import { datesFromRoutePoint } from '../../lib/expenseRouteBinding'
import { useExchangeRateStore } from '../../store/exchangeRateStore'
import { expenseFormSchema, type ExpenseFormData } from '../../lib/validation'
import { useBudgetStore } from '../../store/budgetStore'
import { usePersistedRecord } from '../../lib/uiPreferences'
import {
  FREQUENCY_LABELS,
  LOAN_EXPENSE_CATEGORY,
  type BudgetSettings,
  type RecurringItem,
  type ResidenceRoutePoint,
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
import { getResidenceRoute } from '../../config/residenceRoute'
import { Button, Card, EmptyState, Field, Input, Select, DateInput } from '../ui/FormControls'
import { CurrencySelect } from '../ui/CurrencySelect'
import { CurrencyConversionHint } from '../ui/CurrencyConversionHint'
import { StackPanel } from '../ui/StackPanel'
import { FolderField } from '../ui/FolderField'
import { CategoryField, type CategoryOption } from '../ui/CategoryField'
import { SwipeRow } from '../ui/SwipeRow'
import { BUILTIN_EXPENSE_CATEGORIES } from '../../config/expenseCategories'

function ExpenseFolderField({
  value,
  onChange,
}: {
  value: string | undefined
  onChange: (folderId: string) => void
}) {
  const folders = useBudgetStore((s) => s.folders)
  const addFolder = useBudgetStore((s) => s.addFolder)
  const removeFolder = useBudgetStore((s) => s.removeFolder)
  return (
    <FolderField
      value={value}
      onChange={onChange}
      folders={folders}
      onAddFolder={addFolder}
      onRemoveFolder={removeFolder}
      deleteHint="Удаление папки не удаляет расходы — они переходят в «Без папки»."
    />
  )
}

const EXPENSE_CATEGORIES = [...BUILTIN_EXPENSE_CATEGORIES]

function ExpenseCategoryField({
  value,
  onChange,
}: {
  value: string
  onChange: (category: string) => void
}) {
  const expenseCategories = useBudgetStore((s) => s.expenseCategories)
  const addExpenseCategory = useBudgetStore((s) => s.addExpenseCategory)
  const removeExpenseCategory = useBudgetStore((s) => s.removeExpenseCategory)

  const options: CategoryOption[] = [
    ...EXPENSE_CATEGORIES.map((name) => ({ id: `builtin:${name}`, name, builtin: true })),
    ...[...expenseCategories]
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
      .map((category) => ({ id: category.id, name: category.name })),
  ]

  return (
    <CategoryField
      value={value}
      onChange={onChange}
      options={options}
      onAddCategory={addExpenseCategory}
      onRemoveCategory={removeExpenseCategory}
    />
  )
}

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

function formatRoutePointOption(point: ResidenceRoutePoint): string {
  const country = COUNTRY_LABELS[point.countryCode] ?? point.countryCode
  const start = formatDateDisplay(point.startDate)
  const end = point.endDate === '9999-12-31' ? '…' : formatDateDisplay(point.endDate)
  return `${country} · ${start}–${end}`
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
    routePointId: item.routePointId ?? '',
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
  const routePointId = data.routePointId?.trim() || undefined
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
    routePointId,
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
    routePointId: '',
    startDate: todayIsoDate(),
    endDate: '',
  }
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
  compact = false,
}: {
  item: RecurringItem
  baseCurrency: string
  compact?: boolean
}) {
  useExchangeRateStore((s) => s.rateDate)
  const amount = isLoanExpense(item) ? loanMonthlyPayment(item) : item.amount
  const converted = convertCurrency(amount, item.currency, baseCurrency)
  const showConversion = item.currency !== baseCurrency

  if (compact) {
    return (
      <div className="text-right">
        <div className="font-medium text-slate-900">{formatCurrency(amount, item.currency)}</div>
        {showConversion && (
          <div className="text-[11px] text-slate-400">≈ {formatCurrency(converted, baseCurrency)}</div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div>{formatCurrency(amount, item.currency)}</div>
      {isLoanExpense(item) && (
        <div className="text-xs text-slate-500">
          кредит {formatCurrency(item.principal ?? item.amount, item.currency)}
        </div>
      )}
      {showConversion && (
        <div className="text-xs text-slate-500">≈ {formatCurrency(converted, baseCurrency)}</div>
      )}
    </div>
  )
}

function expenseFrequencyLabel(item: RecurringItem) {
  if (isLoanExpense(item)) return `${item.termMonths} мес. (кредит)`
  if (item.frequency === 'once') {
    return item.startDate
      ? `Разово · ${formatDateDisplay(item.startDate)}`
      : FREQUENCY_LABELS.once
  }
  const base = FREQUENCY_LABELS[item.frequency]
  return item.routePointId ? `${base} · маршрут` : base
}

function expenseCategoryLabel(item: RecurringItem) {
  return isLoanExpense(item) ? LOAN_EXPENSE_CATEGORY : (item.category ?? '—')
}

function ExpenseMobileRows({
  items,
  editingId,
  onEdit,
  onRemove,
  baseCurrency,
}: {
  items: RecurringItem[]
  editingId: string | null
  onEdit: (id: string) => void
  onRemove: (id: string) => void
  baseCurrency: string
}) {
  return (
    <div className="divide-y divide-slate-100">
      {items.map((item) => (
        <SwipeRow
          key={item.id}
          active={editingId === item.id}
          onOpen={() => onEdit(item.id)}
          onEdit={() => onEdit(item.id)}
          onRemove={() => onRemove(item.id)}
        >
          <div className="flex items-start gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-slate-900">{item.name}</div>
              <div className="mt-0.5 truncate text-xs text-slate-500">
                {expenseCategoryLabel(item)} · {expenseFrequencyLabel(item)}
              </div>
            </div>
            <AmountCell item={item} baseCurrency={baseCurrency} compact />
          </div>
        </SwipeRow>
      ))}
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
          className={`cursor-pointer border-b border-slate-100 hover:bg-slate-50 ${editingId === item.id ? 'bg-blue-50' : ''}`}
          onClick={() => onEdit(item.id)}
        >
          <td className="py-2 pr-4 font-medium">{item.name}</td>
          <td className="py-2 pr-4">
            <AmountCell item={item} baseCurrency={baseCurrency} />
          </td>
          <td className="py-2 pr-4">{expenseFrequencyLabel(item)}</td>
          <td className="py-2 pr-4 text-slate-500">{expenseCategoryLabel(item)}</td>
          <td className="py-2 pr-4 text-slate-500">
            {getExpenseCountryScopeLabel(getExpenseCountryScope(item, settings), settings)}
          </td>
          <td className="py-2 text-right">
            <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
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

interface ExpenseFormProps {
  initialItem?: RecurringItem
  onSubmit: (data: ExpenseFormData) => void
  formId?: string
}

function ExpenseForm({ initialItem, onSubmit, formId = 'expense-form' }: ExpenseFormProps) {
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

  const route = getResidenceRoute(settings)
  const boundPoint =
    form.kind === 'regular' && form.routePointId
      ? route.find((point) => point.id === form.routePointId)
      : undefined

  function bindRoutePoint(routePointId: string) {
    if (form.kind !== 'regular') return
    if (!routePointId) {
      setForm({ ...form, routePointId: '' })
      return
    }
    const point = route.find((p) => p.id === routePointId)
    if (!point) return
    const dates = datesFromRoutePoint(point)
    setForm({
      ...form,
      routePointId,
      startDate: dates.startDate,
      endDate: dates.endDate ?? '',
    })
  }

  function switchKind(kind: ExpenseFormData['kind']) {
    const scope = currentScope(form)
    const name = form.name
    const folderId = form.folderId ?? ''
    const amount = form.kind === 'loan' ? 0 : form.amount
    const currency = form.kind === 'loan' ? settings.baseCurrency : form.currency
    const category = form.kind === 'loan' ? '' : (form.category ?? '')
    setAnnualRateInput('0')
    if (kind === 'loan') {
      setForm({
        kind: 'loan',
        name,
        principal: form.kind === 'loan' ? form.principal : amount || 0,
        currency,
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
        amount,
        currency,
        category,
        folderId,
        expenseCountryScope: scope,
        startDate: todayIsoDate(),
      })
    } else {
      setForm({
        ...blankRegularForm(settings.baseCurrency),
        name,
        amount,
        currency,
        category,
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
    <form id={formId} onSubmit={handleSubmit} className="grid min-w-0 gap-3 [&>*]:min-w-0 md:grid-cols-2">
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
          <ExpenseCategoryField
            value={form.category ?? ''}
            onChange={(category) => handleCategoryChange(category)}
          />
          <Field label="Привязка к маршруту" className="md:col-span-2">
            <Select
              value={form.routePointId ?? ''}
              onChange={(e) => bindRoutePoint(e.target.value)}
            >
              <option value="">Нет — даты вручную</option>
              {route.map((point) => (
                <option key={point.id} value={point.id}>
                  {formatRoutePointOption(point)}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-slate-500">
              При привязке даты берутся с пункта маршрута и обновляются при его изменении.
            </p>
          </Field>
          {boundPoint ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600 md:col-span-2">
              <p className="font-medium text-slate-800">Даты из маршрута</p>
              <p className="mt-1">
                {formatDateDisplay(boundPoint.startDate)}
                {' — '}
                {boundPoint.endDate === '9999-12-31'
                  ? 'без ограничения'
                  : formatDateDisplay(boundPoint.endDate)}
              </p>
            </div>
          ) : (
            <>
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
            </>
          )}
          <ExpenseFolderField
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
          <ExpenseCategoryField
            value={form.category ?? ''}
            onChange={(category) => handleCategoryChange(category)}
          />
          <ExpenseFolderField
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
          <ExpenseFolderField
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
  const folders = useBudgetStore((s) => s.folders)
  const updateFolder = useBudgetStore((s) => s.updateFolder)
  const settings = useBudgetStore((s) => s.settings)
  const [collapsed, setCollapsed] = usePersistedRecord('expense-folder-collapsed')

  const grouped = useMemo(() => {
    const sortedFolders = [...folders].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name),
    )
    const folderIds = new Set(sortedFolders.map((f) => f.id))
    const ungrouped = expenses.filter((item) => !item.folderId || !folderIds.has(item.folderId))
    const groups = sortedFolders
      .map((folder) => ({
        id: folder.id,
        name: folder.name,
        excluded: Boolean(folder.excluded),
        items: expenses.filter((item) => item.folderId === folder.id),
      }))
      .filter((group) => group.items.length > 0)
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
        <div
          key={group.id}
          className={`rounded-lg border border-slate-200 ${group.excluded ? 'opacity-60' : ''}`}
        >
          <div className="flex w-full items-center gap-2 px-3 py-2">
            <label
              className="flex shrink-0 items-center gap-1.5 text-xs text-slate-500"
              title={
                group.excluded
                  ? 'Папка исключена из расчётов — включить'
                  : 'Учитывать папку в расчётах'
              }
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                checked={!group.excluded}
                onChange={(e) => updateFolder(group.id, { excluded: !e.target.checked })}
              />
              <span className="sr-only">Учитывать в расчётах</span>
            </label>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center justify-between text-left text-sm font-semibold text-slate-700 hover:text-slate-900"
              onClick={() => toggleGroup(group.id)}
            >
              <span className="min-w-0 truncate">
                {group.name}{' '}
                <span className="font-normal text-slate-400">({group.items.length})</span>
                {group.excluded && (
                  <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-normal text-amber-700">
                    вне расчёта
                  </span>
                )}
              </span>
              <span className="ml-2 shrink-0 text-slate-400">
                {collapsed[group.id] ? '▸' : '▾'}
              </span>
            </button>
          </div>
          {!collapsed[group.id] && (
            <>
              <div className="border-t border-slate-100 md:hidden">
                <ExpenseMobileRows
                  items={group.items}
                  editingId={editingId}
                  onEdit={onEdit}
                  onRemove={onRemove}
                  baseCurrency={settings.baseCurrency}
                />
              </div>
              <div className="hidden overflow-x-auto border-t border-slate-100 px-3 pb-2 md:block">
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
              </div>
            </>
          )}
        </div>
      ))}

      {grouped.ungrouped.length > 0 && (
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
          <>
            <div className="border-t border-slate-100 md:hidden">
              <ExpenseMobileRows
                items={grouped.ungrouped}
                editingId={editingId}
                onEdit={onEdit}
                onRemove={onRemove}
                baseCurrency={settings.baseCurrency}
              />
            </div>
            <div className="hidden overflow-x-auto border-t border-slate-100 px-3 pb-2 md:block">
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
            </div>
          </>
        )}
      </div>
      )}
    </div>
  )
}

export function ExpensePanel() {
  const expenses = useBudgetStore((s) => s.expenses)
  const addExpense = useBudgetStore((s) => s.addExpense)
  const updateExpense = useBudgetStore((s) => s.updateExpense)
  const removeExpense = useBudgetStore((s) => s.removeExpense)
  const [panelMode, setPanelMode] = useState<'closed' | 'create' | 'edit'>('closed')
  const [editingId, setEditingId] = useState<string | null>(null)

  const editingItem =
    panelMode === 'edit' && editingId
      ? expenses.find((e) => e.id === editingId)
      : undefined

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

  return (
    <div className="space-y-4">
      <div className="sticky -top-4 z-10 -mx-4 -mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 md:-top-6 md:-mx-6 md:-mt-6 md:px-6">
        <h2 className="text-lg font-semibold text-slate-900">Расходы</h2>
        <Button type="button" onClick={openCreate}>
          Добавить расход
        </Button>
      </div>
      <Card>
        <ExpenseList
          editingId={editingId}
          onEdit={openEdit}
          onRemove={(id) => {
            removeExpense(id)
            if (editingId === id) closePanel()
          }}
        />
      </Card>

      <StackPanel
        open={panelMode !== 'closed'}
        title={panelMode === 'edit' ? 'Карточка расхода' : 'Новый расход'}
        onClose={closePanel}
        headerActions={
          <Button type="submit" form="expense-form">
            {panelMode === 'edit' ? 'Сохранить' : 'Добавить'}
          </Button>
        }
      >
        <ExpenseForm
          key={editingId ?? 'new'}
          formId="expense-form"
          initialItem={editingItem}
          onSubmit={(data) => {
            const expense = formDataToExpense(data)
            if (panelMode === 'edit' && editingId) {
              updateExpense(editingId, expense)
            } else {
              addExpense(expense)
            }
            closePanel()
          }}
        />
      </StackPanel>
    </div>
  )
}
