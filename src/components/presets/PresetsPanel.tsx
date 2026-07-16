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
import { formatDateTimeDisplay } from '../../lib/format'
import type { BudgetPresetSummary } from '../../types/preset'
import { useBudgetStore } from '../../store/budgetStore'
import { Button, Card, EmptyState, Field, Input, Select } from '../ui/FormControls'

type Tab = 'public' | 'mine'
type SaveMode = 'new' | 'existing'

export function PresetsPanel() {
  const exportSnapshot = useBudgetStore((s) => s.exportSnapshot)
  const loadFromPreset = useBudgetStore((s) => s.loadFromPreset)
  const activePreset = useBudgetStore((s) => s.activePreset)
  const hasUnsavedPresetChanges = useBudgetStore((s) => s.hasUnsavedPresetChanges)
  const canUpdateActivePreset = useBudgetStore((s) => s.canUpdateActivePreset)
  const markPresetSaved = useBudgetStore((s) => s.markPresetSaved)
  const setActivePreset = useBudgetStore((s) => s.setActivePreset)
  const clearActivePreset = useBudgetStore((s) => s.clearActivePreset)

  const [tab, setTab] = useState<Tab>('public')
  const [saveMode, setSaveMode] = useState<SaveMode>('new')
  const [publicPresets, setPublicPresets] = useState<BudgetPresetSummary[]>([])
  const [ownedPresets, setOwnedPresets] = useState<BudgetPresetSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [overwriteTargetId, setOverwriteTargetId] = useState('')

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

  useEffect(() => {
    if (overwriteTargetId) return
    if (activePreset?.ownerToken && ownedPresets.some((p) => p.id === activePreset.id)) {
      setOverwriteTargetId(activePreset.id)
      return
    }
    if (ownedPresets.length > 0) {
      setOverwriteTargetId(ownedPresets[0].id)
    }
  }, [activePreset, ownedPresets, overwriteTargetId])

  async function handleSaveNew(e: FormEvent) {
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
      setActivePreset({
        id: preset.id,
        name: preset.name,
        ownerToken: preset.ownerToken,
      })
      markPresetSaved()
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

  async function handleOverwriteExisting(targetId?: string) {
    const id = targetId ?? overwriteTargetId
    const target = ownedPresets.find((p) => p.id === id)
    const ownerToken = findOwnerToken(id)
    if (!target || !ownerToken) return

    if (
      !confirm(
        `Сохранить текущие данные в набор «${target.name}»? Содержимое набора будет полностью заменено.`,
      )
    ) {
      return
    }

    setSaving(true)
    setError(null)
    try {
      await updateSavedPreset(id, ownerToken, { data: exportSnapshot() })
      setActivePreset({ id, name: target.name, ownerToken })
      markPresetSaved()
      await reload()
      setTab('mine')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось обновить набор')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveToActivePreset() {
    if (!activePreset?.ownerToken) return
    await handleOverwriteExisting(activePreset.id)
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
      loadFromPreset(full.data, {
        id: full.id,
        name: full.name,
        ownerToken,
      })
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
      if (activePreset?.id === preset.id) {
        clearActivePreset()
      }
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить набор')
    } finally {
      setActionId(null)
    }
  }

  const list = tab === 'public' ? publicPresets : ownedPresets
  const unsaved = hasUnsavedPresetChanges()
  const overwriteTarget = ownedPresets.find((p) => p.id === overwriteTargetId)

  return (
    <div className="space-y-4">
      {activePreset && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            unsaved
              ? 'border-amber-200 bg-amber-50 text-amber-900'
              : 'border-slate-200 bg-slate-50 text-slate-700'
          }`}
        >
          <p className="font-medium">
            Текущий набор: {activePreset.name}
            {unsaved ? ' · есть несохранённые изменения' : ' · сохранён'}
          </p>
          <p className="mt-1 text-xs opacity-80">
            Редактирование не меняет сохранённый набор автоматически. Сохраните явно — в этот
            набор или как новую конфигурацию.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {canUpdateActivePreset() && (
              <Button type="button" disabled={saving || !unsaved} onClick={handleSaveToActivePreset}>
                Сохранить в «{activePreset.name}»
              </Button>
            )}
            <Button type="button" variant="secondary" onClick={clearActivePreset}>
              Отвязать набор
            </Button>
          </div>
          {!canUpdateActivePreset() && (
            <p className="mt-2 text-xs opacity-80">
              Это чужой или публичный набор без ключа доступа — перезаписать нельзя, только
              сохранить копию как новый.
            </p>
          )}
        </div>
      )}

      <Card>
        <h2 className="mb-4 text-lg font-semibold">Сохранить текущие данные</h2>
        <div className="mb-4 flex gap-2">
          <Button
            type="button"
            variant={saveMode === 'new' ? 'primary' : 'secondary'}
            onClick={() => setSaveMode('new')}
          >
            Новая конфигурация
          </Button>
          <Button
            type="button"
            variant={saveMode === 'existing' ? 'primary' : 'secondary'}
            onClick={() => setSaveMode('existing')}
          >
            В существующий набор
          </Button>
        </div>

        {saveMode === 'new' ? (
          <form onSubmit={handleSaveNew} className="grid min-w-0 gap-3 [&>*]:min-w-0 md:grid-cols-2">
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
              Создаётся новый набор; существующие не изменяются.
            </p>
            <div className="md:col-span-2">
              <Button type="submit" disabled={saving || !name.trim()}>
                {saving ? 'Сохранение…' : 'Сохранить как новый набор'}
              </Button>
            </div>
          </form>
        ) : ownedPresets.length === 0 ? (
          <EmptyState
            title="Нет ваших наборов для перезаписи"
            description="Сначала сохраните конфигурацию как новый набор или загрузите свой сохранённый ранее."
          />
        ) : (
          <div className="grid gap-3 md:max-w-lg">
            <Field label="Набор для перезаписи">
              <Select
                value={overwriteTargetId}
                onChange={(e) => setOverwriteTargetId(e.target.value)}
              >
                {ownedPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </Select>
            </Field>
            {overwriteTarget && (
              <p className="text-xs text-slate-500">
                Будет заменено: {overwriteTarget.incomeCount} доходов,{' '}
                {overwriteTarget.expenseCount} расходов · обновлён{' '}
                {formatDateTimeDisplay(overwriteTarget.updatedAt)}
              </p>
            )}
            <Button
              type="button"
              disabled={saving || !overwriteTargetId}
              onClick={() => handleOverwriteExisting()}
            >
              {saving ? 'Сохранение…' : 'Сохранить в выбранный набор'}
            </Button>
          </div>
        )}
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
                isActive={activePreset?.id === preset.id}
                hasUnsaved={activePreset?.id === preset.id && unsaved}
                busy={actionId === preset.id}
                onLoad={() => handleLoad(preset)}
                onSave={() => handleOverwriteExisting(preset.id)}
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
  isActive,
  hasUnsaved,
  busy,
  onLoad,
  onSave,
  onTogglePrivacy,
  onDelete,
}: {
  preset: BudgetPresetSummary
  isMine: boolean
  isActive: boolean
  hasUnsaved: boolean
  busy: boolean
  onLoad: () => void
  onSave: () => void
  onTogglePrivacy: () => void
  onDelete: () => void
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        isActive ? 'border-blue-300 bg-blue-50/50' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-900">
            {preset.name}
            {isActive && (
              <span className="ml-2 text-xs font-normal text-blue-600">
                {hasUnsaved ? '· не сохранён' : '· активный'}
              </span>
            )}
          </h3>
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
          <dd>{formatDateTimeDisplay(preset.updatedAt)}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button type="button" onClick={onLoad} disabled={busy}>
          Загрузить
        </Button>
        {isMine && (
          <>
            <Button type="button" variant="secondary" onClick={onSave} disabled={busy}>
              Сохранить сюда
            </Button>
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
