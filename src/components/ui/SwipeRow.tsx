import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from 'react'

const ACTION_WIDTH = 64
const ACTIONS_WIDTH = ACTION_WIDTH * 2
const CLOSE_EVENT = 'registry-swipe-close'

interface SwipeRowProps {
  children: ReactNode
  onEdit: () => void
  onRemove: () => void
  /** Tap on closed row content */
  onOpen?: () => void
  active?: boolean
  className?: string
}

export function SwipeRow({
  children,
  onEdit,
  onRemove,
  onOpen,
  active = false,
  className = '',
}: SwipeRowProps) {
  const id = useId()
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef(0)
  const startX = useRef(0)
  const startY = useRef(0)
  const startOffset = useRef(0)
  const axis = useRef<'x' | 'y' | null>(null)
  const onOpenRef = useRef(onOpen)

  useEffect(() => {
    offsetRef.current = offset
  }, [offset])

  useEffect(() => {
    onOpenRef.current = onOpen
  }, [onOpen])

  useEffect(() => {
    function onClose(event: Event) {
      const otherId = (event as CustomEvent<string>).detail
      if (otherId !== id) setOffset(0)
    }
    window.addEventListener(CLOSE_EVENT, onClose)
    return () => window.removeEventListener(CLOSE_EVENT, onClose)
  }, [id])

  useEffect(() => {
    setOffset(0)
  }, [active])

  useEffect(() => {
    const el = surfaceRef.current
    if (!el) return

    function clamp(value: number) {
      return Math.max(-ACTIONS_WIDTH, Math.min(0, value))
    }

    function snap(value: number) {
      return value < -ACTIONS_WIDTH / 2 ? -ACTIONS_WIDTH : 0
    }

    function broadcastClose() {
      window.dispatchEvent(new CustomEvent(CLOSE_EVENT, { detail: id }))
    }

    function onTouchStart(e: TouchEvent) {
      const touch = e.touches[0]
      if (!touch) return
      axis.current = null
      startX.current = touch.clientX
      startY.current = touch.clientY
      startOffset.current = offsetRef.current
      setDragging(true)
      broadcastClose()
    }

    function onTouchMove(e: TouchEvent) {
      const touch = e.touches[0]
      if (!touch) return
      const dx = touch.clientX - startX.current
      const dy = touch.clientY - startY.current

      if (axis.current === null) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
        axis.current = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      }
      if (axis.current === 'y') return

      e.preventDefault()
      setOffset(clamp(startOffset.current + dx))
    }

    function onTouchEnd() {
      setDragging(false)
      const wasTap = axis.current === null
      const next = snap(offsetRef.current)
      setOffset(next)
      axis.current = null

      if (wasTap && next === 0 && startOffset.current === 0) {
        onOpenRef.current?.()
      }
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd)
    el.addEventListener('touchcancel', onTouchEnd)
    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [id])

  function handleEdit(e: MouseEvent) {
    e.stopPropagation()
    setOffset(0)
    onEdit()
  }

  function handleRemove(e: MouseEvent) {
    e.stopPropagation()
    setOffset(0)
    onRemove()
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div className="absolute inset-y-0 right-0 flex" style={{ width: ACTIONS_WIDTH }} aria-hidden={offset === 0}>
        <button
          type="button"
          className="flex flex-col items-center justify-center gap-0.5 bg-slate-600 text-white"
          style={{ width: ACTION_WIDTH }}
          onClick={handleEdit}
          aria-label="Изменить"
        >
          <PencilIcon className="h-5 w-5" />
          <span className="text-[10px] font-medium">Изменить</span>
        </button>
        <button
          type="button"
          className="flex flex-col items-center justify-center gap-0.5 bg-red-600 text-white"
          style={{ width: ACTION_WIDTH }}
          onClick={handleRemove}
          aria-label="Удалить"
        >
          <TrashIcon className="h-5 w-5" />
          <span className="text-[10px] font-medium">Удалить</span>
        </button>
      </div>

      <div
        ref={surfaceRef}
        className={`relative touch-pan-y ${active ? 'bg-blue-50' : 'bg-white'} ${
          dragging ? '' : 'transition-transform duration-200 ease-out'
        }`}
        style={{ transform: `translateX(${offset}px)` }}
      >
        {children}
      </div>
    </div>
  )
}

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125"
      />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
      />
    </svg>
  )
}
