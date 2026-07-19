import { useEffect, useState } from 'react'
import { Dashboard } from './components/dashboard/Dashboard'
import { ExpensePanel } from './components/expenses/ExpensePanel'
import { Header } from './components/layout/Header'
import { Sidebar } from './components/layout/Sidebar'
import { IncomePanel } from './components/income/IncomePanel'
import { PresetsPanel } from './components/presets/PresetsPanel'
import { ExpenseReportPanel } from './components/reports/ExpenseReportPanel'
import { BudgetSettingsPanel } from './components/settings/BudgetSettings'
import { ResidenceRoutePanel } from './components/settings/ResidenceRoutePanel'
import { InitialBalancesPanel } from './components/settings/InitialBalancesPanel'
import { useAppSection } from './lib/useAppSection'
import { useAuthStore } from './store/authStore'
import { useExchangeRateStore } from './store/exchangeRateStore'
import type { AppSection } from './types/budget'

const SIDEBAR_STORAGE_KEY = 'sidebar-collapsed'

function SectionContent({ section }: { section: AppSection }) {
  switch (section) {
    case 'dashboard':
      return <Dashboard />
    case 'settings':
      return <BudgetSettingsPanel />
    case 'route':
      return <ResidenceRoutePanel />
    case 'balances':
      return <InitialBalancesPanel />
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
  const [section, setSection] = useAppSection()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })
  const fetchRates = useExchangeRateStore((s) => s.fetchRates)
  const initAuth = useAuthStore((s) => s.init)

  useEffect(() => {
    fetchRates()
  }, [fetchRates])

  useEffect(() => {
    void initAuth()
  }, [initAuth])

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
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Sidebar
          active={section}
          onChange={setSection}
          collapsed={sidebarCollapsed}
          onCollapsedChange={setSidebarCollapsed}
        />
        <main
          className={`min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-3 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] transition-[margin] duration-200 sm:p-4 md:p-6 md:pb-6 ${
            sidebarCollapsed ? 'md:ml-14' : 'md:ml-56'
          }`}
        >
          <SectionContent section={section} />
        </main>
      </div>
    </div>
  )
}
