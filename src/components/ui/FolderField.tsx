import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { ExpenseFolder } from '../../types/budget'
import { Button, Field, Input } from './FormControls'

export interface FolderFieldProps {
  value: string | undefined
  onChange: (folderId: string) => void
  folders: ExpenseFolder[]
  onAddFolder: (name: string) => string
  onRemoveFolder: (id: string) => void
  deleteHint?: string
}

export function FolderField({
  value,
  onChange,
  folders,
  onAddFolder,
  onRemoveFolder,
  deleteHint = 'Удаление папки не удаляет статьи — они переходят в «Без папки».',
}: FolderFieldProps) {
  const [open, setOpen] = useState(false)
  const [openUp, setOpenUp] = useState(false)
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({})
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const selectedLabel =
    value && folders.find((f) => f.id === value)
      ? folders.find((f) => f.id === value)!.name
      : 'Без папки'

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
  }, [open, folders.length, creating])

  function selectFolder(folderId: string) {
    onChange(folderId)
    setOpen(false)
    setCreating(false)
    setNewName('')
  }

  function handleCreate() {
    const trimmed = newName.trim()
    if (!trimmed) return
    const id = onAddFolder(trimmed)
    onChange(id)
    setNewName('')
    setCreating(false)
    setOpen(false)
  }

  function handleDelete(folderId: string) {
    if (value === folderId) onChange('')
    onRemoveFolder(folderId)
  }

  function toggleOpen() {
    setOpen((prev) => {
      if (prev) {
        setCreating(false)
        setNewName('')
        return false
      }
      return true
    })
  }

  return (
    <Field label="Папка">
      <div ref={rootRef} className="relative">
        <button
          type="button"
          className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          onClick={toggleOpen}
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
            onClick={() => selectFolder('')}
          >
            Без папки
          </button>
          {folders.map((folder) => (
            <div
              key={folder.id}
              className={`flex items-center gap-1 border-t border-slate-100 ${
                value === folder.id ? 'bg-blue-50' : ''
              }`}
            >
              <button
                type="button"
                className={`min-w-0 flex-1 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                  value === folder.id ? 'text-blue-700' : 'text-slate-700'
                }`}
                onClick={() => selectFolder(folder.id)}
              >
                {folder.name}
              </button>
              <button
                type="button"
                className="shrink-0 px-2 py-2 text-xs text-red-600 hover:bg-red-50"
                title="Удалить папку"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(folder.id)
                }}
              >
                Удалить
              </button>
            </div>
          ))}
          <div className="border-t border-slate-100 p-2">
            {creating ? (
              <div className="flex gap-2">
                <Input
                  className="min-w-0 flex-1"
                  autoFocus
                  placeholder="Название папки"
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
                + Создать папку
              </button>
            )}
          </div>
        </div>
      )}
      <p className="mt-1 text-xs text-slate-500">{deleteHint}</p>
    </Field>
  )
}
