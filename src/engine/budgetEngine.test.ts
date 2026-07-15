import { describe, expect, it } from 'vitest'
import { convertCurrency } from '../lib/currency'
import { FOOD_EXPENSE_CATEGORY } from '../config/foodBudget'
import {
  calculateAnnualGrossIncome,
  calculateBudgetProjection,
  calculateDailyBudgetProjection,
  computeSummaryAverages,
  foodDailyAmount,
  foodMonthlyAmount,
  generateDayKeys,
  generateMonthKeys,
  toMonthlyAmount,
} from './budgetEngine'
import { DEFAULT_SETTINGS, type RecurringItem } from '../types/budget'
import { buildLoanExpense } from '../lib/loanAmortization'

describe('toMonthlyAmount', () => {
  it('converts yearly to monthly', () => {
    expect(toMonthlyAmount(12000, 'yearly')).toBeCloseTo(1000)
  })

  it('converts weekly to monthly', () => {
    expect(toMonthlyAmount(100, 'weekly')).toBeCloseTo(100 * (52 / 12))
  })

  it('returns same for monthly', () => {
    expect(toMonthlyAmount(500, 'monthly')).toBe(500)
  })
})

describe('generateMonthKeys', () => {
  it('generates consecutive months', () => {
    expect(generateMonthKeys(new Date(2026, 0, 15), 3)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
    ])
  })
})

describe('calculateAnnualGrossIncome', () => {
  it('sums recurring incomes in base currency', () => {
    const incomes: RecurringItem[] = [
      {
        id: '1',
        name: 'Salary',
        amount: 5000,
        currency: 'EUR',
        frequency: 'monthly',
        startDate: '2026-01-01',
      },
    ]
    expect(calculateAnnualGrossIncome(incomes, 'EUR')).toBe(60000)
  })

  it('converts foreign currency incomes to base currency', () => {
    const incomes: RecurringItem[] = [
      {
        id: '1',
        name: 'Salary',
        amount: 1000,
        currency: 'USD',
        frequency: 'monthly',
        startDate: '2026-01-01',
      },
    ]
    const annual = calculateAnnualGrossIncome(incomes, 'EUR')
    expect(annual).toBeCloseTo(1000 * 12 * convertCurrency(1, 'USD', 'EUR'))
  })
})

describe('calculateBudgetProjection', () => {
  it('produces monthly snapshots with taxes and one-time expenses', () => {
    const incomes: RecurringItem[] = [
      {
        id: '1',
        name: 'Salary',
        amount: 5000,
        currency: 'EUR',
        frequency: 'monthly',
        startDate: '2026-01-01',
      },
    ]
    const expenses: RecurringItem[] = [
      {
        id: '2',
        name: 'Rent',
        amount: 1500,
        currency: 'EUR',
        frequency: 'monthly',
        startDate: '2026-01-01',
      },
    ]

    const snapshots = calculateBudgetProjection(
      incomes,
      expenses,
      [{ id: '3', name: 'Deposit', amount: 3000, currency: 'EUR', date: '2026-01-15' }],
      {
        ...DEFAULT_SETTINGS,
        taxRegimeId: 'ae-none',
        horizonMonths: 2,
        initialBalanceDate: '2026-01-01',
      },
    )

    expect(snapshots).toHaveLength(2)
    expect(snapshots[0].oneTimeExpenses).toBe(3000)
    expect(snapshots[0].taxes).toBe(0)
    expect(snapshots[0].balance).toBe(5000 - 1500 - 3000)
    expect(snapshots[0].month).toBe('2026-01')
    expect(snapshots[1].cumulativeBalance).toBe(snapshots[0].balance + snapshots[1].balance)
  })

  it('includes initial balance in cumulative total', () => {
    const snapshots = calculateBudgetProjection([], [], [], {
      ...DEFAULT_SETTINGS,
      taxRegimeId: 'ae-none',
      horizonMonths: 2,
      initialBalance: 10000,
      initialBalanceCurrency: 'EUR',
      initialBalanceDate: '2026-03-01',
    })

    expect(snapshots[0].month).toBe('2026-03')
    expect(snapshots[0].cumulativeBalance).toBe(10000)
    expect(snapshots[1].cumulativeBalance).toBe(10000)
  })

  it('starts projection from initial balance date', () => {
    const snapshots = calculateBudgetProjection([], [], [], {
      ...DEFAULT_SETTINGS,
      horizonMonths: 3,
      initialBalanceDate: '2026-06-15',
    })

    expect(snapshots.map((s) => s.month)).toEqual(['2026-06', '2026-07', '2026-08'])
  })

  it('calculates food expense as amount/30 * days in month', () => {
    expect(foodMonthlyAmount(300, '2026-01')).toBe(310)
    expect(foodMonthlyAmount(300, '2026-02')).toBe(280)
    expect(foodDailyAmount(300)).toBe(10)
  })

  it('applies food formula in monthly projection', () => {
    const expenses: RecurringItem[] = [
      {
        id: '1',
        name: 'Еда',
        amount: 300,
        currency: 'EUR',
        frequency: 'monthly',
        category: FOOD_EXPENSE_CATEGORY,
        startDate: '2026-01-01',
      },
    ]

    const snapshots = calculateBudgetProjection([], expenses, [], {
      ...DEFAULT_SETTINGS,
      taxRegimeId: 'ae-none',
      horizonMonths: 2,
      initialBalanceDate: '2026-01-01',
    })

    expect(snapshots[0].recurringExpenses).toBe(310)
    expect(snapshots[1].recurringExpenses).toBe(280)
  })
})

describe('calculateDailyBudgetProjection', () => {
  it('accrues food expense daily', () => {
    const expenses: RecurringItem[] = [
      {
        id: '1',
        name: 'Еда',
        amount: 300,
        currency: 'EUR',
        frequency: 'monthly',
        category: FOOD_EXPENSE_CATEGORY,
        startDate: '2026-01-01',
      },
    ]

    const days = calculateDailyBudgetProjection([], expenses, [], {
      ...DEFAULT_SETTINGS,
      taxRegimeId: 'ae-none',
      horizonMonths: 1,
      initialBalanceDate: '2026-01-01',
    })

    expect(days).toHaveLength(31)
    expect(days[0].recurringExpenses).toBe(10)
    expect(days.reduce((sum, d) => sum + d.recurringExpenses, 0)).toBeCloseTo(310, 0)
  })

  it('schedules salary payments on configured days', () => {
    const incomes: RecurringItem[] = [
      {
        id: '1',
        name: 'Зарплата',
        amount: 5000,
        currency: 'EUR',
        frequency: 'monthly',
        categoryId: 'salary',
        payments: [
          { label: 'Аванс', amount: 2000, dayOfMonth: 25 },
          { label: 'Зарплата', amount: 3000, dayOfMonth: 10 },
        ],
        startDate: '2026-01-01',
      },
    ]

    const days = calculateDailyBudgetProjection(incomes, [], [], {
      ...DEFAULT_SETTINGS,
      taxRegimeId: 'ae-none',
      horizonMonths: 1,
      initialBalanceDate: '2026-01-01',
    })

    const day10 = days.find((d) => d.date === '2026-01-10')
    const day25 = days.find((d) => d.date === '2026-01-25')
    expect(day10?.grossIncome).toBe(3000)
    expect(day25?.grossIncome).toBe(2000)
  })

  it('generates day keys from start date through horizon', () => {
    const keys = generateDayKeys(new Date(2026, 5, 15), 2)
    expect(keys[0]).toBe('2026-06-15')
    expect(keys.at(-1)).toBe('2026-07-31')
    expect(keys).toHaveLength(47)
  })

  it('does not apply residence tax to excluded RU salary in monthly projection', () => {
    const incomes: RecurringItem[] = [
      {
        id: 'ru',
        name: 'RU Salary',
        amount: 500_000,
        currency: 'RUB',
        frequency: 'monthly',
        categoryId: 'salary',
        salaryCountryCode: 'RU',
        includeInResidenceTax: false,
        startDate: '2026-01-01',
      },
      {
        id: 'es',
        name: 'Freelance',
        amount: 3000,
        currency: 'EUR',
        frequency: 'monthly',
        categoryId: 'freelance',
        startDate: '2026-01-01',
      },
    ]

    const snapshots = calculateBudgetProjection(incomes, [], [], {
      ...DEFAULT_SETTINGS,
      taxRegimeId: 'es-employed',
      horizonMonths: 1,
      initialBalanceDate: '2026-01-01',
    })

    const combinedTax = snapshots[0].taxes
    const ruOnly = calculateBudgetProjection([incomes[0]], [], [], {
      ...DEFAULT_SETTINGS,
      taxRegimeId: 'es-employed',
      horizonMonths: 1,
      initialBalanceDate: '2026-01-01',
    })[0].taxes
    const esOnly = calculateBudgetProjection([incomes[1]], [], [], {
      ...DEFAULT_SETTINGS,
      taxRegimeId: 'es-employed',
      horizonMonths: 1,
      initialBalanceDate: '2026-01-01',
    })[0].taxes

    expect(combinedTax).toBeCloseTo(ruOnly + esOnly, 0)
  })
})

describe('loan expenses in projection', () => {
  const loan: RecurringItem = {
    ...buildLoanExpense({
      name: 'Автокредит',
      principal: 12000,
      currency: 'EUR',
      termMonths: 3,
      annualRate: 0,
      startDate: '2026-01-15',
    }),
    id: 'loan-1',
  }

  it('includes loan payments in monthly recurring expenses', () => {
    const snapshots = calculateBudgetProjection([], [loan], [], {
      ...DEFAULT_SETTINGS,
      taxRegimeId: 'ae-none',
      horizonMonths: 4,
      initialBalanceDate: '2026-01-01',
    })
    expect(snapshots[0].recurringExpenses).toBeCloseTo(4000)
    expect(snapshots[1].recurringExpenses).toBeCloseTo(4000)
    expect(snapshots[2].recurringExpenses).toBeCloseTo(4000)
    expect(snapshots[3]?.recurringExpenses ?? 0).toBe(0)
  })

  it('charges loan on payment day in daily projection', () => {
    const days = calculateDailyBudgetProjection([], [loan], [], {
      ...DEFAULT_SETTINGS,
      taxRegimeId: 'ae-none',
      horizonMonths: 2,
      initialBalanceDate: '2026-01-01',
    })

    const disbursementDay = days.find((d) => d.date === '2026-01-15')
    expect(disbursementDay?.recurringExpenses).toBeCloseTo(4000)
    expect(disbursementDay?.loanDisbursement).toBeCloseTo(12000)
    expect(disbursementDay?.balance).toBeCloseTo(12000 - 4000)

    const paymentDay = days.find((d) => d.date === '2026-02-15')
    expect(paymentDay?.recurringExpenses).toBeCloseTo(4000)
    expect(paymentDay?.loanDisbursement).toBe(0)
    expect(days.find((d) => d.date === '2026-02-14')?.recurringExpenses).toBe(0)
  })

  it('adds loan principal to monthly balance on disbursement month', () => {
    const snapshots = calculateBudgetProjection([], [loan], [], {
      ...DEFAULT_SETTINGS,
      taxRegimeId: 'ae-none',
      horizonMonths: 2,
      initialBalanceDate: '2026-01-01',
    })
    expect(snapshots[0].loanDisbursement).toBeCloseTo(12000)
    expect(snapshots[0].balance).toBeCloseTo(12000 - 4000)
    expect(snapshots[1].loanDisbursement).toBe(0)
    expect(snapshots[1].balance).toBeCloseTo(-4000)
  })
})

describe('computeSummaryAverages', () => {
  it('averages one-time and dated recurring expenses over the full horizon', () => {
    const expenses: RecurringItem[] = [
      {
        id: 'rent',
        name: 'Rent',
        amount: 1000,
        currency: 'EUR',
        frequency: 'monthly',
        startDate: '2026-01-01',
        endDate: '2026-02-28',
      },
      {
        id: 'once',
        name: 'Deposit',
        amount: 3000,
        currency: 'EUR',
        frequency: 'once',
        startDate: '2026-01-10',
      },
    ]
    const snapshots = calculateBudgetProjection([], expenses, [], {
      ...DEFAULT_SETTINGS,
      taxRegimeId: 'ae-none',
      horizonMonths: 4,
      initialBalanceDate: '2026-01-01',
    })
    const averages = computeSummaryAverages(snapshots)
    // rent: 1000+1000, once: 3000 → total 5000 / 4 months
    expect(averages.avgExpenses).toBeCloseTo(5000 / 4)
    expect(averages.avgOneTimeExpenses).toBeCloseTo(3000 / 4)
    expect(averages.avgRecurringExpenses).toBeCloseTo(2000 / 4)
  })

  it('includes loan disbursement in avg inflow so averages match ending balance growth', () => {
    const testLoan: RecurringItem = {
      ...buildLoanExpense({
        name: 'Автокредит',
        principal: 12000,
        currency: 'EUR',
        termMonths: 3,
        annualRate: 0,
        startDate: '2026-01-15',
      }),
      id: 'loan-avg',
    }
    const income: RecurringItem = {
      id: 'sal',
      name: 'Salary',
      amount: 2000,
      currency: 'EUR',
      frequency: 'monthly',
      startDate: '2026-01-01',
    }
    const snapshots = calculateBudgetProjection([income], [testLoan], [], {
      ...DEFAULT_SETTINGS,
      taxRegimeId: 'ae-none',
      horizonMonths: 3,
      initialBalance: 0,
      initialBalanceCurrency: 'EUR',
      initialBalanceDate: '2026-01-01',
    })
    const averages = computeSummaryAverages(snapshots)
    const last = snapshots.at(-1)!.cumulativeBalance
    expect(averages.avgInflow).toBeGreaterThan(averages.avgNetIncome)
    expect(averages.avgExpenses).toBeGreaterThan(averages.avgNetIncome)
    expect(last).toBeCloseTo((averages.avgInflow - averages.avgExpenses) * snapshots.length)
  })
})

describe('relocation date in projection', () => {
  const destinationRent: RecurringItem = {
    id: 'rent',
    name: 'Аренда',
    amount: 1000,
    currency: 'EUR',
    frequency: 'monthly',
    lifecycle: 'destination',
    startDate: '2026-01-01',
  }

  it('skips destination expenses before relocation date', () => {
    const snapshots = calculateBudgetProjection([], [destinationRent], [], {
      ...DEFAULT_SETTINGS,
      taxRegimeId: 'ae-none',
      horizonMonths: 4,
      initialBalanceDate: '2026-01-01',
      relocationDate: '2026-03-01',
    })
    expect(snapshots[0].recurringExpenses).toBe(0)
    expect(snapshots[1].recurringExpenses).toBe(0)
    expect(snapshots[2].recurringExpenses).toBeCloseTo(1000)
  })
})
