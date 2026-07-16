import { useEffect, useState } from 'react'
import { Dashboard } from './components/dashboard/Dashboard'
import { ExpensePanel } from './components/expenses/ExpensePanel'
import { Disclaimer, Header } from './components/layout/Header'
import { Sidebar } from './components/layout/Sidebar'
import { IncomePanel } from './components/income/IncomePanel'
import { PresetsPanel } from './components/presets/PresetsPanel'
import { ExpenseReportPanel } from './components/reports/ExpenseReportPanel'
import { BudgetSettingsPanel } from './components/settings/BudgetSettings'
import { useExchangeRateStore } from './store/exchangeRateStore'
import type { AppSection } from './types/budget'

const SIDEBAR_STORAGE_KEY = 'sidebar-collapsed'

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
    case 'report':
      return <ExpenseReportPanel />
    case 'presets':
      return <PresetsPanel />
  }
}

export default function App() {
  const [section, setSection] = useState<AppSection>('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })
  const fetchRates = useExchangeRateStore((s) => s.fetchRates)

  useEffect(() => {
    fetchRates()
  }, [fetchRates])

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarCollapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [sidebarCollapsed])

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <Header />
      <Disclaimer />
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
        <Sidebar
          active={section}
          onChange={setSection}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />
        <main
          className={`min-h-0 flex-1 overflow-y-auto p-4 transition-[margin] duration-200 md:p-6 ${
            sidebarCollapsed ? 'md:ml-14' : 'md:ml-56'
          }`}
        >
          <SectionContent section={section} />
        </main>
      </div>
    </div>
  )
}
