import { useEffect, useState, type MouseEvent, type SVGProps } from 'react'
import { sectionToPath } from '../../lib/appRoutes'
import type { AppSection } from '../../types/budget'
import { AuthControls } from './AuthControls'
import { Disclaimer } from './Disclaimer'

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (!mobileMenuOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [mobileMenuOpen])

  function selectSection(id: AppSection) {
    onChange(id)
    setMobileMenuOpen(false)
  }

  return (
    <div className="shrink-0 md:contents">
      {/* Mobile: нижняя панель иконок */}
      <aside className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom,0px)] md:hidden">
        <nav className="flex items-stretch gap-0.5 overflow-x-auto px-1 py-1.5">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            title="Меню"
            aria-label="Открыть меню"
            aria-expanded={mobileMenuOpen}
            className="flex min-w-[3rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1.5 text-slate-600 hover:bg-slate-100"
          >
            <MenuIcon className="h-5 w-5" aria-hidden />
            <span className="text-[10px] font-medium leading-none">Меню</span>
          </button>
          {NAV_ITEMS.map(({ id, label, Icon }) => (
            <NavButton
              key={id}
              id={id}
              label={label}
              Icon={Icon}
              isActive={active === id}
              mode="icon"
              onChange={selectSection}
            />
          ))}
        </nav>
      </aside>

      {/* Mobile: выезжающее слева полное меню */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[55] md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/40"
            aria-label="Закрыть меню"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside
            className="absolute inset-y-0 left-0 flex w-[min(18rem,85vw)] flex-col border-r border-slate-200 bg-white shadow-xl"
            style={{ animation: 'mobile-drawer-in 180ms ease-out' }}
            aria-label="Навигация"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">Меню</p>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100"
              >
                Закрыть
              </button>
            </div>
            <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3">
              {NAV_ITEMS.map(({ id, label, Icon }) => (
                <NavButton
                  key={id}
                  id={id}
                  label={label}
                  Icon={Icon}
                  isActive={active === id}
                  mode="full"
                  onChange={selectSection}
                />
              ))}
            </nav>
            <div className="shrink-0 space-y-3 border-t border-slate-200 p-3">
              <AuthControls />
              <Disclaimer />
            </div>
          </aside>
        </div>
      )}

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
              mode={collapsed ? 'icon' : 'full'}
              onChange={onChange}
            />
          ))}
        </nav>

        <div className="shrink-0 space-y-2 border-t border-slate-200 bg-white p-2">
          {!collapsed && (
            <>
              <AuthControls />
              <Disclaimer />
            </>
          )}
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
  mode,
  onChange,
}: {
  id: AppSection
  label: string
  Icon: NavIcon
  isActive: boolean
  mode: 'icon' | 'full'
  onChange: (section: AppSection) => void
}) {
  function handleClick(e: MouseEvent<HTMLAnchorElement>) {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return
    e.preventDefault()
    onChange(id)
  }

  if (mode === 'icon') {
    return (
      <a
        href={sectionToPath(id)}
        onClick={handleClick}
        title={label}
        aria-label={label}
        aria-current={isActive ? 'page' : undefined}
        className={`flex min-w-[3rem] shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-medium leading-none transition md:min-w-0 md:flex-row md:gap-0 md:p-2.5 md:text-sm ${
          isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
        }`}
      >
        <Icon className="h-5 w-5 shrink-0" aria-hidden />
        <span className="max-w-[4.5rem] truncate md:hidden">{label}</span>
      </a>
    )
  }

  return (
    <a
      href={sectionToPath(id)}
      onClick={handleClick}
      aria-label={label}
      aria-current={isActive ? 'page' : undefined}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
        isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      <span>{label}</span>
    </a>
  )
}

function MenuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" {...props}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
    </svg>
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
