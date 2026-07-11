const CBR_JSON_URL = 'https://www.cbr-xml-daily.ru/daily_json.js'

export interface CbrValute {
  CharCode: string
  Nominal: number
  Value: number
}

export interface CbrDailyResponse {
  Date: string
  Valute: Record<string, CbrValute>
}

export interface ParsedCbrRates {
  rubPerUnit: Record<string, number>
  rateDate: string
}

export function parseCbrResponse(data: CbrDailyResponse): ParsedCbrRates {
  const rubPerUnit: Record<string, number> = { RUB: 1 }

  for (const valute of Object.values(data.Valute)) {
    rubPerUnit[valute.CharCode] = valute.Value / valute.Nominal
  }

  return { rubPerUnit, rateDate: data.Date }
}

export async function fetchCbrRates(): Promise<ParsedCbrRates> {
  const response = await fetch(CBR_JSON_URL)
  if (!response.ok) {
    throw new Error(`CBR request failed: ${response.status}`)
  }

  const data = (await response.json()) as CbrDailyResponse
  return parseCbrResponse(data)
}

export function convertViaCbr(
  amount: number,
  from: string,
  to: string,
  rubPerUnit: Record<string, number>,
): number | null {
  if (from === to) return amount

  const rubPerFrom = from === 'RUB' ? 1 : rubPerUnit[from]
  const rubPerTo = to === 'RUB' ? 1 : rubPerUnit[to]

  if (!rubPerFrom || !rubPerTo) return null

  const amountInRub = from === 'RUB' ? amount : amount * rubPerFrom
  return to === 'RUB' ? amountInRub : amountInRub / rubPerTo
}
