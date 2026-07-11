import { useEffect, useState, type SVGProps } from 'react'
import type { AppSection } from '../../types/budget'

const STORAGE_KEY = 'sidebar-collapsed'

type NavIcon = (props: SVGProps<SVGSVGElement>) => React.ReactElement

const NAV_ITEMS: { id: AppSection; label: string; Icon: NavIcon }[] = [
  { id: 'dashboard', label: 'Дашборд', Icon: ChartIcon },
  { id: 'settings', label: 'Настройки', Icon: SettingsIcon },
  { id: 'income', label: 'Доходы', Icon: IncomeIcon },
  { id: 'expenses', label: 'Расходы', Icon: ExpenseIcon },
  { id: 'onetime', label: 'Разовые траты', Icon: OneTimeIcon },
]

interface SidebarProps {
  active: AppSection
  onChange: (section: AppSection) => void
}

export function Sidebar({ active, onChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  return (
    <aside
      className={`flex shrink-0 flex-col border-b border-slate-200 bg-white transition-[width] duration-200 md:border-b-0 md:border-r ${
        collapsed ? 'md:w-14' : 'w-full md:w-56'
      }`}
    >
      <nav
        className={`flex flex-1 gap-1 overflow-x-auto p-3 md:flex-col md:overflow-x-visible ${
          collapsed ? 'md:items-center md:px-2' : ''
        }`}
      >
        {NAV_ITEMS.map(({ id, label, Icon }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              title={collapsed ? label : undefined}
              aria-label={label}
              className={`flex items-center rounded-lg text-sm font-medium transition ${
                collapsed
                  ? 'justify-center p-2.5 md:w-full'
                  : 'gap-2.5 whitespace-nowrap px-3 py-2 text-left'
              } ${
                isActive
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden />
              <span className={collapsed ? 'md:hidden' : undefined}>{label}</span>
            </button>
          )
        })}
      </nav>

      <div className="hidden border-t border-slate-200 p-2 md:block">
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          title={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
          aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
          className={`flex w-full items-center rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 ${
            collapsed ? 'justify-center' : 'justify-start px-3'
          }`}
        >
          {collapsed ? (
            <ChevronRightIcon className="h-5 w-5" />
          ) : (
            <>
              <ChevronLeftIcon className="h-5 w-5" />
              <span className="ml-2 text-sm">Свернуть</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}

function ChartIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 19V5M4 19h16M8 17V11M12 17V7M16 17v-4" />
    </svg>
  )
}

function SettingsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
      />
    </svg>
  )
}

function IncomeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12M8 11l4 4 4-4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 19h16" />
    </svg>
  )
}

function ExpenseIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21V9M8 13l4-4 4 4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16" />
    </svg>
  )
}

function OneTimeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
    </svg>
  )
}

function ChevronLeftIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
    </svg>
  )
}

function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 18 6-6-6-6" />
    </svg>
  )
}
