import type {
  BudgetPreset,
  BudgetPresetData,
  BudgetPresetSummary,
  CreatePresetInput,
  PresetOwnerRef,
} from '../types/preset'

const OWNER_REFS_KEY = 'family-budget-preset-refs'

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string }
    return body.error ?? response.statusText
  } catch {
    return response.statusText
  }
}

export async function fetchPublicPresets(): Promise<BudgetPresetSummary[]> {
  const response = await fetch('/api/presets')
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

export async function fetchOwnedPresets(refs: PresetOwnerRef[]): Promise<BudgetPresetSummary[]> {
  const response = await fetch('/api/presets/mine', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      refs: refs.map(({ id, ownerToken }) => ({ id, ownerToken })),
    }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

export async function fetchPreset(id: string, ownerToken?: string): Promise<BudgetPreset> {
  const url = ownerToken
    ? `/api/presets/${encodeURIComponent(id)}?ownerToken=${encodeURIComponent(ownerToken)}`
    : `/api/presets/${encodeURIComponent(id)}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

export async function savePreset(input: CreatePresetInput): Promise<BudgetPreset> {
  const response = await fetch('/api/presets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

export async function updateSavedPreset(
  id: string,
  ownerToken: string,
  patch: Partial<CreatePresetInput>,
): Promise<BudgetPreset> {
  const response = await fetch(`/api/presets/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownerToken, ...patch }),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

export async function deleteSavedPreset(id: string, ownerToken: string): Promise<void> {
  const response = await fetch(`/api/presets/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ownerToken }),
  })
  if (!response.ok && response.status !== 204) {
    throw new Error(await parseError(response))
  }
}

export function readOwnerRefs(): PresetOwnerRef[] {
  try {
    const raw = localStorage.getItem(OWNER_REFS_KEY)
    if (!raw) return []
    return JSON.parse(raw) as PresetOwnerRef[]
  } catch {
    return []
  }
}

export function addOwnerRef(ref: PresetOwnerRef): void {
  const refs = readOwnerRefs().filter((item) => item.id !== ref.id)
  refs.unshift(ref)
  localStorage.setItem(OWNER_REFS_KEY, JSON.stringify(refs))
}

export function removeOwnerRef(id: string): void {
  const refs = readOwnerRefs().filter((item) => item.id !== id)
  localStorage.setItem(OWNER_REFS_KEY, JSON.stringify(refs))
}

export function findOwnerToken(id: string): string | undefined {
  return readOwnerRefs().find((item) => item.id === id)?.ownerToken
}

export function clonePresetData(data: BudgetPresetData): BudgetPresetData {
  return structuredClone(data)
}
