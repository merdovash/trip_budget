import type { AppSection } from '../../types/budget'

const NAV_ITEMS: { id: AppSection; label: string }[] = [
  { id: 'dashboard', label: 'Дашборд' },
  { id: 'settings', label: 'Настройки' },
  { id: 'income', label: 'Доходы' },
  { id: 'expenses', label: 'Расходы' },
  { id: 'onetime', label: 'Разовые траты' },
]

interface SidebarProps {
  active: AppSection
  onChange: (section: AppSection) => void
}

export function Sidebar({ active, onChange }: SidebarProps) {
  return (
    <aside className="w-full shrink-0 border-b border-slate-200 bg-white md:w-56 md:border-b-0 md:border-r">
      <nav className="flex gap-1 overflow-x-auto p-3 md:flex-col">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition ${
              active === item.id
                ? 'bg-blue-50 text-blue-700'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  )
}
