import type { ToolId, ToolboxPreference } from '~/types/editor'
import {
  defaultToolboxPreference,
  normalizeToolboxPreference,
  REQUIRED_TOOL_IDS,
} from '~/utils/editorSettings'

const preferenceKey = 'toolbox-settings'

export const useToolboxSettings = () => {
  const { loadPreference, savePreference } = useProjectRepository()
  const applied = useState<ToolboxPreference>('toolbox-settings-applied', defaultToolboxPreference)
  const hydrated = useState<boolean>('toolbox-settings-hydrated', () => false)

  const hydrate = async () => {
    if (!import.meta.client || hydrated.value) return
    try {
      applied.value = normalizeToolboxPreference(await loadPreference(preferenceKey))
    } catch {
      applied.value = defaultToolboxPreference()
    } finally {
      hydrated.value = true
    }
  }

  const persist = async (value: ToolboxPreference) => {
    const next = normalizeToolboxPreference(value)
    await savePreference(preferenceKey, next)
    applied.value = next
    return next
  }

  const visibleOrderedToolIds = computed(() =>
    applied.value.order.filter((id) => applied.value.visibleToolIds.includes(id)),
  )

  const isRequired = (id: ToolId) => REQUIRED_TOOL_IDS.includes(id)
  return {
    applied,
    hydrated,
    hydrate,
    persist,
    visibleOrderedToolIds,
    isRequired,
    defaults: defaultToolboxPreference,
  }
}
