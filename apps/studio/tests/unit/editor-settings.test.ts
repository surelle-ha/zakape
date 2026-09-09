import { describe, expect, it } from 'vitest'
import { toolDefinitions } from '../../app/utils/commands'
import {
  DEFAULT_ASSISTANT_SKILLS,
  DEFAULT_ASSISTANT_TOOLS,
  normalizeAssistantPreference,
  normalizeToolboxPreference,
} from '../../app/utils/editorSettings'

describe('editor settings contracts', () => {
  it('uses complete defaults for missing assistant settings', () => {
    const value = normalizeAssistantPreference(null)
    expect(value.enabledSkillIds).toEqual(DEFAULT_ASSISTANT_SKILLS)
    expect(value.enabledToolIds).toEqual(DEFAULT_ASSISTANT_TOOLS)
  })

  it('bounds instructions and preserves required assistant capability', () => {
    const value = normalizeAssistantPreference({
      version: 1,
      userInstruction: `\u0000 ${'x'.repeat(5000)}`,
      enabledSkillIds: [],
      enabledToolIds: ['create_frame', 'unknown'],
    })
    expect(value.userInstruction).toHaveLength(4000)
    expect(value.enabledSkillIds).toEqual(['fix'])
    expect(value.enabledToolIds).toEqual(['create_frame', 'set_pixels'])
  })

  it('normalizes toolbox IDs while forcing core tools visible', () => {
    const value = normalizeToolboxPreference({
      version: 1,
      knownToolIds: ['line', 'pencil', 'retired'],
      order: ['line', 'line', 'retired'],
      visibleToolIds: ['line', 'retired'],
    })
    expect(value.order[0]).toBe('line')
    expect(value.order).toHaveLength(toolDefinitions.length)
    expect(new Set(value.order).size).toBe(toolDefinitions.length)
    expect(value.visibleToolIds).toEqual(
      expect.arrayContaining(['pencil', 'eraser', 'hand', 'line']),
    )
    expect(value.visibleToolIds).not.toContain('retired')
  })

  it('shows every current tool for a first-run preference', () => {
    const value = normalizeToolboxPreference(undefined)
    expect(value.visibleToolIds).toEqual(toolDefinitions.map((tool) => tool.id))
  })
})
