import { useState, type ReactNode } from 'react'
import { Card } from '../ui/FormControls'

interface CollapsibleSectionProps {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}

export function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Card className="overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-slate-50"
        aria-expanded={open}
      >
        <span className="text-lg font-semibold text-slate-900">{title}</span>
        <span className="text-sm text-slate-500">{open ? 'Свернуть' : 'Развернуть'}</span>
      </button>
      {open && <div className="border-t border-slate-100 px-5 py-4">{children}</div>}
    </Card>
  )
}
