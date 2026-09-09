import type { AppearancePreference } from '~/types/editor'
import { DEFAULT_APPEARANCE, deriveAppearanceTokens, normalizeAppearance } from '~/utils/appearance'

const preferenceKey = 'appearance-settings'
const cacheKey = 'zakape-appearance-settings'

const applyPreference = (preference: AppearancePreference) => {
  if (!import.meta.client) return
  const root = document.documentElement
  root.dataset.theme = preference.theme
  for (const [name, value] of Object.entries(deriveAppearanceTokens(preference))) {
    root.style.setProperty(name, value)
  }
}

const readCache = (): AppearancePreference | null => {
  if (!import.meta.client) return null
  try {
    const value = JSON.parse(localStorage.getItem(cacheKey) ?? 'null')
    return value ? normalizeAppearance(value) : null
  } catch {
    return null
  }
}

export const useAppearanceSettings = () => {
  const { loadPreference, savePreference } = useProjectRepository()
  const applied = useState<AppearancePreference>('appearance-applied', () => ({
    ...DEFAULT_APPEARANCE,
  }))
  const hydrated = useState<boolean>('appearance-hydrated', () => false)
  const hydrating = useState<boolean>('appearance-hydrating', () => false)

  const apply = (preference: AppearancePreference) => {
    applied.value = normalizeAppearance(preference)
    applyPreference(applied.value)
    if (import.meta.client) localStorage.setItem(cacheKey, JSON.stringify(applied.value))
  }

  const hydrate = async () => {
    if (!import.meta.client || hydrated.value || hydrating.value) return
    hydrating.value = true
    const cached = readCache()
    if (cached) apply(cached)
    try {
      const stored = await loadPreference<AppearancePreference>(preferenceKey)
      const next = stored ? normalizeAppearance(stored) : (cached ?? { ...DEFAULT_APPEARANCE })
      apply(next)
      if (!stored) await savePreference(preferenceKey, next)
    } catch {
      apply(cached ?? DEFAULT_APPEARANCE)
    } finally {
      hydrated.value = true
      hydrating.value = false
    }
  }

  const persist = async (preference: AppearancePreference) => {
    const next = normalizeAppearance(preference)
    await savePreference(preferenceKey, next)
    apply(next)
  }

  return { applied, hydrated, hydrate, apply, persist, defaults: () => ({ ...DEFAULT_APPEARANCE }) }
}
