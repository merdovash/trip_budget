import type { InputHTMLAttributes, ButtonHTMLAttributes, SelectHTMLAttributes, ReactNode, ChangeEvent } from 'react'
import { useEffect, useState } from 'react'
import {
  DATE_RU_PLACEHOLDER,
  formatIsoToRu,
  maskRuDateInput,
  parseRuToIso,
} from '../../lib/format'

interface FieldProps {
  label: string
  children: ReactNode
  error?: string
  className?: string
}

export function Field({ label, children, error, className = '' }: FieldProps) {
  return (
    <label className={`block space-y-1 ${className}`}>
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {error && <span className="text-xs text-red-600">{error}</span>}
    </label>
  )
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className = '', ...rest } = props
  const widthClass =
    className.includes('w-') || className.includes('flex-1') || className.includes('flex-')
      ? ''
      : 'w-full'
  return (
    <input
      {...rest}
      className={`rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${widthClass} ${className}`}
    />
  )
}

interface DateInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  value: string
  onChange: (iso: string) => void
}

export function DateInput({ value, onChange, className = '', ...rest }: DateInputProps) {
  const [text, setText] = useState(() => formatIsoToRu(value))

  useEffect(() => {
    setText(value ? formatIsoToRu(value) : '')
  }, [value])

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const masked = maskRuDateInput(e.target.value)
    setText(masked)
    const iso = parseRuToIso(masked)
    if (iso !== null) onChange(iso)
  }

  function handleBlur() {
    if (!text.trim()) {
      onChange('')
      return
    }
    const iso = parseRuToIso(text)
    if (iso) {
      setText(formatIsoToRu(iso))
      onChange(iso)
      return
    }
    setText(value ? formatIsoToRu(value) : '')
  }

  const widthClass =
    className.includes('w-') || className.includes('flex-1') || className.includes('flex-')
      ? ''
      : 'w-full'

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={DATE_RU_PLACEHOLDER}
      maxLength={10}
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      className={`rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${widthClass} ${className}`}
    />
  )
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = '', ...rest } = props
  const widthClass =
    className.includes('w-') || className.includes('flex-1') || className.includes('flex-')
      ? ''
      : 'w-full'
  return (
    <select
      {...rest}
      className={`rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${widthClass} ${className}`}
    />
  )
}

export function Button({
  variant = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' }) {
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700',
    secondary: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
    danger: 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100',
  }
  return (
    <button
      {...props}
      className={`rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${variants[variant]} ${props.className ?? ''}`}
    />
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  )
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
      <p className="font-medium text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  )
}
