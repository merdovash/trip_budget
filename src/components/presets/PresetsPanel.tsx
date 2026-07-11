import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { COUNTRY_LABELS } from '../../tax/registry'
import {
  addOwnerRef,
  deleteSavedPreset,
  fetchOwnedPresets,
  fetchPreset,
  fetchPublicPresets,
  findOwnerToken,
  readOwnerRefs,
  removeOwnerRef,
  savePreset,
  updateSavedPreset,
} from '../../lib/presetsApi'
import { formatDateDisplay } from '../../lib/format'
import type { BudgetPresetSummary } from '../../types/preset'
import { useBudgetStore } from '../../store/budgetStore'
import { Button, Card, EmptyState, Field, Input } from '../ui/FormControls'

type Tab = 'public' | 'mine'

export function PresetsPanel() {
  const exportSnapshot = useBudgetStore((s) => s.exportSnapshot)
  const loadFromPreset = useBudgetStore((s) => s.loadFromPreset)

  const [tab, setTab] = useState<Tab>('public')
  const [publicPresets, setPublicPresets] = useState<BudgetPresetSummary[]>([])
  const [ownedPresets, setOwnedPresets] = useState<BudgetPresetSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [publicList, ownedList] = await Promise.all([
        fetchPublicPresets(),
        fetchOwnedPresets(readOwnerRefs()),
      ])
      setPublicPresets(publicList)
      setOwnedPresets(ownedList)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить наборы')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  async function handleSave(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const preset = await savePreset({
        name: name.trim(),
        description: description.trim(),
        isPrivate,
        data: exportSnapshot(),
      })
      addOwnerRef({ id: preset.id, ownerToken: preset.ownerToken, name: preset.name })
      setName('')
      setDescription('')
      setIsPrivate(false)
      await reload()
      setTab('mine')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить набор')
    } finally {
      setSaving(false)
    }
  }

  async function handleLoad(preset: BudgetPresetSummary) {
    setActionId(preset.id)
    setError(null)
    try {
      const ownerToken = findOwnerToken(preset.id)
      const full = await fetchPreset(preset.id, ownerToken)
      if (!confirm(`Загрузить набор «${full.name}»? Текущие данные будут заменены.`)) {
        return
      }
      loadFromPreset(full.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить набор')
    } finally {
      setActionId(null)
    }
  }

  async function handleTogglePrivacy(preset: BudgetPresetSummary) {
    const ownerToken = findOwnerToken(preset.id)
    if (!ownerToken) return
    setActionId(preset.id)
    setError(null)
    try {
      await updateSavedPreset(preset.id, ownerToken, { isPrivate: !preset.isPrivate })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить набор')
    } finally {
      setActionId(null)
    }
  }

  async function handleDelete(preset: BudgetPresetSummary) {
    const ownerToken = findOwnerToken(preset.id)
    if (!ownerToken) return
    if (!confirm(`Удалить набор «${preset.name}»?`)) return
    setActionId(preset.id)
    setError(null)
    try {
      await deleteSavedPreset(preset.id, ownerToken)
      removeOwnerRef(preset.id)
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить набор')
    } finally {
      setActionId(null)
    }
  }

  const list = tab === 'public' ? publicPresets : ownedPresets

  return (
    <div className="space-y-4">
      <Card>
        <h2 className="mb-4 text-lg font-semibold">Сохранить текущий набор</h2>
        <form onSubmit={handleSave} className="grid gap-3 md:grid-cols-2">
          <Field label="Название">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Семья в Барселоне"
              required
            />
          </Field>
          <Field label="Описание">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Кратко о составе набора"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              className="rounded border-slate-300"
            />
            Приватный набор (не показывать в публичном каталоге)
          </label>
          <p className="text-xs text-slate-500 md:col-span-2">
            По умолчанию наборы публичные и видны всем пользователям. Приватные доступны только
            вам по сохранённой ссылке доступа в этом браузере.
          </p>
          <div className="md:col-span-2">
            <Button type="submit" disabled={saving || !name.trim()}>
              {saving ? 'Сохранение…' : 'Сохранить набор'}
            </Button>
          </div>
        </form>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Сохранённые наборы</h2>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={tab === 'public' ? 'primary' : 'secondary'}
              onClick={() => setTab('public')}
            >
              Публичные
            </Button>
            <Button
              type="button"
              variant={tab === 'mine' ? 'primary' : 'secondary'}
              onClick={() => setTab('mine')}
            >
              Мои
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-slate-500">Загрузка…</p>
        ) : list.length === 0 ? (
          <EmptyState
            title={tab === 'public' ? 'Нет публичных наборов' : 'У вас пока нет сохранённых наборов'}
            description={
              tab === 'public'
                ? 'Сохраните свой набор или дождитесь появления примеров от других пользователей.'
                : 'Сохраните текущий бюджет — он появится здесь вместе с ключом доступа.'
            }
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {list.map((preset) => (
              <PresetCard
                key={preset.id}
                preset={preset}
                isMine={Boolean(findOwnerToken(preset.id))}
                busy={actionId === preset.id}
                onLoad={() => handleLoad(preset)}
                onTogglePrivacy={() => handleTogglePrivacy(preset)}
                onDelete={() => handleDelete(preset)}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function PresetCard({
  preset,
  isMine,
  busy,
  onLoad,
  onTogglePrivacy,
  onDelete,
}: {
  preset: BudgetPresetSummary
  isMine: boolean
  busy: boolean
  onLoad: () => void
  onTogglePrivacy: () => void
  onDelete: () => void
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">{preset.name}</h3>
          {preset.description && (
            <p className="mt-1 text-sm text-slate-600">{preset.description}</p>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
            preset.isPrivate
              ? 'bg-amber-100 text-amber-800'
              : 'bg-emerald-100 text-emerald-800'
          }`}
        >
          {preset.isPrivate ? 'Приватный' : 'Публичный'}
        </span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm text-slate-600">
        <div>
          <dt className="text-slate-500">Страна</dt>
          <dd>{COUNTRY_LABELS[preset.countryCode] ?? preset.countryCode}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Семья</dt>
          <dd>{preset.familySize} чел.</dd>
        </div>
        <div>
          <dt className="text-slate-500">Доходы / расходы</dt>
          <dd>
            {preset.incomeCount} / {preset.expenseCount}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Обновлён</dt>
          <dd>{formatDateDisplay(preset.updatedAt.slice(0, 10))}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={onLoad} disabled={busy}>
          Загрузить
        </Button>
        {isMine && (
          <>
            <Button type="button" variant="secondary" onClick={onTogglePrivacy} disabled={busy}>
              {preset.isPrivate ? 'Сделать публичным' : 'Сделать приватным'}
            </Button>
            <Button type="button" variant="danger" onClick={onDelete} disabled={busy}>
              Удалить
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
