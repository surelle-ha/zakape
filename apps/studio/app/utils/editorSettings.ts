import type {
  AssistantPreference,
  AssistantSkillId,
  AssistantToolId,
  ToolId,
  ToolboxPreference,
} from '~/types/editor'
import { ASSISTANT_SKILLS, ASSISTANT_TOOL_CATALOG } from '~/utils/assistantSkills'
import { toolDefinitions } from '~/utils/commands'

export const DEFAULT_ASSISTANT_INSTRUCTION = `Work like a careful pixel-art editor. Preserve the existing silhouette and native pixel scale unless the request explicitly changes them. Use a small intentional palette, hard pixel clusters, and one clear light direction. Inspect the current artwork before editing, make the smallest useful change, and review every affected frame and layer for stray pixels, broken silhouettes, and inconsistent timing. Never use anti-aliasing or introduce unrequested colors.`

export const REQUIRED_TOOL_IDS: ToolId[] = ['pencil', 'eraser', 'hand']
export const DEFAULT_ASSISTANT_SKILLS: AssistantSkillId[] = ASSISTANT_SKILLS.map(
  (skill) => skill.id,
)
export const DEFAULT_ASSISTANT_TOOLS: AssistantToolId[] = ASSISTANT_TOOL_CATALOG.map(
  (tool) => tool.name,
)

const uniqueKnown = <T extends string>(values: unknown, known: readonly T[]) => {
  const knownSet = new Set(known)
  if (!Array.isArray(values)) return [] as T[]
  return [
    ...new Set(
      values.filter((value): value is T => typeof value === 'string' && knownSet.has(value as T)),
    ),
  ]
}

const sanitizeInstruction = (value: string) =>
  [...value]
    .filter((character) => {
      const code = character.charCodeAt(0)
      return code >= 32 || code === 9 || code === 10 || code === 13
    })
    .join('')
    .trim()
    .slice(0, 4000)

export const normalizeAssistantPreference = (value: unknown): AssistantPreference => {
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  if (
    !record ||
    record.version !== 1 ||
    !Array.isArray(record.enabledSkillIds) ||
    !Array.isArray(record.enabledToolIds)
  ) {
    return {
      version: 1,
      userInstruction: DEFAULT_ASSISTANT_INSTRUCTION,
      enabledSkillIds: [...DEFAULT_ASSISTANT_SKILLS],
      enabledToolIds: [...DEFAULT_ASSISTANT_TOOLS],
    }
  }
  const skills = uniqueKnown(record.enabledSkillIds, DEFAULT_ASSISTANT_SKILLS)
  const tools = uniqueKnown(record.enabledToolIds, DEFAULT_ASSISTANT_TOOLS)
  return {
    version: 1,
    userInstruction:
      typeof record.userInstruction === 'string'
        ? sanitizeInstruction(record.userInstruction) || DEFAULT_ASSISTANT_INSTRUCTION
        : DEFAULT_ASSISTANT_INSTRUCTION,
    enabledSkillIds: skills.length ? skills : ['fix'],
    enabledToolIds: tools.includes('set_pixels') ? tools : [...tools, 'set_pixels'],
  }
}

export const normalizeToolboxPreference = (value: unknown): ToolboxPreference => {
  const known = toolDefinitions.map((tool) => tool.id)
  const record =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null
  if (
    !record ||
    record.version !== 1 ||
    !Array.isArray(record.order) ||
    !Array.isArray(record.visibleToolIds)
  ) {
    return {
      version: 1,
      knownToolIds: [...known],
      order: [...known],
      visibleToolIds: [...known],
    }
  }
  const storedKnown = uniqueKnown(record.knownToolIds, known)
  const knownToolIds = [...new Set([...storedKnown, ...known])]
  const storedOrder = uniqueKnown(record.order, knownToolIds)
  const order = [...storedOrder, ...knownToolIds.filter((id) => !storedOrder.includes(id))]
  const storedVisible = uniqueKnown(record.visibleToolIds, knownToolIds)
  const visibleToolIds = [...new Set([...REQUIRED_TOOL_IDS, ...storedVisible])].filter((id) =>
    knownToolIds.includes(id),
  )
  return { version: 1, knownToolIds, order, visibleToolIds }
}

export const defaultToolboxPreference = (): ToolboxPreference =>
  normalizeToolboxPreference({
    version: 1,
    knownToolIds: toolDefinitions.map((tool) => tool.id),
    order: toolDefinitions.map((tool) => tool.id),
    visibleToolIds: toolDefinitions.map((tool) => tool.id),
  })

export const assistantToolEnabled = (preference: AssistantPreference, id: AssistantToolId) =>
  preference.enabledToolIds.includes(id) || id === 'set_pixels'
