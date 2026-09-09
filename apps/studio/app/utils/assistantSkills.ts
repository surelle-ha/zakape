import type { AssistantEditScope, AssistantSkillId, AssistantToolId } from '~/types/editor'

export interface AssistantSkillDefinition {
  id: AssistantSkillId
  label: string
  description: string
  prompt: string
  recommendedScope: AssistantEditScope
}

export const ASSISTANT_SKILLS: readonly AssistantSkillDefinition[] = [
  {
    id: 'generate',
    label: 'Generate',
    description: 'Build a readable sprite or prop from deliberate pixel clusters.',
    prompt:
      'Create the requested subject from a clear silhouette, a limited palette, and a single light direction. Prefer editing the active layer; add one named layer only when separation is useful.',
    recommendedScope: 'frame',
  },
  {
    id: 'animate',
    label: 'Animate',
    description: 'Create strong key poses with intentional timing and consistent volumes.',
    prompt:
      'Treat the sheet as an animation sequence. Use the fewest strong key poses, preserve landmarks and volume, and set purposeful frame durations for anticipation, action, impact, and recovery.',
    recommendedScope: 'sheet',
  },
  {
    id: 'inbetween',
    label: 'Inbetween',
    description: 'Bridge existing poses without making the motion mushy.',
    prompt:
      'Use surrounding frames as immutable pose references. Add or repair only the transition poses needed to clarify the motion arc, spacing, and timing.',
    recommendedScope: 'sheet',
  },
  {
    id: 'restyle',
    label: 'Restyle',
    description: 'Change palette or rendering language while preserving the subject.',
    prompt:
      'Preserve the subject, pose, proportions, and native pixel scale. Change only the requested palette, outline, shading, or texture language, with no anti-aliasing or palette bloat.',
    recommendedScope: 'frame',
  },
  {
    id: 'fix',
    label: 'Fix',
    description: 'Repair silhouette, clusters, palette, timing, or frame consistency.',
    prompt:
      'Diagnose concrete defects first, then make the smallest corrections. Prioritize silhouette readability, clean clusters, consistent outlines, stable volumes, and intentional frame timing.',
    recommendedScope: 'frame',
  },
  {
    id: 'extend',
    label: 'Extend',
    description: 'Add details, effects, frames, or layers without flattening the original.',
    prompt:
      'Extend the existing artwork without repainting what already works. Reuse its palette and visual grammar, and isolate additive effects or details on a named layer when useful.',
    recommendedScope: 'frame',
  },
] as const

export const assistantSkill = (id: AssistantSkillId): AssistantSkillDefinition =>
  ASSISTANT_SKILLS.find((skill) => skill.id === id) ?? ASSISTANT_SKILLS[4]!

export interface AssistantToolDefinition {
  name: AssistantToolId
  purpose: string
  required?: boolean
}

export const ASSISTANT_TOOL_CATALOG: readonly AssistantToolDefinition[] = [
  {
    name: 'set_pixels',
    purpose: 'Place or erase exact pixels for contours, clusters, highlights, and cleanup.',
    required: true,
  },
  {
    name: 'fill_rect',
    purpose: 'Fill a genuinely rectangular region with one palette color or transparency.',
  },
  {
    name: 'outline_rect',
    purpose: 'Draw a one-pixel rectangular outline.',
  },
  {
    name: 'replace_palette_color',
    purpose: 'Replace one exact color on one editable cel without flattening layers.',
  },
  {
    name: 'translate_region',
    purpose: 'Move or copy a rectangular pixel region by an integer offset.',
  },
  {
    name: 'flip_region',
    purpose: 'Mirror a rectangular region horizontally or vertically at native resolution.',
  },
  {
    name: 'create_layer',
    purpose: 'Create one editable transparent layer across all frames.',
  },
  {
    name: 'create_frame',
    purpose: 'Create a blank or copied animation frame at an intentional sequence position.',
  },
  {
    name: 'set_frame_duration',
    purpose: 'Set an existing or newly created frame hold between 40 and 10,000 ms.',
  },
] as const
