import { create } from 'zustand'
import { fetchCbrRates } from '../lib/cbrRates'

interface ExchangeRateState {
  pivotPerUnit: Record<string, number>
  rateDate: string | null
  status: 'idle' | 'loading' | 'loaded' | 'error'
  error: string | null
  fetchRates: () => Promise<void>
}

export const useExchangeRateStore = create<ExchangeRateState>((set, get) => ({
  pivotPerUnit: {},
  rateDate: null,
  status: 'idle',
  error: null,

  fetchRates: async () => {
    if (get().status === 'loading') return

    set({ status: 'loading', error: null })
    try {
      const { pivotPerUnit, rateDate } = await fetchCbrRates()
      set({ pivotPerUnit, rateDate, status: 'loaded', error: null })
    } catch (err) {
      set({
        status: 'error',
        error: err instanceof Error ? err.message : 'Не удалось загрузить курсы ЦБ',
      })
    }
  },
}))
