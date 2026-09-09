import type { AssistantPreference } from '~/types/editor'
import {
  DEFAULT_ASSISTANT_SKILLS,
  DEFAULT_ASSISTANT_TOOLS,
  DEFAULT_ASSISTANT_INSTRUCTION,
  normalizeAssistantPreference,
} from '~/utils/editorSettings'

const preferenceKey = 'assistant-settings'
const defaults = (): AssistantPreference => ({
  version: 1,
  userInstruction: DEFAULT_ASSISTANT_INSTRUCTION,
  enabledSkillIds: [...DEFAULT_ASSISTANT_SKILLS],
  enabledToolIds: [...DEFAULT_ASSISTANT_TOOLS],
})

export const useAssistantSettings = () => {
  const { loadPreference, savePreference } = useProjectRepository()
  const applied = useState<AssistantPreference>('assistant-settings-applied', defaults)
  const hydrated = useState<boolean>('assistant-settings-hydrated', () => false)

  const hydrate = async () => {
    if (!import.meta.client || hydrated.value) return
    try {
      applied.value = normalizeAssistantPreference(await loadPreference(preferenceKey))
    } catch {
      applied.value = defaults()
    } finally {
      hydrated.value = true
    }
  }

  const persist = async (value: AssistantPreference) => {
    const next = normalizeAssistantPreference(value)
    await savePreference(preferenceKey, next)
    applied.value = next
    return next
  }

  return { applied, hydrated, hydrate, persist, defaults }
}
