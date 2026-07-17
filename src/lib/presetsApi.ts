import type {
  BudgetPreset,
  BudgetPresetData,
  BudgetPresetSummary,
  CreatePresetInput,
} from '../types/preset'

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string }
    return body.error ?? response.statusText
  } catch {
    return response.statusText
  }
}

const jsonHeaders = { 'Content-Type': 'application/json' }

export async function fetchPublicPresets(): Promise<BudgetPresetSummary[]> {
  const response = await fetch('/api/presets', { credentials: 'include' })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

export async function fetchOwnedPresets(): Promise<BudgetPresetSummary[]> {
  const response = await fetch('/api/presets/mine', { credentials: 'include' })
  if (response.status === 401) return []
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

export async function fetchPreset(id: string): Promise<BudgetPreset> {
  const response = await fetch(`/api/presets/${encodeURIComponent(id)}`, {
    credentials: 'include',
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

export async function savePreset(input: CreatePresetInput): Promise<BudgetPreset> {
  const response = await fetch('/api/presets', {
    method: 'POST',
    credentials: 'include',
    headers: jsonHeaders,
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

export async function updateSavedPreset(
  id: string,
  patch: Partial<CreatePresetInput>,
): Promise<BudgetPreset> {
  const response = await fetch(`/api/presets/${encodeURIComponent(id)}`, {
    method: 'PUT',
    credentials: 'include',
    headers: jsonHeaders,
    body: JSON.stringify(patch),
  })
  if (!response.ok) throw new Error(await parseError(response))
  return response.json()
}

export async function deleteSavedPreset(id: string): Promise<void> {
  const response = await fetch(`/api/presets/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    credentials: 'include',
  })
  if (!response.ok && response.status !== 204) {
    throw new Error(await parseError(response))
  }
}

export function clonePresetData(data: BudgetPresetData): BudgetPresetData {
  return structuredClone(data)
}
