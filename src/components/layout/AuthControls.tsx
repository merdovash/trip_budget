import { useEffect, useState, type FormEvent } from 'react'
import { useAuthStore } from '../../store/authStore'
import { Button, Field, Input } from '../ui/FormControls'

export function AuthControls() {
  const user = useAuthStore((s) => s.user)
  const loading = useAuthStore((s) => s.loading)
  const error = useAuthStore((s) => s.error)
  const login = useAuthStore((s) => s.login)
  const register = useAuthStore((s) => s.register)
  const logout = useAuthStore((s) => s.logout)
  const clearError = useAuthStore((s) => s.clearError)

  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (!open) clearError()
  }, [open, clearError])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      if (mode === 'login') await login(email, password)
      else await register(email, password)
      setOpen(false)
      setPassword('')
    } catch {
      /* error in store */
    }
  }

  if (user) {
    return (
      <div className="space-y-2">
        <p className="truncate px-1 text-xs text-slate-500" title={user.email}>
          {user.email}
        </p>
        <Button type="button" variant="secondary" disabled={loading} onClick={() => logout()} className="w-full">
          Выйти
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {!open ? (
        <Button type="button" variant="secondary" onClick={() => setOpen(true)} className="w-full">
          Войти
        </Button>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="mb-3 flex gap-2">
            <Button
              type="button"
              variant={mode === 'login' ? 'primary' : 'secondary'}
              className="flex-1"
              onClick={() => setMode('login')}
            >
              Вход
            </Button>
            <Button
              type="button"
              variant={mode === 'register' ? 'primary' : 'secondary'}
              className="flex-1"
              onClick={() => setMode('register')}
            >
              Регистрация
            </Button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-3">
            <Field label="Email">
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Field label="Пароль">
              <Input
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </Field>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="secondary"
                className="flex-1"
                onClick={() => setOpen(false)}
              >
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={loading || !email.trim() || password.length < 6}
                className="flex-1"
              >
                {loading ? '…' : mode === 'login' ? 'Войти' : 'Создать'}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
