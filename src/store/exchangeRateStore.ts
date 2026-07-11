import { create } from 'zustand'
import { fetchCbrRates } from '../lib/cbrRates'

interface ExchangeRateState {
  rubPerUnit: Record<string, number>
  rateDate: string | null
  status: 'idle' | 'loading' | 'loaded' | 'error'
  error: string | null
  fetchRates: () => Promise<void>
}

export const useExchangeRateStore = create<ExchangeRateState>((set, get) => ({
  rubPerUnit: {},
  rateDate: null,
  status: 'idle',
  error: null,

  fetchRates: async () => {
    if (get().status === 'loading') return

    set({ status: 'loading', error: null })
    try {
      const { rubPerUnit, rateDate } = await fetchCbrRates()
      set({ rubPerUnit, rateDate, status: 'loaded', error: null })
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : 'Не удалось загрузить курсы ЦБ',
      })
    }
  },
}))
