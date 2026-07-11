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

export const oneTimeExpenseSchema = z.object({
  name: z.string().min(1, 'Укажите название'),
  amount: z.coerce.number().positive('Сумма должна быть больше 0'),
  currency: z.string().min(1),
  date: isoDateRequired,
  category: z.string().optional(),
})

export type RecurringItemFormData = z.infer<typeof recurringItemSchema>
export type OneTimeExpenseFormData = z.infer<typeof oneTimeExpenseSchema>
