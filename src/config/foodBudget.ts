/** Типовой месячный бюджет на питание на одного человека (умеренный уровень, дом + кафе). */
const FOOD_BUDGET_PER_PERSON: Record<string, number> = {
  ES: 280,
  PT: 260,
  CY: 300,
  TH: 7500,
  MY: 850,
  AE: 1100,
  GE: 350,
  MX: 4000,
  ID: 2_200_000,
  VN: 3_000_000,
}

/** Местная валюта страны проживания. */
export const COUNTRY_LOCAL_CURRENCY: Record<string, string> = {
  ES: 'EUR',
  PT: 'EUR',
  CY: 'EUR',
  TH: 'THB',
  MY: 'MYR',
  AE: 'AED',
  GE: 'GEL',
  MX: 'MXN',
  ID: 'IDR',
  VN: 'VND',
}

export const FOOD_EXPENSE_CATEGORY = 'Еда'

/** Коэффициент экономии при совместном бюджете (не строго линейно по членам семьи). */
function familyFoodScale(familySize: number): number {
  if (familySize <= 1) return 1
  if (familySize === 2) return 1.85
  return 1.85 + (familySize - 2) * 0.75
}

export function getCountryLocalCurrency(countryCode: string): string {
  return COUNTRY_LOCAL_CURRENCY[countryCode] ?? 'EUR'
}

export function getTypicalFoodBudget(countryCode: string, familySize: number): number {
  const perPerson = FOOD_BUDGET_PER_PERSON[countryCode] ?? FOOD_BUDGET_PER_PERSON.ES
  const size = Math.max(1, familySize)
  return Math.round(perPerson * familyFoodScale(size))
}

export function hasTypicalFoodBudget(countryCode: string): boolean {
  return countryCode in FOOD_BUDGET_PER_PERSON
}
