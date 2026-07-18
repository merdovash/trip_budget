import type {
  ExpenseCategory,
  ExpenseFolder,
  IncomePayment,
  InitialBalanceEntry,
  RecurringItem,
  ResidenceRoutePoint,
  ThailandDeductionSettings,
} from '../src/types/budget'
import type { SqlQuery } from './db/pgClient'
import type { PresetListColumns } from './presetPayload'

interface RecurringRow {
  id: string
  sort_order: number
  name: string
  amount: number
  currency: string
  frequency: string
  category: string | null
  category_id: string | null
  lifecycle: string | null
  salary_country_code: string | null
  include_in_residence_tax: boolean | null
  foreign_tax_credit: boolean | null
  payments: IncomePayment[] | null
  start_date: string
  end_date: string | null
  expense_kind: string | null
  principal: number | null
  term_months: number | null
  annual_rate: number | null
  folder_id: string | null
  expense_country_scope: string | null
  route_point_id: string | null
  expense_country_code: string | null
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function optionalString(value: string | null | undefined): string | undefined {
  return value == null || value === '' ? undefined : value
}

function optionalNumber(value: number | null | undefined): number | undefined {
  return value == null ? undefined : value
}

function optionalBool(value: boolean | null | undefined): boolean | undefined {
  return value == null ? undefined : value
}

function recurringFromRow(row: RecurringRow): RecurringItem {
  const item: RecurringItem = {
    id: String(row.id),
    name: row.name,
    amount: Number(row.amount),
    currency: row.currency,
    frequency: row.frequency as RecurringItem['frequency'],
    startDate: row.start_date,
  }
  const category = optionalString(row.category)
  if (category !== undefined) item.category = category
  const categoryId = optionalString(row.category_id)
  if (categoryId !== undefined) item.categoryId = categoryId
  const lifecycle = optionalString(row.lifecycle)
  if (lifecycle !== undefined) item.lifecycle = lifecycle as RecurringItem['lifecycle']
  const salaryCountryCode = optionalString(row.salary_country_code)
  if (salaryCountryCode !== undefined) item.salaryCountryCode = salaryCountryCode
  const includeInResidenceTax = optionalBool(row.include_in_residence_tax)
  if (includeInResidenceTax !== undefined) item.includeInResidenceTax = includeInResidenceTax
  const foreignTaxCredit = optionalBool(row.foreign_tax_credit)
  if (foreignTaxCredit !== undefined) item.foreignTaxCredit = foreignTaxCredit
  const payments = asArray<IncomePayment>(row.payments)
  if (payments.length > 0) item.payments = payments
  const endDate = optionalString(row.end_date)
  if (endDate !== undefined) item.endDate = endDate
  const expenseKind = optionalString(row.expense_kind)
  if (expenseKind !== undefined) item.expenseKind = expenseKind as RecurringItem['expenseKind']
  const principal = optionalNumber(row.principal)
  if (principal !== undefined) item.principal = principal
  const termMonths = optionalNumber(row.term_months)
  if (termMonths !== undefined) item.termMonths = termMonths
  const annualRate = optionalNumber(row.annual_rate)
  if (annualRate !== undefined) item.annualRate = annualRate
  const folderId = optionalString(row.folder_id)
  if (folderId !== undefined) item.folderId = folderId
  const expenseCountryScope = optionalString(row.expense_country_scope)
  if (expenseCountryScope !== undefined) {
    item.expenseCountryScope = expenseCountryScope as RecurringItem['expenseCountryScope']
  }
  const routePointId = optionalString(row.route_point_id)
  if (routePointId !== undefined) item.routePointId = routePointId
  const expenseCountryCode = optionalString(row.expense_country_code)
  if (expenseCountryCode !== undefined) item.expenseCountryCode = expenseCountryCode
  return item
}

const RECURRING_SELECT = `
  id, sort_order, name, amount, currency, frequency,
  category, category_id, lifecycle, salary_country_code,
  include_in_residence_tax, foreign_tax_credit, payments,
  start_date, end_date, expense_kind, principal, term_months, annual_rate,
  folder_id, expense_country_scope, route_point_id, expense_country_code
`

async function insertRecurringItems(
  query: SqlQuery,
  table: 'preset_incomes' | 'preset_expenses',
  presetId: string,
  items: RecurringItem[],
): Promise<void> {
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i]!
    await query(
      `INSERT INTO ${table} (
        preset_id, id, sort_order, name, amount, currency, frequency,
        category, category_id, lifecycle, salary_country_code,
        include_in_residence_tax, foreign_tax_credit, payments,
        start_date, end_date, expense_kind, principal, term_months, annual_rate,
        folder_id, expense_country_scope, route_point_id, expense_country_code
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11,
        $12, $13, $14,
        $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24
      )`,
      [
        presetId,
        item.id,
        i,
        item.name,
        item.amount,
        item.currency,
        item.frequency,
        item.category ?? null,
        item.categoryId ?? null,
        item.lifecycle ?? null,
        item.salaryCountryCode ?? null,
        item.includeInResidenceTax ?? null,
        item.foreignTaxCredit ?? null,
        item.payments ?? null,
        item.startDate,
        item.endDate ?? null,
        item.expenseKind ?? null,
        item.principal ?? null,
        item.termMonths ?? null,
        item.annualRate ?? null,
        item.folderId ?? null,
        item.expenseCountryScope ?? null,
        item.routePointId ?? null,
        item.expenseCountryCode ?? null,
      ],
    )
  }
}

/** Replace all list children for a preset (caller must be inside a transaction). */
export async function replacePresetChildren(
  query: SqlQuery,
  presetId: string,
  cols: PresetListColumns,
): Promise<void> {
  await query(`DELETE FROM preset_folders WHERE preset_id = $1`, [presetId])
  await query(`DELETE FROM preset_income_folders WHERE preset_id = $1`, [presetId])
  await query(`DELETE FROM preset_expense_categories WHERE preset_id = $1`, [presetId])
  await query(`DELETE FROM preset_residence_route WHERE preset_id = $1`, [presetId])
  await query(`DELETE FROM preset_initial_balances WHERE preset_id = $1`, [presetId])
  await query(`DELETE FROM preset_incomes WHERE preset_id = $1`, [presetId])
  await query(`DELETE FROM preset_expenses WHERE preset_id = $1`, [presetId])

  for (let i = 0; i < cols.folders.length; i += 1) {
    const folder = cols.folders[i]!
    await query(
      `INSERT INTO preset_folders (preset_id, id, name, sort_order, excluded)
       VALUES ($1, $2, $3, $4, $5)`,
      [presetId, folder.id, folder.name, folder.sortOrder ?? i, folder.excluded ?? false],
    )
  }

  for (let i = 0; i < cols.incomeFolders.length; i += 1) {
    const folder = cols.incomeFolders[i]!
    await query(
      `INSERT INTO preset_income_folders (preset_id, id, name, sort_order)
       VALUES ($1, $2, $3, $4)`,
      [presetId, folder.id, folder.name, folder.sortOrder ?? i],
    )
  }

  for (let i = 0; i < cols.expenseCategories.length; i += 1) {
    const category = cols.expenseCategories[i]!
    await query(
      `INSERT INTO preset_expense_categories (preset_id, id, name, sort_order)
       VALUES ($1, $2, $3, $4)`,
      [presetId, category.id, category.name, category.sortOrder ?? i],
    )
  }

  for (let i = 0; i < cols.residenceRoute.length; i += 1) {
    const point = cols.residenceRoute[i]!
    await query(
      `INSERT INTO preset_residence_route (
        preset_id, id, country_code, tax_regime_id, start_date, end_date, regime_params, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        presetId,
        point.id,
        point.countryCode,
        point.taxRegimeId,
        point.startDate,
        point.endDate,
        point.regimeParams ?? null,
        i,
      ],
    )
  }

  for (let i = 0; i < cols.initialBalances.length; i += 1) {
    const balance = cols.initialBalances[i]!
    await query(
      `INSERT INTO preset_initial_balances (
        preset_id, id, amount, currency, comment, annual_rate, sort_order
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        presetId,
        balance.id,
        balance.amount,
        balance.currency,
        balance.comment ?? null,
        balance.annualRate ?? null,
        i,
      ],
    )
  }

  await insertRecurringItems(query, 'preset_incomes', presetId, cols.incomes)
  await insertRecurringItems(query, 'preset_expenses', presetId, cols.expenses)
}

export async function loadPresetChildren(
  query: SqlQuery,
  presetId: string,
): Promise<PresetListColumns> {
  const folders = await query<{
    id: string
    name: string
    sort_order: number
    excluded: boolean
  }>(
    `SELECT id, name, sort_order, excluded FROM preset_folders
     WHERE preset_id = $1 ORDER BY sort_order, id`,
    [presetId],
  )

  const incomeFolders = await query<{
    id: string
    name: string
    sort_order: number
  }>(
    `SELECT id, name, sort_order FROM preset_income_folders
     WHERE preset_id = $1 ORDER BY sort_order, id`,
    [presetId],
  )

  const expenseCategories = await query<{
    id: string
    name: string
    sort_order: number
  }>(
    `SELECT id, name, sort_order FROM preset_expense_categories
     WHERE preset_id = $1 ORDER BY sort_order, id`,
    [presetId],
  )

  const residenceRoute = await query<{
    id: string
    country_code: string
    tax_regime_id: string
    start_date: string
    end_date: string
    regime_params: ThailandDeductionSettings | null
  }>(
    `SELECT id, country_code, tax_regime_id, start_date, end_date, regime_params
     FROM preset_residence_route
     WHERE preset_id = $1 ORDER BY sort_order, id`,
    [presetId],
  )

  const initialBalances = await query<{
    id: string
    amount: number
    currency: string
    comment: string | null
    annual_rate: number | null
  }>(
    `SELECT id, amount, currency, comment, annual_rate
     FROM preset_initial_balances
     WHERE preset_id = $1 ORDER BY sort_order, id`,
    [presetId],
  )

  const incomes = await query<RecurringRow>(
    `SELECT ${RECURRING_SELECT} FROM preset_incomes
     WHERE preset_id = $1 ORDER BY sort_order, id`,
    [presetId],
  )

  const expenses = await query<RecurringRow>(
    `SELECT ${RECURRING_SELECT} FROM preset_expenses
     WHERE preset_id = $1 ORDER BY sort_order, id`,
    [presetId],
  )

  return {
    folders: folders.rows.map((row): ExpenseFolder => {
      const folder: ExpenseFolder = { id: String(row.id), name: row.name }
      if (row.sort_order != null) folder.sortOrder = Number(row.sort_order)
      if (row.excluded) folder.excluded = true
      return folder
    }),
    incomeFolders: incomeFolders.rows.map((row): ExpenseFolder => {
      const folder: ExpenseFolder = { id: String(row.id), name: row.name }
      if (row.sort_order != null) folder.sortOrder = Number(row.sort_order)
      return folder
    }),
    expenseCategories: expenseCategories.rows.map((row): ExpenseCategory => {
      const category: ExpenseCategory = { id: String(row.id), name: row.name }
      if (row.sort_order != null) category.sortOrder = Number(row.sort_order)
      return category
    }),
    residenceRoute: residenceRoute.rows.map((row): ResidenceRoutePoint => {
      const point: ResidenceRoutePoint = {
        id: String(row.id),
        countryCode: row.country_code,
        taxRegimeId: row.tax_regime_id,
        startDate: row.start_date,
        endDate: row.end_date,
      }
      if (row.regime_params && typeof row.regime_params === 'object') {
        point.regimeParams = row.regime_params
      }
      return point
    }),
    initialBalances: initialBalances.rows.map((row): InitialBalanceEntry => {
      const entry: InitialBalanceEntry = {
        id: String(row.id),
        amount: Number(row.amount),
        currency: row.currency,
      }
      const comment = optionalString(row.comment)
      if (comment !== undefined) entry.comment = comment
      const annualRate = optionalNumber(row.annual_rate)
      if (annualRate !== undefined) entry.annualRate = annualRate
      return entry
    }),
    incomes: incomes.rows.map(recurringFromRow),
    expenses: expenses.rows.map(recurringFromRow),
  }
}
