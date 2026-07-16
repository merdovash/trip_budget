/** Встроенные категории расходов — нельзя удалить. */
export const BUILTIN_EXPENSE_CATEGORIES = [
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
] as const

export function isBuiltinExpenseCategory(name: string): boolean {
  const lower = name.trim().toLowerCase()
  return BUILTIN_EXPENSE_CATEGORIES.some((category) => category.toLowerCase() === lower)
}
