import { useEffect, useState } from 'react'
import { Dashboard } from './components/dashboard/Dashboard'
import { ExpensePanel } from './components/expenses/ExpensePanel'
import { Disclaimer, Header } from './components/layout/Header'
import { Sidebar } from './components/layout/Sidebar'
import { IncomePanel } from './components/income/IncomePanel'
import { OneTimePanel } from './components/onetime/OneTimePanel'
import { PresetsPanel } from './components/presets/PresetsPanel'
import { BudgetSettingsPanel } from './components/settings/BudgetSettings'
import { useExchangeRateStore } from './store/exchangeRateStore'
import type { AppSection } from './types/budget'

function SectionContent({ section }: { section: AppSection }) {
  switch (section) {
    case 'dashboard':
      return <Dashboard />
    case 'settings':
      return <BudgetSettingsPanel />
    case 'income':
      return <IncomePanel />
    case 'expenses':
      return <ExpensePanel />
    case 'onetime':
      return <OneTimePanel />
    case 'presets':
      return <PresetsPanel />
  }
}

export default function App() {
  const [section, setSection] = useState<AppSection>('dashboard')
  const fetchRates = useExchangeRateStore((s) => s.fetchRates)

  useEffect(() => {
    fetchRates()
  }, [fetchRates])

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <Disclaimer />
      <div className="flex flex-1 flex-col md:flex-row">
        <Sidebar active={section} onChange={setSection} />
        <main className="flex-1 overflow-auto p-4 md:p-6">
          <SectionContent section={section} />
        </main>
      </div>
    </div>
  )
}
