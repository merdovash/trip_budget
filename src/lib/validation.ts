import { z } from 'zod'
import { isValidIsoDate } from './format'

const isoDateRequired = z
  .string()
  .min(1, 'Укажите дату')
  .refine(isValidIsoDate, `Формат: ДД.ММ.ГГГГ`)

const isoDateOptional = z
  .string()
  .optional()
  .refine((value) => !value || isValidIsoDate(value), `Формат: ДД.ММ.ГГГГ`)

export const recurringItemSchema = z.object({
  name: z.string().min(1, 'Укажите название'),
  amount: z.coerce.number().positive('Сумма должна быть больше 0'),
  currency: z.string().min(1),
  frequency: z.enum(['monthly', 'yearly', 'weekly', 'once']),
  category: z.string().optional(),
  startDate: isoDateRequired,
  endDate: isoDateOptional,
})

const expenseCountryScopeSchema = z.enum(['employment', 'residence', 'other'], {
  errorMap: () => ({ message: 'Укажите страну расхода' }),
})

const folderIdSchema = z.string().optional()

export const oneTimeExpenseSchema = z.object({
  name: z.string().min(1, 'Укажите название'),
  amount: z.coerce.number().positive('Сумма должна быть больше 0'),
  currency: z.string().min(1),
  date: isoDateRequired,
  category: z.string().optional(),
  expenseCountryScope: expenseCountryScopeSchema,
})

const regularExpenseFormSchema = z.object({
  kind: z.literal('regular'),
  name: z.string().min(1, 'Укажите название'),
  amount: z.coerce.number().positive('Сумма должна быть больше 0'),
  currency: z.string().min(1),
  frequency: z.enum(['monthly', 'yearly', 'weekly']),
  category: z.string().optional(),
  folderId: folderIdSchema,
  expenseCountryScope: expenseCountryScopeSchema,
  routePointId: z.string().optional(),
  startDate: isoDateRequired,
  endDate: isoDateOptional,
})

const onceExpenseFormSchema = z.object({
  kind: z.literal('once'),
  name: z.string().min(1, 'Укажите название'),
  amount: z.coerce.number().positive('Сумма должна быть больше 0'),
  currency: z.string().min(1),
  category: z.string().optional(),
  folderId: folderIdSchema,
  expenseCountryScope: expenseCountryScopeSchema,
  startDate: isoDateRequired,
})

const loanExpenseFormSchema = z.object({
  kind: z.literal('loan'),
  name: z.string().min(1, 'Укажите название'),
  principal: z.coerce.number().positive('Сумма кредита должна быть больше 0'),
  currency: z.string().min(1),
  termMonths: z.coerce.number().int('Укажите целое число месяцев').min(1, 'Срок не менее 1 месяца'),
  annualRate: z.coerce.number().min(0, 'Ставка не может быть отрицательной'),
  folderId: folderIdSchema,
  expenseCountryScope: expenseCountryScopeSchema,
  startDate: isoDateRequired,
})

export const expenseFormSchema = z.discriminatedUnion('kind', [
  regularExpenseFormSchema,
  onceExpenseFormSchema,
  loanExpenseFormSchema,
])

export type RecurringItemFormData = z.infer<typeof recurringItemSchema>
export type OneTimeExpenseFormData = z.infer<typeof oneTimeExpenseSchema>
export type ExpenseFormData = z.infer<typeof expenseFormSchema>
