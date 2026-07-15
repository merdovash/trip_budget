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
  pivotPerUnit: Record<string, number>
  rateDate: string
}

export function parseCbrResponse(data: CbrDailyResponse): ParsedCbrRates {
  // CBR quotes each currency in RUB; expose RUB as an implementation-neutral pivot.
  const rates: Record<string, number> = { RUB: 1 }

  for (const valute of Object.values(data.Valute)) {
    rates[valute.CharCode] = valute.Value / valute.Nominal
  }

  return { pivotPerUnit: rates, rateDate: data.Date }
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
  pivotPerUnit: Record<string, number>,
): number | null {
  if (from === to) return amount

  const pivotFrom = from === 'RUB' ? 1 : pivotPerUnit[from]
  const pivotTo = to === 'RUB' ? 1 : pivotPerUnit[to]

  if (!pivotFrom || !pivotTo) return null

  const amountInPivot = from === 'RUB' ? amount : amount * pivotFrom
  return to === 'RUB' ? amountInPivot : amountInPivot / pivotTo
}
