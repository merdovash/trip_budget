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
  SALARY_SOURCE_COUNTRIES,
  type IncomeFormState,
  type IncomePaymentEntry,
} from '../../config/incomeCategories'
import { calculateRussiaSalaryMonthlyDisplay } from '../../tax/countries/russia'
import { calculateSpainSalaryMonthlyDisplay } from '../../tax/countries/spain'
import { isIncludedInResidenceTax } from '../../tax/incomeSourceTax'
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
  const isRussiaSalary =
    categoryDef?.showSalaryCountry && form.salaryCountryCode === 'RU'
  const isSpainSalary =
    categoryDef?.showSalaryCountry && form.salaryCountryCode === 'ES'

  const residenceTaxHint =
    settings.countryCode === 'TH'
      ? 'Исключённые доходы не попадают в PIT Таиланда. Зарплата РФ по умолчанию — только НДФЛ в России. При «Учитывать» применяются тайские вычеты; при включённом зачёте НДФЛ — кредит по договору РФ–Таиланд.'
      : settings.countryCode === 'GE'
        ? 'Исключённые доходы не попадают в PIT Грузии. Зарплата РФ по умолчанию — только НДФЛ в России. При «Учитывать» доход входит в мировой доход резидента (20% или 1% по режиму); при зачёте НДФЛ — кредит по договору РФ–Грузия.'
        : 'Исключённые доходы не попадают в IRPF страны проживания. Зарплата РФ по умолчанию — только НДФЛ в России. При «Учитывать» применяются вычеты Испании (mínimo personal); при включённом зачёте НДФЛ — deducción por doble imposición.'

  const foreignCreditLabel =
    settings.countryCode === 'TH'
      ? 'Зачёт НДФЛ в Таиланде'
      : settings.countryCode === 'GE'
        ? 'Зачёт НДФЛ в Грузии'
        : 'Зачёт НДФЛ в Испании'

  const foreignCreditYes =
    settings.countryCode === 'TH'
      ? 'Да — НДФЛ в РФ + зачёт против PIT'
      : settings.countryCode === 'GE'
        ? 'Да — НДФЛ в РФ + зачёт против PIT'
        : 'Да — НДФЛ в РФ + зачёт против IRPF'

  const foreignCreditNo =
    settings.countryCode === 'TH' || settings.countryCode === 'GE'
      ? 'Нет — только PIT в стране проживания'
      : 'Нет — только IRPF в стране проживания'

  const salaryDisplay = isRussiaSalary
    ? calculateRussiaSalaryMonthlyDisplay(
        categoryDef?.paymentFields.map((field) => ({
          id: field.id,
          amount: form.payments[field.id]?.amount ?? 0,
          dayOfMonth: form.payments[field.id]?.dayOfMonth,
        })) ?? [],
        settings.dependents,
      )
    : null

  const spainSalaryDisplay = isSpainSalary
    ? calculateSpainSalaryMonthlyDisplay(
        categoryDef?.paymentFields.map((field) => ({
          id: field.id,
          amount: form.payments[field.id]?.amount ?? 0,
          dayOfMonth: form.payments[field.id]?.dayOfMonth,
        })) ?? [],
        settings.dependents,
      )
    : null

  function handleCategoryChange(categoryId: string) {
    const def = getIncomeCategoryDef(categoryId)
    const salaryCountryCode = def?.showSalaryCountry
      ? settings.countryCode === 'RU'
        ? 'RU'
        : 'ES'
      : form.salaryCountryCode
    setForm({
      ...form,
      categoryId,
      name: '',
      payments: createEmptyPaymentEntries(categoryId),
      frequency: def?.defaultFrequency ?? 'monthly',
      salaryCountryCode,
      includeInResidenceTax: def?.showSalaryCountry && salaryCountryCode === 'RU' ? false : true,
      foreignTaxCredit: true,
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
      lifecycle:
        categoryDef.showSalaryCountry && form.salaryCountryCode === settings.countryCode
          ? 'destination'
          : 'any',
      includeInResidenceTax: form.includeInResidenceTax,
      ...(isRussiaSalary && form.includeInResidenceTax
        ? { foreignTaxCredit: form.foreignTaxCredit }
        : {}),
      ...(categoryDef.showSalaryCountry ? { salaryCountryCode: form.salaryCountryCode } : {}),
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

      {categoryDef?.showSalaryCountry && (
        <Field label="Страна выплаты зарплаты">
          <Select
            value={form.salaryCountryCode}
            onChange={(e) => {
              const salaryCountryCode = e.target.value
              setForm({
                ...form,
                salaryCountryCode,
                includeInResidenceTax:
                  salaryCountryCode === 'RU' ? false : form.includeInResidenceTax,
                foreignTaxCredit: salaryCountryCode === 'RU' ? true : form.foreignTaxCredit,
              })
            }}
          >
            {SALARY_SOURCE_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {categoryDef && (
        <Field label="Налоги страны проживания">
          <Select
            value={form.includeInResidenceTax ? 'include' : 'exclude'}
            onChange={(e) =>
              setForm({
                ...form,
                includeInResidenceTax: e.target.value === 'include',
                foreignTaxCredit: e.target.value === 'include',
              })
            }
          >
            <option value="include">Учитывать</option>
            <option value="exclude">Не учитывать</option>
          </Select>
          <p className="text-xs text-slate-500">{residenceTaxHint}</p>
        </Field>
      )}

      {isRussiaSalary && form.includeInResidenceTax && (
        <Field label={foreignCreditLabel}>
          <Select
            value={form.foreignTaxCredit ? 'yes' : 'no'}
            onChange={(e) => setForm({ ...form, foreignTaxCredit: e.target.value === 'yes' })}
          >
            <option value="yes">{foreignCreditYes}</option>
            <option value="no">{foreignCreditNo}</option>
          </Select>
        </Field>
      )}

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
              const paymentTax = salaryDisplay?.byId[field.id]
              const spainPaymentTax = spainSalaryDisplay?.byId[field.id]

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
                      placeholder="Gross"
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
                  {paymentTax && paymentTax.gross > 0 && (
                    <SalaryPaymentTaxLines
                      gross={paymentTax.gross}
                      ndfl={paymentTax.ndfl}
                      net={paymentTax.net}
                      currency={form.currency}
                      showEmployerSocial={!hasMultiplePayments}
                      employerSocial={salaryDisplay?.employerSocialMonthly}
                    />
                  )}
                  {spainPaymentTax && spainPaymentTax.gross > 0 && (
                    <SpainPaymentTaxLines
                      gross={spainPaymentTax.gross}
                      social={spainPaymentTax.social}
                      irpf={spainPaymentTax.irpf}
                      net={spainPaymentTax.net}
                      currency={form.currency}
                      showEmployerSocial={!hasMultiplePayments}
                      employerSocial={spainSalaryDisplay?.employerSocialMonthly}
                    />
                  )}
                  {!hasMultiplePayments && !isRussiaSalary && !isSpainSalary && (
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

          {(hasMultiplePayments || isRussiaSalary || isSpainSalary) && totalAmount > 0 && (
            <div>
              {!isRussiaSalary && !isSpainSalary && (
                <CurrencyConversionHint
                  amount={totalAmount}
                  currency={form.currency}
                  baseCurrency={settings.baseCurrency}
                />
              )}
              {isRussiaSalary && salaryDisplay ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-medium text-slate-800">Итого за месяц</p>
                  <dl className="mt-2 space-y-1 text-slate-600">
                    <div className="flex justify-between gap-4">
                      <dt>Gross (до вычетов)</dt>
                      <dd className="font-medium">{formatCurrency(salaryDisplay.totalGross, form.currency)}</dd>
                    </div>
                    <div className="flex justify-between gap-4 text-red-700">
                      <dt>НДФЛ</dt>
                      <dd>−{formatCurrency(salaryDisplay.totalNdfl, form.currency)}</dd>
                    </div>
                    <div className="flex justify-between gap-4 border-t border-slate-200 pt-1 font-medium text-emerald-700">
                      <dt>На руки</dt>
                      <dd>{formatCurrency(salaryDisplay.totalNet, form.currency)}</dd>
                    </div>
                    <div className="flex justify-between gap-4 text-slate-500">
                      <dt>Соцвзносы работодателя</dt>
                      <dd>{formatCurrency(salaryDisplay.employerSocialMonthly, form.currency)}/мес.</dd>
                    </div>
                  </dl>
                  <CurrencyConversionHint
                    amount={salaryDisplay.totalNet}
                    currency={form.currency}
                    baseCurrency={settings.baseCurrency}
                  />
                </div>
              ) : isSpainSalary && spainSalaryDisplay ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
                  <p className="font-medium text-slate-800">Итого nómina за месяц</p>
                  <dl className="mt-2 space-y-1 text-slate-600">
                    <div className="flex justify-between gap-4">
                      <dt>Bruto</dt>
                      <dd className="font-medium">
                        {formatCurrency(spainSalaryDisplay.totalGross, form.currency)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-4 text-red-700">
                      <dt>Cuota obrera SS</dt>
                      <dd>−{formatCurrency(spainSalaryDisplay.totalSocial, form.currency)}</dd>
                    </div>
                    <div className="flex justify-between gap-4 text-red-700">
                      <dt>Retención IRPF</dt>
                      <dd>−{formatCurrency(spainSalaryDisplay.totalIrpf, form.currency)}</dd>
                    </div>
                    <div className="flex justify-between gap-4 border-t border-slate-200 pt-1 font-medium text-emerald-700">
                      <dt>Neto (на руки)</dt>
                      <dd>{formatCurrency(spainSalaryDisplay.totalNet, form.currency)}</dd>
                    </div>
                    <div className="flex justify-between gap-4 text-slate-500">
                      <dt>Cuota patronal SS (информ.)</dt>
                      <dd>
                        {formatCurrency(spainSalaryDisplay.employerSocialMonthly, form.currency)}/мес.
                      </dd>
                    </div>
                  </dl>
                  <CurrencyConversionHint
                    amount={spainSalaryDisplay.totalNet}
                    currency={form.currency}
                    baseCurrency={settings.baseCurrency}
                  />
                </div>
              ) : (
                <p className="mt-1 text-sm text-slate-600">
                  Итого за месяц:{' '}
                  <span className="font-medium">{formatCurrency(totalAmount, form.currency)}</span>
                </p>
              )}
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

function SalaryPaymentTaxLines({
  gross,
  ndfl,
  net,
  currency,
  showEmployerSocial,
  employerSocial,
}: {
  gross: number
  ndfl: number
  net: number
  currency: string
  showEmployerSocial?: boolean
  employerSocial?: number
}) {
  return (
    <div className="mt-1.5 space-y-0.5 text-xs">
      <div className="flex justify-between gap-2 text-slate-500">
        <span>Gross</span>
        <span>{formatCurrency(gross, currency)}</span>
      </div>
      <div className="flex justify-between gap-2 text-red-600">
        <span>НДФЛ</span>
        <span>−{formatCurrency(ndfl, currency)}</span>
      </div>
      <div className="flex justify-between gap-2 font-medium text-emerald-700">
        <span>На руки</span>
        <span>{formatCurrency(net, currency)}</span>
      </div>
      {showEmployerSocial && employerSocial !== undefined && employerSocial > 0 && (
        <div className="flex justify-between gap-2 text-slate-500">
          <span>Соцвзносы работодателя</span>
          <span>{formatCurrency(employerSocial, currency)}/мес.</span>
        </div>
      )}
    </div>
  )
}

function SpainPaymentTaxLines({
  gross,
  social,
  irpf,
  net,
  currency,
  showEmployerSocial,
  employerSocial,
}: {
  gross: number
  social: number
  irpf: number
  net: number
  currency: string
  showEmployerSocial?: boolean
  employerSocial?: number
}) {
  return (
    <div className="mt-1.5 space-y-0.5 text-xs">
      <div className="flex justify-between gap-2 text-slate-500">
        <span>Bruto</span>
        <span>{formatCurrency(gross, currency)}</span>
      </div>
      <div className="flex justify-between gap-2 text-red-600">
        <span>Cuota obrera SS</span>
        <span>−{formatCurrency(social, currency)}</span>
      </div>
      <div className="flex justify-between gap-2 text-red-600">
        <span>Retención IRPF</span>
        <span>−{formatCurrency(irpf, currency)}</span>
      </div>
      <div className="flex justify-between gap-2 font-medium text-emerald-700">
        <span>Neto</span>
        <span>{formatCurrency(net, currency)}</span>
      </div>
      {showEmployerSocial && employerSocial !== undefined && employerSocial > 0 && (
        <div className="flex justify-between gap-2 text-slate-500">
          <span>Cuota patronal SS (информ.)</span>
          <span>{formatCurrency(employerSocial, currency)}/мес.</span>
        </div>
      )}
    </div>
  )
}

function AmountCell({
  item,
  baseCurrency,
  dependents,
}: {
  item: RecurringItem
  baseCurrency: string
  dependents: number
}) {
  useExchangeRateStore((s) => s.rateDate)

  const ruDisplay =
    item.categoryId === 'salary' && item.salaryCountryCode === 'RU'
      ? calculateRussiaSalaryMonthlyDisplay(
          (item.payments ?? [{ amount: item.amount, dayOfMonth: undefined }]).map((p, i) => ({
            id: String(i),
            amount: p.amount,
            dayOfMonth: 'dayOfMonth' in p ? p.dayOfMonth : undefined,
          })),
          dependents,
        )
      : null

  const esDisplay =
    item.categoryId === 'salary' && item.salaryCountryCode === 'ES'
      ? calculateSpainSalaryMonthlyDisplay(
          (item.payments ?? [{ amount: item.amount, dayOfMonth: undefined }]).map((p, i) => ({
            id: String(i),
            amount: p.amount,
            dayOfMonth: 'dayOfMonth' in p ? p.dayOfMonth : undefined,
          })),
          dependents,
        )
      : null

  const salaryDisplay = ruDisplay ?? esDisplay

  if (item.payments && item.payments.length > 1) {
    return (
      <td className="py-2 pr-4">
        {item.payments.map((payment, index) => {
          const tax = salaryDisplay?.payments.find(
            (p) => p.dayOfMonth === payment.dayOfMonth && p.gross === payment.amount,
          ) ?? salaryDisplay?.payments[index]
          const showConversion = item.currency !== baseCurrency
          const displayAmount = tax?.net ?? payment.amount
          const converted = convertCurrency(displayAmount, item.currency, baseCurrency)

          return (
            <div key={payment.label} className="text-sm">
              <span className="text-slate-500">{payment.label}: </span>
              <span className="font-medium text-emerald-700">
                {formatCurrency(displayAmount, item.currency)}
              </span>
              {tax && (
                <span className="text-xs text-slate-400">
                  {' '}
                  (gross {formatCurrency(payment.amount, item.currency)})
                </span>
              )}
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
        <div className="mt-1 border-t border-slate-100 pt-1">
          <div className="font-medium text-emerald-700">
            На руки: {formatCurrency(salaryDisplay?.totalNet ?? item.amount, item.currency)}
          </div>
          {ruDisplay && (
            <div className="text-xs text-slate-500">
              НДФЛ −{formatCurrency(ruDisplay.totalNdfl, item.currency)} · взносы{' '}
              {formatCurrency(ruDisplay.employerSocialMonthly, item.currency)}/мес.
            </div>
          )}
          {esDisplay && (
            <div className="text-xs text-slate-500">
              SS −{formatCurrency(esDisplay.totalSocial, item.currency)} · IRPF −
              {formatCurrency(esDisplay.totalIrpf, item.currency)} · patronal{' '}
              {formatCurrency(esDisplay.employerSocialMonthly, item.currency)}/мес.
            </div>
          )}
        </div>
      </td>
    )
  }

  const converted = convertCurrency(
    salaryDisplay?.totalNet ?? item.amount,
    item.currency,
    baseCurrency,
  )
  const showConversion = item.currency !== baseCurrency

  return (
    <td className="py-2 pr-4">
      <div className="font-medium text-emerald-700">
        {formatCurrency(salaryDisplay?.totalNet ?? item.amount, item.currency)}
      </div>
      {ruDisplay && (
        <div className="text-xs text-slate-500">
          gross {formatCurrency(item.amount, item.currency)} · НДФЛ −
          {formatCurrency(ruDisplay.totalNdfl, item.currency)} · взносы{' '}
          {formatCurrency(ruDisplay.employerSocialMonthly, item.currency)}/мес.
        </div>
      )}
      {esDisplay && (
        <div className="text-xs text-slate-500">
          bruto {formatCurrency(item.amount, item.currency)} · SS −
          {formatCurrency(esDisplay.totalSocial, item.currency)} · IRPF −
          {formatCurrency(esDisplay.totalIrpf, item.currency)}
        </div>
      )}
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
              <td className="py-2 pr-4 font-medium">
                {item.name}
                {item.salaryCountryCode === 'RU' && (
                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-500">
                    РФ
                  </span>
                )}
                {item.salaryCountryCode === 'ES' && (
                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-normal text-slate-500">
                    ES
                  </span>
                )}
                {!isIncludedInResidenceTax(item) && (
                  <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-xs font-normal text-amber-700">
                    вне налогов проживания
                  </span>
                )}
              </td>
              <AmountCell
                item={item}
                baseCurrency={settings.baseCurrency}
                dependents={settings.dependents}
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
