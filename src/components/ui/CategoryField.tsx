import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Button, Field, Input } from './FormControls'

export interface CategoryOption {
  id: string
  name: string
  /** Встроенные нельзя удалить. */
  builtin?: boolean
}

interface CategoryFieldProps {
  value: string
  onChange: (category: string) => void
  options: CategoryOption[]
  onAddCategory: (name: string) => string
  onRemoveCategory: (id: string) => void
}

export function CategoryField({
  value,
  onChange,
  options,
  onAddCategory,
  onRemoveCategory,
}: CategoryFieldProps) {
  const [open, setOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const selectedLabel = value || '— Без категории —'

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setOpen(false)
      setCreating(false)
      setNewName('')
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open])

  useEffect(() => {
    if (!open || !rootRef.current) return

    function updatePlacement() {
      const trigger = rootRef.current
      if (!trigger) return
      const rect = trigger.getBoundingClientRect()
      const menuHeight = menuRef.current?.offsetHeight ?? 220
      const gap = 4
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top
      const shouldOpenUp = spaceBelow < menuHeight + gap && spaceAbove > spaceBelow
      setOpenUp(shouldOpenUp)
      const maxHeight = Math.min(256, shouldOpenUp ? spaceAbove - gap : spaceBelow - gap)
      setMenuStyle({
        position: 'fixed',
        left: rect.left,
        width: rect.width,
        zIndex: 80,
        maxHeight: Math.max(120, maxHeight),
        ...(shouldOpenUp
          ? { bottom: window.innerHeight - rect.top + gap }
          : { top: rect.bottom + gap }),
      })
    }

    updatePlacement()
    const frame = requestAnimationFrame(updatePlacement)
    window.addEventListener('resize', updatePlacement)
    window.addEventListener('scroll', updatePlacement, true)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', updatePlacement)
      window.removeEventListener('scroll', updatePlacement, true)
    }
  }, [open, options.length, creating])

  function selectCategory(name: string) {
    onChange(name)
    setOpen(false)
    setCreating(false)
    setNewName('')
  }

  function handleCreate() {
    const trimmed = newName.trim()
    if (!trimmed) return
    onAddCategory(trimmed)
    onChange(trimmed)
    setNewName('')
    setCreating(false)
    setOpen(false)
  }

  function handleDelete(option: CategoryOption) {
    if (option.builtin) return
    if (value === option.name) onChange('')
    onRemoveCategory(option.id)
  }

  return (
    <Field label="Категория">
      <div ref={rootRef} className="relative">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          onClick={() =>
            setOpen((prev) => {
              if (prev) {
                setCreating(false)
                setNewName('')
                return false
              }
              return true
            })
          }
          aria-expanded={open}
        >
          <span>{selectedLabel}</span>
          <span className="text-slate-400">{open ? (openUp ? '▾' : '▴') : '▾'}</span>
        </button>
      </div>
      {open && (
        <div
          ref={menuRef}
          style={menuStyle}
          className="overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
        >
          <button
            type="button"
            className={`flex w-full px-3 py-2 text-left text-sm hover:bg-slate-50 ${
              !value ? 'bg-blue-50 text-blue-700' : 'text-slate-700'
            }`}
            onClick={() => selectCategory('')}
          >
            — Без категории —
          </button>
          {options.map((option) => (
            <div
              key={option.id}
              className={`flex items-center gap-1 border-t border-slate-100 ${
                value === option.name ? 'bg-blue-50' : ''
              }`}
            >
              <button
                type="button"
                className={`min-w-0 flex-1 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  value === option.name ? 'text-blue-700' : 'text-slate-700'
                }`}
                onClick={() => selectCategory(option.name)}
              >
                {option.name}
              </button>
              {!option.builtin && (
                <button
                  type="button"
                  className="shrink-0 px-2 py-2 text-xs text-red-600 hover:bg-red-50"
                  title="Удалить категорию"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(option)
                  }}
                >
                  Удалить
                </button>
              )}
            </div>
          ))}
          <div className="border-t border-slate-100 p-2">
            {creating ? (
              <div className="flex gap-2">
                <Input
                  className="min-w-0 flex-1"
                  autoFocus
                  placeholder="Название категории"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleCreate()
                    }
                  }}
                />
                <Button type="button" variant="secondary" onClick={handleCreate}>
                  OK
                </Button>
              </div>
            ) : (
              <button
                type="button"
                className="w-full rounded-md px-2 py-1.5 text-left text-sm text-blue-700 hover:bg-blue-50"
                onClick={() => setCreating(true)}
              >
                + Создать категорию
              </button>
            )}
          </div>
        </div>
      )}
      <p className="mt-1 text-xs text-slate-500">
        Удаление пользовательской категории не удаляет расходы — поле категории очищается.
      </p>
    </Field>
  )
}
