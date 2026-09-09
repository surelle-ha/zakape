import { describe, expect, it } from 'vitest'
import {
  assistantSystemPrompt,
  createCompatibleChatMessages,
  createAssistantMessages,
  createOllamaChatBody,
  mapOllamaError,
  mapCodexCliError,
  normalizeCompatibleBaseUrl,
  normalizeCompatibleModels,
  normalizeOllamaBaseUrl,
  normalizeOllamaModels,
  readCompatibleChatContent,
  readOllamaChatContent,
  validateProposal,
} from '~/composables/useAiAssistant'
import { createDemoProject } from '~/utils/project'
import { applyAssistantChanges } from '~/utils/assistant'
import { ASSISTANT_SKILLS, ASSISTANT_TOOL_CATALOG } from '~/utils/assistantSkills'
import { assistantVisionScale, planAssistantVision } from '~/utils/assistantVision'

describe('assistant proposal validation', () => {
  const context = {
    width: 16,
    height: 16,
    knownFrameIds: ['frame_1', 'frame_2'],
    knownLayerIds: ['layer_1', 'layer_2'],
    targetFrameIds: ['frame_1'],
    editableLayerIds: ['layer_1'],
  }

  it('accepts the bounded edit language', () => {
    const proposal = validateProposal(
      {
        summary: 'Add a small highlight.',
        actions: [],
        edits: [
          {
            layer_id: 'layer_1',
            frame_id: 'frame_1',
            operations: [
              { type: 'set_pixels', pixels: [{ x: 2, y: 3, color: '#FFD36A' }] },
              { type: 'outline_rect', x: 4, y: 4, width: 3, height: 3, color: '#ff875f' },
              {
                type: 'translate_region',
                x: 1,
                y: 1,
                width: 3,
                height: 3,
                offset_x: 2,
                offset_y: 0,
                mode: 'copy',
              },
              { type: 'flip_region', x: 8, y: 8, width: 4, height: 4, axis: 'horizontal' },
            ],
          },
        ],
        review_notes: ['The highlight reads clearly at native size.'],
        ready: true,
      },
      context,
    )

    expect(proposal.edits[0]!.operations).toHaveLength(4)
    expect(proposal.edits[0]!.operations[0]).toMatchObject({
      type: 'set_pixels',
      pixels: [{ x: 2, y: 3, color: '#ffd36a' }],
    })
    expect(proposal.ready).toBe(true)
  })

  it('rejects region tools that leave the canvas', () => {
    expect(() =>
      validateProposal(
        {
          summary: 'Move the pose outside the canvas.',
          actions: [],
          edits: [
            {
              layer_id: 'layer_1',
              frame_id: 'frame_1',
              operations: [
                {
                  type: 'translate_region',
                  x: 12,
                  y: 12,
                  width: 4,
                  height: 4,
                  offset_x: 1,
                  offset_y: 0,
                  mode: 'move',
                },
              ],
            },
          ],
          review_notes: [],
          ready: false,
        },
        context,
      ),
    ).toThrow(/invalid region translation/)
  })

  it('rejects out-of-bounds edits', () => {
    expect(() =>
      validateProposal(
        {
          summary: 'Escape the canvas.',
          actions: [],
          edits: [
            {
              layer_id: 'layer_1',
              frame_id: 'frame_1',
              operations: [{ type: 'set_pixels', pixels: [{ x: 32, y: 1, color: '#fff' }] }],
            },
          ],
          review_notes: [],
          ready: false,
        },
        context,
      ),
    ).toThrow(/out-of-bounds/)
  })

  it('enforces the pixel budget across repeated edits to one frame', () => {
    expect(() =>
      validateProposal(
        {
          summary: 'Replace too many full cels.',
          actions: [],
          edits: Array.from({ length: 3 }, () => ({
            layer_id: 'layer_1',
            frame_id: 'frame_1',
            operations: [{ type: 'replace_palette_color', from: '#000000', to: '#ffffff' }],
          })),
          review_notes: [],
          ready: false,
        },
        context,
      ),
    ).toThrow(/across its editable layers/)
  })

  it('rejects unknown operations', () => {
    expect(() =>
      validateProposal(
        {
          summary: 'Run code.',
          actions: [],
          edits: [
            {
              layer_id: 'layer_1',
              frame_id: 'frame_1',
              operations: [{ type: 'shell', command: 'whoami' }],
            },
          ],
          review_notes: [],
          ready: false,
        },
        context,
      ),
    ).toThrow(/Unsupported/)
  })

  it('rejects operations and project actions disabled in Assistant Settings', () => {
    expect(() =>
      validateProposal(
        {
          summary: 'Use a disabled fill.',
          actions: [],
          edits: [
            {
              layer_id: 'layer_1',
              frame_id: 'frame_1',
              operations: [
                { type: 'fill_rect', x: 1, y: 1, width: 2, height: 2, color: '#ffffff' },
              ],
            },
          ],
          review_notes: [],
          ready: false,
        },
        { ...context, enabledToolIds: ['set_pixels'] },
      ),
    ).toThrow(/fill rect is disabled/)

    expect(() =>
      validateProposal(
        {
          summary: 'Create a disabled layer.',
          actions: [{ type: 'create_layer', layer_id: 'new_layer_fx', name: 'FX' }],
          edits: [],
          review_notes: [],
          ready: false,
        },
        { ...context, enabledToolIds: ['set_pixels'] },
      ),
    ).toThrow(/Layer creation is disabled/)
  })

  it('allows safe layer and frame creation while rejecting reference-frame edits', () => {
    expect(() =>
      validateProposal(
        {
          summary: 'Touch a reference frame.',
          actions: [],
          edits: [{ layer_id: 'layer_1', frame_id: 'frame_2', operations: [] }],
          review_notes: [],
          ready: false,
        },
        context,
      ),
    ).toThrow(/reference-only/)

    const proposal = validateProposal(
      {
        summary: 'Add an impact frame on a separate effects layer.',
        actions: [
          { type: 'create_layer', layer_id: 'new_layer_fx', name: 'FX' },
          {
            type: 'create_frame',
            frame_id: 'new_frame_impact',
            name: 'Impact',
            duration_ms: 80,
            after_frame_id: 'frame_1',
            copy_from_frame_id: 'frame_1',
          },
          { type: 'set_frame_duration', frame_id: 'new_frame_impact', duration_ms: 95 },
        ],
        edits: [
          {
            layer_id: 'new_layer_fx',
            frame_id: 'new_frame_impact',
            operations: [{ type: 'set_pixels', pixels: [{ x: 8, y: 8, color: '#fff1bd' }] }],
          },
        ],
        review_notes: ['Impact silhouette remains readable.'],
        ready: true,
      },
      context,
    )
    expect(proposal.actions).toHaveLength(3)
    expect(proposal.edits[0]).toMatchObject({
      frameId: 'new_frame_impact',
      layerId: 'new_layer_fx',
    })
  })
})

describe('assistant project changes', () => {
  it('registers assistant colors in an initially empty indexed palette', () => {
    const project = createDemoProject()
    project.colorMode = 'indexed'
    project.palette = []
    const frameId = project.frames[0]!.id
    const layer = project.layers[0]!

    applyAssistantChanges(
      project,
      [],
      [
        {
          frameId,
          layerId: layer.id,
          operations: [{ type: 'set_pixels', pixels: [{ x: 0, y: 0, color: '#22aaff' }] }],
        },
      ],
    )

    expect(project.palette).toEqual(['#22aaff'])
    expect(layer.cels[frameId]![0]).toBe('#22aaff')
  })

  it('creates blank layers and copied frames before applying their edits', () => {
    const project = createDemoProject()
    const sourceFrameId = project.frames[0]!.id
    const result = applyAssistantChanges(
      project,
      [
        { type: 'create_layer', layerId: 'new_layer_fx', name: 'FX' },
        {
          type: 'create_frame',
          frameId: 'new_frame_impact',
          name: 'Impact',
          duration: 80,
          afterFrameId: sourceFrameId,
          copyFromFrameId: sourceFrameId,
        },
        { type: 'set_frame_duration', frameId: 'new_frame_impact', duration: 95 },
      ],
      [
        {
          layerId: 'new_layer_fx',
          frameId: 'new_frame_impact',
          operations: [{ type: 'set_pixels', pixels: [{ x: 2, y: 2, color: '#f0abfc' }] }],
        },
      ],
    )

    expect(result).toEqual({
      framesCreated: 1,
      layersCreated: 1,
      durationsChanged: 1,
      editedCels: 1,
    })
    expect(project.frames[1]).toMatchObject({ id: 'new_frame_impact', duration: 95 })
    const layer = project.layers.find((item) => item.id === 'new_layer_fx')!
    expect(layer.cels[sourceFrameId]!.every((pixel) => pixel === null)).toBe(true)
    expect(layer.cels.new_frame_impact![2 * project.width + 2]).toBe('#f0abfc')
  })

  it('moves and flips regions from stable pixel snapshots', () => {
    const project = createDemoProject()
    const frameId = project.frames[0]!.id
    const layer = project.layers[0]!
    layer.cels[frameId]!.fill(null)
    layer.cels[frameId]![1 * project.width + 1] = '#112233'
    layer.cels[frameId]![1 * project.width + 2] = '#445566'

    applyAssistantChanges(
      project,
      [],
      [
        {
          frameId,
          layerId: layer.id,
          operations: [
            {
              type: 'translate_region',
              x: 1,
              y: 1,
              width: 2,
              height: 1,
              offsetX: 2,
              offsetY: 0,
              mode: 'move',
            },
            { type: 'flip_region', x: 3, y: 1, width: 2, height: 1, axis: 'horizontal' },
          ],
        },
      ],
    )

    expect(layer.cels[frameId]![1 * project.width + 1]).toBeNull()
    expect(layer.cels[frameId]![1 * project.width + 2]).toBeNull()
    expect(layer.cels[frameId]![1 * project.width + 3]).toBe('#445566')
    expect(layer.cels[frameId]![1 * project.width + 4]).toBe('#112233')
  })
})

describe('Ollama provider adapter', () => {
  it('accepts loopback URLs and rejects remote hosts or arbitrary paths', () => {
    expect(normalizeOllamaBaseUrl('http://localhost:11434/')).toBe('http://localhost:11434')
    expect(normalizeOllamaBaseUrl('http://[::1]:11434')).toBe('http://[::1]:11434')
    expect(() => normalizeOllamaBaseUrl('http://192.168.1.20:11434')).toThrow(/loopback/)
    expect(() => normalizeOllamaBaseUrl('https://models.example.com')).toThrow(/loopback/)
    expect(() => normalizeOllamaBaseUrl('http://127.0.0.1:11434/v1')).toThrow(/loopback/)
  })

  it('normalizes installed Ollama models and compatible model lists', () => {
    expect(normalizeCompatibleBaseUrl('https://models.example.com/v1/')).toBe(
      'https://models.example.com/v1',
    )
    expect(normalizeCompatibleBaseUrl('http://localhost:8080/v1/')).toBe('http://localhost:8080/v1')
    expect(() => normalizeCompatibleBaseUrl('http://models.example.com/v1')).toThrow(
      /HTTPS for remote providers/,
    )
    expect(() => normalizeCompatibleBaseUrl('file:///tmp/model')).toThrow(/HTTP or HTTPS/)
    expect(() => normalizeCompatibleBaseUrl('https://token@example.com/v1')).toThrow(
      /without credentials/,
    )
    expect(
      normalizeOllamaModels({
        models: [
          { name: 'zeta:latest', size: 42 },
          { model: 'alpha:7b', modified_at: '2026-08-31T10:00:00Z' },
          { name: '' },
        ],
      }),
    ).toEqual([
      { id: 'alpha:7b', modifiedAt: '2026-08-31T10:00:00Z' },
      { id: 'zeta:latest', size: 42 },
    ])
    expect(normalizeCompatibleModels({ data: [{ id: 'provider/model' }] })).toEqual([
      { id: 'provider/model' },
    ])
  })

  it('builds a non-streaming JSON chat request and reads provider responses', () => {
    const project = createDemoProject()
    const messages = createAssistantMessages(
      'Add one highlight.',
      project,
      project.frames[0]!.id,
      project.layers[0]!.id,
    )
    const body = createOllamaChatBody('qwen2.5-coder:7b', messages)

    expect(body).toMatchObject({
      model: 'qwen2.5-coder:7b',
      stream: false,
      format: { type: 'object' },
      options: { temperature: 0.1, top_p: 0.9, num_ctx: 16_384 },
    })
    expect(messages[1]!.content).toContain('Add one highlight.')
    expect(assistantSystemPrompt).toContain('intentional pixel clusters')
    expect(assistantSystemPrompt).toContain('Work silhouette first')
    expect(assistantSystemPrompt).toContain('ordered, repeating dithering patterns')
    expect(assistantSystemPrompt).toContain('anticipation, action, impact, and recovery')
    const payload = JSON.parse(messages[1]!.content) as {
      target_frame_ids: string[]
      art_constraints: {
        native_resolution: string
        hard_edges: boolean
        anti_aliasing: boolean
        existing_color_count: number
        recommended_color_budget: { small_prop: string; character: string }
        frame_durations_ms: number[]
      }
      frames: Array<{ role: string; composite_rows: number[][]; active_layer_rows: number[][] }>
    }
    expect(payload.target_frame_ids).toEqual(['frame_1'])
    expect(payload.frames).toHaveLength(3)
    expect(payload.frames[0]).toMatchObject({ role: 'target' })
    expect(payload.frames[0]!.composite_rows).toHaveLength(32)
    expect(payload.frames[0]!.active_layer_rows).toHaveLength(32)
    expect(payload.art_constraints).toMatchObject({
      native_resolution: '32x32',
      hard_edges: true,
      anti_aliasing: false,
      recommended_color_budget: {
        small_prop: '4-6 total colors',
        character: '8-12 total colors',
      },
    })
    expect(payload.art_constraints.existing_color_count).toBeGreaterThan(0)
    expect(payload.art_constraints.frame_durations_ms).toEqual([project.frames[0]!.duration])
    expect(readOllamaChatContent({ message: { content: '{"operations":[]}' } })).toBe(
      '{"operations":[]}',
    )
    expect(
      readCompatibleChatContent({ choices: [{ message: { content: '{"summary":"ok"}' } }] }),
    ).toBe('{"summary":"ok"}')
  })

  it('sends the rendered draft back as visual-review context', () => {
    const project = createDemoProject()
    const frameId = project.frames[0]!.id
    const layerId = project.layers[0]!.id
    project.layers[0]!.cels[frameId]![0] = '#abcdef'
    const messages = createAssistantMessages(
      'Clean the silhouette.',
      project,
      frameId,
      layerId,
      'frame',
      {
        pass: 2,
        skill: 'fix',
        priorSummary: 'Drafted the outer contour.',
        priorReviewNotes: ['Check the top-left cluster.'],
        vision: { frameIds: [frameId], scale: 8 },
      },
    )
    const payload = JSON.parse(messages[1]!.content) as {
      agent_pass: { number: number; phase: string; prior_summary: string }
      skill: { id: string }
      vision: { integer_preview_scale: number; frames: Array<{ frame_id: string }> }
      tools: Array<{ name: string }>
      frames: Array<{ composite_rows: number[][]; editable_layer_rows: Record<string, number[][]> }>
    }

    expect(payload.agent_pass).toMatchObject({
      number: 2,
      phase: 'visual_review',
      prior_summary: 'Drafted the outer contour.',
    })
    expect(payload.frames[0]!.composite_rows[0]![0]).toBeGreaterThanOrEqual(0)
    expect(payload.frames[0]!.editable_layer_rows[layerId]![0]![0]).toBeGreaterThanOrEqual(0)
    expect(payload.skill.id).toBe('fix')
    expect(payload.vision).toMatchObject({
      integer_preview_scale: 8,
      frames: [{ frame_id: frameId }],
    })
    expect(payload.tools.map((tool) => tool.name)).toContain('translate_region')
  })

  it('places bounded user instructions below the protected prompt and advertises enabled tools only', () => {
    const project = createDemoProject()
    const messages = createAssistantMessages(
      'Polish the outline.',
      project,
      project.frames[0]!.id,
      project.layers[0]!.id,
      'frame',
      {
        pass: 1,
        userInstruction: 'Prefer a cool two-color ramp.',
        enabledToolIds: ['set_pixels', 'replace_palette_color'],
      },
    )
    const payload = JSON.parse(messages[1]!.content) as {
      user_instruction: string
      tools: Array<{ name: string }>
    }
    expect(messages[0]!.content).toBe(assistantSystemPrompt)
    expect(payload.user_instruction).toBe('Prefer a cool two-color ramp.')
    expect(payload.tools.map((tool) => tool.name)).toEqual(['set_pixels', 'replace_palette_color'])
  })

  it('turns local runtime failures into actionable guidance', () => {
    expect(mapOllamaError(new TypeError('Failed to fetch'), 'http://127.0.0.1:11434')).toBe(
      'Ollama is not running at http://127.0.0.1:11434. Start Ollama, then try again.',
    )
    expect(mapOllamaError(new Error('request timeout'), 'http://127.0.0.1:11434')).toMatch(
      /did not respond in time/,
    )
    expect(
      mapOllamaError(new Error('model not found'), 'http://127.0.0.1:11434', 'tinyllama'),
    ).toMatch(/tinyllama is not installed/)
  })

  it('sends every animation frame as a target for entire-sheet edits', () => {
    const project = createDemoProject()
    const messages = createAssistantMessages(
      'Keep the spark attached through the run cycle.',
      project,
      project.frames[0]!.id,
      project.layers[1]!.id,
      'sheet',
    )
    const payload = JSON.parse(messages[1]!.content) as {
      edit_scope: string
      target_frame_ids: string[]
      frames: Array<{ role: string }>
    }

    expect(payload.edit_scope).toBe('full_animation')
    expect(payload.target_frame_ids).toEqual(project.frames.map((frame) => frame.id))
    expect(payload.frames.every((frame) => frame.role === 'target')).toBe(true)
  })
})

describe('assistant skills and rendered vision', () => {
  it('exposes six focused skills and the bounded tool catalog', () => {
    expect(ASSISTANT_SKILLS.map((skill) => skill.id)).toEqual([
      'generate',
      'animate',
      'inbetween',
      'restyle',
      'fix',
      'extend',
    ])
    expect(ASSISTANT_TOOL_CATALOG.map((tool) => tool.name)).toEqual(
      expect.arrayContaining([
        'set_pixels',
        'translate_region',
        'flip_region',
        'set_frame_duration',
      ]),
    )
  })

  it('uses integer preview scales and samples long animations within the vision budget', () => {
    const project = createDemoProject()
    project.frames = Array.from({ length: 20 }, (_, index) => ({
      id: `frame_${index + 1}`,
      name: `F${index + 1}`,
      duration: 120,
    }))
    expect(assistantVisionScale(32, 32)).toBe(8)
    const vision = planAssistantVision(project, 'frame_10', 'sheet')
    expect(vision.scale).toBe(8)
    expect(vision.frameIds.length).toBeLessThanOrEqual(4)
    expect(vision.frameIds).toContain('frame_10')
  })

  it('adapts attached PNG data to OpenAI-compatible multimodal messages', () => {
    const messages = createCompatibleChatMessages([
      { role: 'system', content: 'system' },
      { role: 'user', content: 'inspect', images: ['cG5n'] },
    ])
    expect(messages[0]!.content).toBe('system')
    expect(messages[1]!.content).toEqual([
      { type: 'text', text: 'inspect' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,cG5n' } },
    ])
    expect(mapCodexCliError(new Error('not logged in'))).toMatch(/codex login/i)
  })
})
