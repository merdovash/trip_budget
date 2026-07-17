import type { MouseEvent, SVGProps } from 'react'
import { sectionToPath } from '../../lib/appRoutes'
import type { AppSection } from '../../types/budget'

type NavIcon = (props: SVGProps<SVGSVGElement>) => React.ReactElement

const NAV_ITEMS: { id: AppSection; label: string; Icon: NavIcon }[] = [
  { id: 'dashboard', label: 'Дашборд', Icon: ChartIcon },
  { id: 'settings', label: 'Настройки', Icon: SettingsIcon },
  { id: 'route', label: 'Маршрут', Icon: RouteIcon },
  { id: 'balances', label: 'Остатки', Icon: BalancesIcon },
  { id: 'income', label: 'Доходы', Icon: IncomeIcon },
  { id: 'expenses', label: 'Расходы', Icon: ExpenseIcon },
  { id: 'report', label: 'Сводный отчёт', Icon: ReportIcon },
  { id: 'presets', label: 'Наборы', Icon: PresetsIcon },
]

interface SidebarProps {
  active: AppSection
  onChange: (section: AppSection) => void
  collapsed: boolean
  onCollapsedChange: (collapsed: boolean) => void
}

export function Sidebar({ active, onChange, collapsed, onCollapsedChange }: SidebarProps) {
  return (
    <div className="shrink-0 md:contents">
      {/* Mobile: горизонтальная навигация */}
      <aside className="z-50 border-b border-slate-200 bg-white md:hidden">
        <nav className="flex gap-1 overflow-x-auto p-2">
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <NavButton
              key={id}
              id={id}
              label={label}
              Icon={Icon}
              isActive={active === id}
              collapsed={false}
              onChange={onChange}
            />
          ))}
        </nav>
      </aside>

      {/* Desktop: фиксированная колонка поверх контента */}
      <aside
        className={`absolute inset-y-0 left-0 z-50 hidden flex-col border-r border-slate-200 bg-white shadow-md transition-[width] duration-200 md:flex ${
          collapsed ? 'w-14' : 'w-56'
        }`}
      >
        <nav
          className={`flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden p-3 ${
            collapsed ? 'items-center px-2' : ''
          }`}
        >
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <NavButton
              key={id}
              id={id}
              label={label}
              Icon={Icon}
              isActive={active === id}
              collapsed={collapsed}
              onChange={onChange}
            />
          ))}
        </nav>

        <div className="shrink-0 border-t border-slate-200 bg-white p-2">
          <button
            type="button"
            onClick={() => onCollapsedChange(!collapsed)}
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
    </div>
  )
}

function NavButton({
  id,
  label,
  Icon,
  isActive,
  collapsed,
  onChange,
}: {
  id: AppSection
  label: string
  Icon: NavIcon
  isActive: boolean
  collapsed: boolean
  onChange: (section: AppSection) => void
}) {
  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    onChange(id)
  }

  return (
    <a
      href={sectionToPath(id)}
      onClick={handleClick}
      title={collapsed ? label : undefined}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      className={`flex items-center rounded-lg text-sm font-medium transition ${
        collapsed ? 'justify-center p-2.5 md:w-full' : 'gap-2.5 whitespace-nowrap px-3 py-2 text-left md:w-full'
      } ${
        isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      <span className={collapsed ? 'md:hidden' : undefined}>{label}</span>
    </a>
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

function RouteIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 21s7-4.5 7-10a7 7 0 1 0-14 0c0 5.5 7 10 7 10Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 11.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
    </svg>
  )
}

function BalancesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 10h18M5 6h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14h.01" />
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

function PresetsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h10" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 17h2v4h-2z" />
    </svg>
  )
}

function ReportIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v0Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6M9 16h4" />
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
