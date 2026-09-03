import type {
  ArtOperation,
  ArtProposal,
  AssistantArtEdit,
  AssistantChatEntry,
  AssistantEditScope,
  AssistantProjectAction,
  ModelConnection,
  ModelProvider,
  Pixel,
  SpriteProject,
} from '~/types/editor'
import { getCompositePixels } from '~/utils/render'
import { cloneProject, makeId, normalizeHex } from '~/utils/project'
import { applyAssistantChanges } from '~/utils/assistant'

const MAX_OPERATIONS_PER_FRAME = 32
const MAX_TARGET_FRAMES = 64
const MAX_PIXEL_CHANGES_PER_FRAME = 16_384
const MAX_PROJECT_ACTIONS = 16
const MIN_AGENT_PASSES = 2
const MAX_AGENT_PASSES = 3
export const OLLAMA_DEFAULT_URL = 'http://127.0.0.1:11434'

export interface AssistantModel {
  id: string
  size?: number
  modifiedAt?: string
}

export interface AssistantMessage {
  role: 'system' | 'user'
  content: string
}

export const assistantSystemPrompt = `You are Zakape's senior pixel artist and animation cleanup director. Convert the artist's request into precise, reviewable pixel operations. Think through the art privately, then return JSON only.

PIXEL-ART CRAFT
- Read the supplied indexed grids as artwork, not as arbitrary coordinates. -1 means transparency; every other number indexes the supplied palette.
- Work silhouette first: diagnose the outer contour and negative space before internal detail. At native 1x size, the subject and pose must remain readable.
- Build major forms from intentional pixel clusters. Avoid isolated noise, accidental stair-steps, banding, pillow shading, gradients, and anti-aliasing.
- Prefer the supplied palette. Reuse constrained ramps for outline, shadow, midtone, and highlight. Hue-shift shadows cooler and highlights warmer when that matches the existing art. Add a color only when the request cannot be expressed cleanly with the palette.
- Use one explicit directional light source and shade forms according to their orientation. Never darken every edge uniformly.
- Preserve the existing outline strategy. When an outline is present, keep its native 1px weight and language consistent unless the artist requests a different style.
- Use ordered, repeating dithering patterns only when a tonal bridge or texture is needed. Never scatter random noise.
- Make the fewest changes that fully solve the request. Every one-pixel mark must have a purpose at the native resolution.
- Use set_pixels for organic contours and cleanup. Use fill_rect or outline_rect only when the intended shape is genuinely rectangular. Use replace_palette_color only for an exact, deliberate recolor.
- composite_rows show the visible result. active_layer_rows show the initially editable layer; editable_layer_rows also include layers you created in earlier passes. Do not flatten other visible layers into an editable layer. Erasing an editable-layer pixel may reveal a lower layer.

PRIVATE CRAFT WORKFLOW
1. Diagnose silhouette, pose, and negative space.
2. Establish the fewest major clusters needed to describe the form.
3. Reuse a limited palette and coherent color ramps.
4. Apply one directional light source with no pillow shading.
5. Clean jaggies, banding, accidental anti-aliasing, and isolated single pixels.
6. Audit readability at native 1x resolution before returning operations.

ANIMATION CRAFT
- For one-frame work, use reference frames to preserve character proportions, palette, lighting, and motion continuity; never edit a reference frame.
- For full-animation work, build from key poses rather than extra in-betweens. Keep volumes, landmarks, outline weight, lighting, and attached details consistent across frames. Do not copy one static pose over the sequence or add unnecessary frames.
- Respect explicit frame durations. For locomotion, preserve contact and passing poses. For actions, preserve anticipation, action, impact, and recovery; the fastest motion should use the shortest holds.

AGENTIC REVIEW
- You may create frames or layers when the artist asks for them or when they materially improve the requested animation. Never add organizational clutter.
- Each response is one incremental pass. On review passes, inspect the updated composite_rows produced by your earlier work, identify concrete visual defects, then return only the corrections needed.
- Set ready to true only when the result is readable at 1x and has clean clusters, coherent lighting, deliberate palette use, and consistent animation volumes.

RESPONSE CONTRACT
Return exactly one JSON object:
{"summary":"short concrete art direction","actions":[],"edits":[],"review_notes":["specific visual audit"],"ready":false}

Allowed actions:
- {"type":"create_layer","layer_id":"new_layer_descriptive_id","name":"Highlights"}
- {"type":"create_frame","frame_id":"new_frame_descriptive_id","name":"F2","duration_ms":120,"after_frame_id":"existing or earlier new frame id","copy_from_frame_id":"existing frame id or null"}

Each edit is {"layer_id":"editable layer id","frame_id":"target or newly-created frame id","operations":[...]}. You may edit only the active_layer or a layer created in this response or an earlier pass. Do not edit reference-only frames.

Allowed operations:
- {"type":"set_pixels","pixels":[{"x":0,"y":0,"color":"#rrggbb"}]}
- {"type":"fill_rect","x":0,"y":0,"width":2,"height":2,"color":"#rrggbb"}
- {"type":"outline_rect","x":0,"y":0,"width":2,"height":2,"color":"#rrggbb"}
- {"type":"replace_palette_color","from":"#rrggbb","to":"#rrggbb"}

Use null only to erase. New IDs must start with new_layer_ or new_frame_ and contain only lowercase letters, numbers, underscores, or hyphens. Coordinates start at the top-left. Stay inside the canvas. Before responding, silently audit silhouette readability, cluster cleanliness, palette discipline, animation continuity, frame and layer IDs, coordinates, and JSON validity. Do not include markdown or commentary outside the JSON.`

const legacyAssistantResponseFormat = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'frames'],
  properties: {
    summary: { type: 'string' },
    frames: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['frame_id', 'operations'],
        properties: {
          frame_id: { type: 'string' },
          operations: {
            type: 'array',
            items: {
              oneOf: [
                {
                  type: 'object',
                  additionalProperties: false,
                  required: ['type', 'pixels'],
                  properties: {
                    type: { const: 'set_pixels' },
                    pixels: {
                      type: 'array',
                      items: {
                        type: 'object',
                        additionalProperties: false,
                        required: ['x', 'y', 'color'],
                        properties: {
                          x: { type: 'integer', minimum: 0 },
                          y: { type: 'integer', minimum: 0 },
                          color: { type: ['string', 'null'] },
                        },
                      },
                    },
                  },
                },
                {
                  type: 'object',
                  additionalProperties: false,
                  required: ['type', 'x', 'y', 'width', 'height', 'color'],
                  properties: {
                    type: { enum: ['fill_rect', 'outline_rect'] },
                    x: { type: 'integer', minimum: 0 },
                    y: { type: 'integer', minimum: 0 },
                    width: { type: 'integer', minimum: 1 },
                    height: { type: 'integer', minimum: 1 },
                    color: { type: ['string', 'null'] },
                  },
                },
                {
                  type: 'object',
                  additionalProperties: false,
                  required: ['type', 'from', 'to'],
                  properties: {
                    type: { const: 'replace_palette_color' },
                    from: { type: 'string' },
                    to: { type: ['string', 'null'] },
                  },
                },
              ],
            },
          },
        },
      },
    },
  },
} as const

const assistantOperationFormat =
  legacyAssistantResponseFormat.properties.frames.items.properties.operations

export const assistantResponseFormat = {
  type: 'object',
  additionalProperties: false,
  required: ['summary', 'actions', 'edits', 'review_notes', 'ready'],
  properties: {
    summary: { type: 'string' },
    actions: {
      type: 'array',
      items: {
        oneOf: [
          {
            type: 'object',
            additionalProperties: false,
            required: ['type', 'layer_id', 'name'],
            properties: {
              type: { const: 'create_layer' },
              layer_id: { type: 'string' },
              name: { type: 'string' },
            },
          },
          {
            type: 'object',
            additionalProperties: false,
            required: [
              'type',
              'frame_id',
              'name',
              'duration_ms',
              'after_frame_id',
              'copy_from_frame_id',
            ],
            properties: {
              type: { const: 'create_frame' },
              frame_id: { type: 'string' },
              name: { type: 'string' },
              duration_ms: { type: 'integer', minimum: 40, maximum: 10_000 },
              after_frame_id: { type: ['string', 'null'] },
              copy_from_frame_id: { type: ['string', 'null'] },
            },
          },
        ],
      },
    },
    edits: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['layer_id', 'frame_id', 'operations'],
        properties: {
          layer_id: { type: 'string' },
          frame_id: { type: 'string' },
          operations: assistantOperationFormat,
        },
      },
    },
    review_notes: { type: 'array', items: { type: 'string' } },
    ready: { type: 'boolean' },
  },
} as const

const parseJsonObject = (value: string) => {
  const unwrapped = value.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  return JSON.parse(unwrapped) as unknown
}

const errorText = (error: unknown) => {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  return 'The model provider could not be reached.'
}

export const normalizeOllamaBaseUrl = (value: string) => {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw new Error('Enter a valid Ollama address, such as http://127.0.0.1:11434.')
  }

  const hostname = url.hostname.toLowerCase()
  const isLoopback = hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]'
  if (
    !isLoopback ||
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.pathname !== '/' && url.pathname !== '') ||
    url.search ||
    url.hash
  ) {
    throw new Error('Ollama must use a loopback address: 127.0.0.1, localhost, or [::1].')
  }

  return url.toString().replace(/\/$/, '')
}

export const normalizeOllamaModels = (input: unknown): AssistantModel[] => {
  const models = Array.isArray(input)
    ? input
    : input && typeof input === 'object' && Array.isArray((input as { models?: unknown }).models)
      ? (input as { models: unknown[] }).models
      : []

  return models
    .map((item): AssistantModel | null => {
      if (!item || typeof item !== 'object') return null
      const model = item as {
        id?: unknown
        name?: unknown
        model?: unknown
        size?: unknown
        modified_at?: unknown
      }
      const id =
        typeof model.id === 'string'
          ? model.id
          : typeof model.name === 'string'
            ? model.name
            : model.model
      if (typeof id !== 'string' || !id.trim()) return null
      return {
        id: id.trim(),
        ...(typeof model.size === 'number' ? { size: model.size } : {}),
        ...(typeof model.modified_at === 'string' ? { modifiedAt: model.modified_at } : {}),
      }
    })
    .filter((model): model is AssistantModel => model !== null)
    .sort((left, right) => left.id.localeCompare(right.id))
}

export const normalizeCompatibleModels = (input: unknown): AssistantModel[] => {
  if (!input || typeof input !== 'object' || !Array.isArray((input as { data?: unknown }).data)) {
    return []
  }
  return (input as { data: unknown[] }).data
    .map((item) => {
      if (!item || typeof item !== 'object' || typeof (item as { id?: unknown }).id !== 'string') {
        return null
      }
      return { id: (item as { id: string }).id }
    })
    .filter((model): model is AssistantModel => model !== null)
}

export const mapOllamaError = (error: unknown, baseUrl: string, model?: string) => {
  const message = errorText(error)
  const lowerMessage = message.toLowerCase()
  if (lowerMessage.includes('loopback address') || lowerMessage.includes('valid ollama address')) {
    return message
  }
  if (lowerMessage.includes('model') && lowerMessage.includes('not found')) {
    return `${model || 'That model'} is not installed. Pull it in Ollama, then refresh the model list.`
  }
  if (lowerMessage.includes('timed out') || lowerMessage.includes('timeout')) {
    return 'Ollama did not respond in time. Check that it is running, then try again.'
  }
  if (
    lowerMessage.includes('failed to fetch') ||
    lowerMessage.includes('networkerror') ||
    lowerMessage.includes('load failed') ||
    lowerMessage.includes('not running') ||
    lowerMessage.includes('connection') ||
    lowerMessage.includes('tcp connect')
  ) {
    return `Ollama is not running at ${baseUrl}. Start Ollama, then try again.`
  }
  return message
}

const validateColor = (value: unknown, allowNull = true): string | null => {
  if (value === null && allowNull) return null
  if (typeof value !== 'string') throw new Error('The proposal contains an invalid color.')
  const color = normalizeHex(value)
  if (!color) throw new Error(`The proposal contains an invalid color: ${value}`)
  return color
}

const validateOperations = (input: unknown, width: number, height: number): ArtOperation[] => {
  if (!Array.isArray(input) || input.length > MAX_OPERATIONS_PER_FRAME) {
    throw new Error('A frame proposal has an invalid number of operations.')
  }

  const pixelLimit = Math.min(width * height * 2, MAX_PIXEL_CHANGES_PER_FRAME)
  let pixelCount = 0
  const operations: ArtOperation[] = input.map((raw) => {
    if (!raw || typeof raw !== 'object') throw new Error('An operation is not an object.')
    const operation = raw as Record<string, unknown>
    if (operation.type === 'set_pixels') {
      if (!Array.isArray(operation.pixels)) throw new Error('set_pixels requires a pixels array.')
      pixelCount += operation.pixels.length
      if (pixelCount > pixelLimit) throw new Error('A frame proposal changes too many pixels.')
      return {
        type: 'set_pixels',
        pixels: operation.pixels.map((rawPixel) => {
          if (!rawPixel || typeof rawPixel !== 'object') {
            throw new Error('The proposal contains an invalid pixel.')
          }
          const pixel = rawPixel as Record<string, unknown>
          const x = Number(pixel.x)
          const y = Number(pixel.y)
          if (
            !Number.isInteger(x) ||
            !Number.isInteger(y) ||
            x < 0 ||
            y < 0 ||
            x >= width ||
            y >= height
          ) {
            throw new Error('The proposal contains an out-of-bounds pixel.')
          }
          return { x, y, color: validateColor(pixel.color) }
        }),
      }
    }
    if (operation.type === 'fill_rect' || operation.type === 'outline_rect') {
      const x = Number(operation.x)
      const y = Number(operation.y)
      const rectangleWidth = Number(operation.width)
      const rectangleHeight = Number(operation.height)
      if (
        ![x, y, rectangleWidth, rectangleHeight].every(Number.isInteger) ||
        rectangleWidth < 1 ||
        rectangleHeight < 1 ||
        x < 0 ||
        y < 0 ||
        x + rectangleWidth > width ||
        y + rectangleHeight > height
      ) {
        throw new Error('The proposal contains an invalid rectangle.')
      }
      pixelCount +=
        operation.type === 'fill_rect'
          ? rectangleWidth * rectangleHeight
          : Math.min(rectangleWidth * rectangleHeight, rectangleWidth * 2 + rectangleHeight * 2)
      if (pixelCount > pixelLimit) throw new Error('A frame proposal changes too many pixels.')
      return {
        type: operation.type,
        x,
        y,
        width: rectangleWidth,
        height: rectangleHeight,
        color: validateColor(operation.color),
      }
    }
    if (operation.type === 'replace_palette_color') {
      return {
        type: 'replace_palette_color',
        from: validateColor(operation.from, false)!,
        to: validateColor(operation.to),
      }
    }
    throw new Error(`Unsupported assistant operation: ${String(operation.type)}`)
  })

  return operations
}

export interface AssistantValidationContext {
  width: number
  height: number
  knownFrameIds: string[]
  knownLayerIds: string[]
  targetFrameIds: string[]
  editableLayerIds: string[]
}

export interface ValidatedAssistantPass {
  summary: string
  actions: AssistantProjectAction[]
  edits: AssistantArtEdit[]
  reviewNotes: string[]
  ready: boolean
}

const validateNewId = (value: unknown, prefix: 'new_layer_' | 'new_frame_') => {
  if (
    typeof value !== 'string' ||
    !value.startsWith(prefix) ||
    !/^[a-z0-9_-]+$/.test(value) ||
    value.length > 64
  ) {
    throw new Error(`New assistant IDs must use the ${prefix} prefix and safe characters.`)
  }
  return value
}

const validateName = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, 64) : fallback

export const validateProposal = (
  input: unknown,
  context: AssistantValidationContext,
): ValidatedAssistantPass => {
  if (!input || typeof input !== 'object') {
    throw new Error('The model did not return a proposal object.')
  }
  if (context.targetFrameIds.length === 0 || context.targetFrameIds.length > MAX_TARGET_FRAMES) {
    throw new Error(`Assistant edits support between 1 and ${MAX_TARGET_FRAMES} target frames.`)
  }

  const candidate = input as Record<string, unknown>
  if (typeof candidate.summary !== 'string' || !candidate.summary.trim()) {
    throw new Error('The proposal is missing a summary.')
  }
  if (!Array.isArray(candidate.actions) || candidate.actions.length > MAX_PROJECT_ACTIONS) {
    throw new Error('The proposal contains an invalid number of project actions.')
  }
  if (!Array.isArray(candidate.edits) || candidate.edits.length > MAX_TARGET_FRAMES * 4) {
    throw new Error('The proposal contains an invalid number of art edits.')
  }

  const knownFrames = new Set(context.knownFrameIds)
  const knownLayers = new Set(context.knownLayerIds)
  const targetFrames = new Set(context.targetFrameIds)
  const editableLayers = new Set(context.editableLayerIds)
  const createdIds = new Set<string>()
  const actions: AssistantProjectAction[] = candidate.actions.map((rawAction) => {
    if (!rawAction || typeof rawAction !== 'object') {
      throw new Error('A project action is not an object.')
    }
    const action = rawAction as Record<string, unknown>
    if (action.type === 'create_layer') {
      const layerId = validateNewId(action.layer_id, 'new_layer_')
      if (createdIds.has(layerId) || knownLayers.has(layerId)) {
        throw new Error('The proposal repeats a layer ID.')
      }
      createdIds.add(layerId)
      knownLayers.add(layerId)
      editableLayers.add(layerId)
      return { type: 'create_layer', layerId, name: validateName(action.name, 'Assistant layer') }
    }
    if (action.type === 'create_frame') {
      if (knownFrames.size >= MAX_TARGET_FRAMES) {
        throw new Error(
          `Assistant projects support at most ${MAX_TARGET_FRAMES} frames per session.`,
        )
      }
      const frameId = validateNewId(action.frame_id, 'new_frame_')
      if (createdIds.has(frameId) || knownFrames.has(frameId)) {
        throw new Error('The proposal repeats a frame ID.')
      }
      const afterFrameId = action.after_frame_id === null ? null : String(action.after_frame_id)
      const copyFromFrameId =
        action.copy_from_frame_id === null ? null : String(action.copy_from_frame_id)
      if (afterFrameId && !knownFrames.has(afterFrameId)) {
        throw new Error('A new frame uses an unknown insertion anchor.')
      }
      if (copyFromFrameId && !knownFrames.has(copyFromFrameId)) {
        throw new Error('A new frame uses an unknown copy source.')
      }
      const duration = Number(action.duration_ms)
      if (!Number.isInteger(duration) || duration < 40 || duration > 10_000) {
        throw new Error('A new frame has an invalid duration.')
      }
      createdIds.add(frameId)
      knownFrames.add(frameId)
      targetFrames.add(frameId)
      return {
        type: 'create_frame',
        frameId,
        name: validateName(action.name, 'New frame'),
        duration,
        afterFrameId,
        copyFromFrameId,
      }
    }
    throw new Error(`Unsupported assistant action: ${String(action.type)}`)
  })

  const edits: AssistantArtEdit[] = candidate.edits.map((rawEdit) => {
    if (!rawEdit || typeof rawEdit !== 'object') throw new Error('An art edit is not an object.')
    const edit = rawEdit as Record<string, unknown>
    const frameId = String(edit.frame_id)
    const layerId = String(edit.layer_id)
    if (!knownFrames.has(frameId) || !targetFrames.has(frameId)) {
      throw new Error('The proposal edits an unavailable or reference-only frame.')
    }
    if (!editableLayers.has(layerId)) {
      throw new Error('The proposal edits a layer that was not made available to the assistant.')
    }
    return {
      frameId,
      layerId,
      operations: validateOperations(edit.operations, context.width, context.height),
    }
  })

  const reviewNotes = Array.isArray(candidate.review_notes)
    ? candidate.review_notes
        .filter((note): note is string => typeof note === 'string' && Boolean(note.trim()))
        .slice(0, 8)
        .map((note) => note.trim().slice(0, 240))
    : []
  if (typeof candidate.ready !== 'boolean') {
    throw new Error('The proposal is missing its visual review status.')
  }

  return {
    summary: candidate.summary.trim().slice(0, 240),
    actions,
    edits,
    reviewNotes,
    ready: candidate.ready,
  }
}

const encodePixels = (
  pixels: Pixel[],
  width: number,
  height: number,
  paletteIndexes: Map<string, number>,
) => {
  return Array.from({ length: height }, (_, y) =>
    Array.from({ length: width }, (_, x) => {
      const pixel = pixels[y * width + x]
      return pixel ? (paletteIndexes.get(pixel.toLowerCase()) ?? -1) : -1
    }),
  )
}

const collectPalette = (project: SpriteProject, frameIds: string[]) => {
  const colors = [...project.palette]
  for (const layer of project.layers) {
    for (const frameId of frameIds) {
      colors.push(...(layer.cels[frameId] ?? []).filter((pixel): pixel is string => Boolean(pixel)))
    }
  }
  return [...new Set(colors.map((color) => color.toLowerCase()))]
}

const neighboringFrameIds = (project: SpriteProject, frameId: string) => {
  if (project.frames.length < 2) return []
  const activeIndex = project.frames.findIndex((frame) => frame.id === frameId)
  if (activeIndex < 0) return []
  const candidates = [
    project.frames[(activeIndex - 1 + project.frames.length) % project.frames.length]?.id,
    project.frames[(activeIndex + 1) % project.frames.length]?.id,
  ]
  return [...new Set(candidates.filter((id): id is string => Boolean(id) && id !== frameId))]
}

export interface AssistantIterationContext {
  pass: number
  createdFrameIds?: string[]
  editableLayerIds?: string[]
  priorSummary?: string
  priorReviewNotes?: string[]
}

export const createAssistantMessages = (
  prompt: string,
  project: SpriteProject,
  frameId: string,
  layerId: string,
  scope: AssistantEditScope = 'frame',
  iteration: AssistantIterationContext = { pass: 1 },
): AssistantMessage[] => {
  const activeLayer = project.layers.find((layer) => layer.id === layerId)
  if (!activeLayer) throw new Error('The active layer is no longer available.')

  const targetFrameIds =
    scope === 'sheet'
      ? project.frames.map((frame) => frame.id)
      : [
          frameId,
          ...(iteration.createdFrameIds ?? []).filter((id) =>
            project.frames.some((frame) => frame.id === id),
          ),
        ]
  const uniqueTargetFrameIds = [...new Set(targetFrameIds)]
  if (uniqueTargetFrameIds.length > MAX_TARGET_FRAMES) {
    throw new Error(`Full-animation edits currently support up to ${MAX_TARGET_FRAMES} frames.`)
  }
  const referenceFrameIds =
    scope === 'frame'
      ? neighboringFrameIds(project, frameId).filter((id) => !uniqueTargetFrameIds.includes(id))
      : []
  const contextFrameIds = [...uniqueTargetFrameIds, ...referenceFrameIds]
  const editableLayers = project.layers.filter((layer) =>
    new Set([layerId, ...(iteration.editableLayerIds ?? [])]).has(layer.id),
  )
  const palette = collectPalette(project, contextFrameIds)
  const paletteIndexes = new Map(palette.map((color, index) => [color, index]))
  const usedColors = new Set(
    project.layers.flatMap((layer) =>
      contextFrameIds.flatMap((contextFrameId) =>
        (layer.cels[contextFrameId] ?? [])
          .filter((pixel): pixel is string => Boolean(pixel))
          .map((pixel) => pixel.toLowerCase()),
      ),
    ),
  )

  return [
    { role: 'system', content: assistantSystemPrompt },
    {
      role: 'user',
      content: JSON.stringify({
        request: prompt,
        agent_pass: {
          number: iteration.pass,
          phase: iteration.pass === 1 ? 'draft' : 'visual_review',
          instruction:
            iteration.pass === 1
              ? 'Create a strong first pass.'
              : 'Inspect the updated grids from your prior work and return only incremental corrections.',
          prior_summary: iteration.priorSummary ?? null,
          prior_review_notes: iteration.priorReviewNotes ?? [],
        },
        edit_scope: scope === 'sheet' ? 'full_animation' : 'current_frame',
        target_frame_ids: uniqueTargetFrameIds,
        canvas: {
          width: project.width,
          height: project.height,
          coordinate_origin: 'top_left',
          transparent_index: -1,
          palette,
        },
        art_constraints: {
          native_resolution: `${project.width}x${project.height}`,
          hard_edges: true,
          anti_aliasing: false,
          square_pixels: true,
          existing_color_count: usedColors.size,
          available_palette_color_count: palette.length,
          recommended_color_budget: {
            small_prop: '4-6 total colors',
            character: '8-12 total colors',
          },
          outline: 'preserve the existing strategy and native 1px weight when present',
          dithering: 'ordered patterns only; never random noise',
          frame_durations_ms: uniqueTargetFrameIds.map(
            (targetId) => project.frames.find((frame) => frame.id === targetId)!.duration,
          ),
          native_size_audit: 'the result must read cleanly at 1x',
        },
        active_layer: { id: activeLayer.id, name: activeLayer.name },
        editable_layers: editableLayers.map((layer) => ({ id: layer.id, name: layer.name })),
        capabilities: {
          create_layers: true,
          create_frames: true,
          incremental_visual_review: true,
        },
        frames: contextFrameIds.map((contextFrameId) => {
          const frame = project.frames.find((item) => item.id === contextFrameId)!
          return {
            frame_id: frame.id,
            sequence_index: project.frames.indexOf(frame),
            name: frame.name,
            duration_ms: frame.duration,
            role: uniqueTargetFrameIds.includes(frame.id) ? 'target' : 'reference_only',
            composite_rows: encodePixels(
              getCompositePixels(project, frame.id),
              project.width,
              project.height,
              paletteIndexes,
            ),
            active_layer_rows: encodePixels(
              activeLayer.cels[frame.id] ??
                Array.from({ length: project.width * project.height }, (): Pixel => null),
              project.width,
              project.height,
              paletteIndexes,
            ),
            editable_layer_rows: Object.fromEntries(
              editableLayers.map((layer) => [
                layer.id,
                encodePixels(
                  layer.cels[frame.id] ??
                    Array.from({ length: project.width * project.height }, (): Pixel => null),
                  project.width,
                  project.height,
                  paletteIndexes,
                ),
              ]),
            ),
          }
        }),
      }),
    },
  ]
}

export const createOllamaChatBody = (model: string, messages: AssistantMessage[]) => ({
  model,
  messages,
  stream: false,
  format: assistantResponseFormat,
  options: { temperature: 0.1, top_p: 0.9, num_ctx: 16_384 },
})

export const readOllamaChatContent = (input: unknown) => {
  if (!input || typeof input !== 'object') return ''
  const message = (input as { message?: unknown }).message
  if (!message || typeof message !== 'object') return ''
  const content = (message as { content?: unknown }).content
  return typeof content === 'string' ? content : ''
}

export const readCompatibleChatContent = (input: unknown) => {
  if (!input || typeof input !== 'object') return ''
  const choices = (input as { choices?: unknown }).choices
  if (!Array.isArray(choices)) return ''
  const firstChoice = choices[0]
  if (!firstChoice || typeof firstChoice !== 'object') return ''
  const message = (firstChoice as { message?: unknown }).message
  if (!message || typeof message !== 'object') return ''
  const content = (message as { content?: unknown }).content
  return typeof content === 'string' ? content : ''
}

const isTauriRuntime = () => import.meta.client && '__TAURI_INTERNALS__' in window

const invokeDesktop = async <T>(command: string, args: Record<string, unknown>): Promise<T> => {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, args)
}

const directOllamaModels = async (baseUrl: string) => {
  const response = await fetch(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(12_000) })
  if (!response.ok) throw new Error(`Ollama returned ${response.status}.`)
  return normalizeOllamaModels(await response.json())
}

const discoverModels = async (connection: ModelConnection): Promise<AssistantModel[]> => {
  if (connection.provider === 'ollama') {
    const baseUrl = normalizeOllamaBaseUrl(connection.baseUrl)
    return isTauriRuntime()
      ? invokeDesktop<AssistantModel[]>('ollama_list_models', { baseUrl })
      : directOllamaModels(baseUrl)
  }

  const baseUrl = connection.baseUrl.replace(/\/$/, '')
  const response = await fetch(`${baseUrl}/models`, {
    signal: AbortSignal.timeout(12_000),
    headers: {
      'Content-Type': 'application/json',
      ...(connection.apiKey ? { Authorization: `Bearer ${connection.apiKey}` } : {}),
    },
  })
  if (!response.ok) throw new Error(`Provider returned ${response.status}.`)
  return normalizeCompatibleModels(await response.json())
}

export const useAiAssistant = () => {
  const connection = useState<ModelConnection>('model-connection', () => ({
    provider: 'ollama',
    baseUrl: OLLAMA_DEFAULT_URL,
    model: '',
    apiKey: '',
  }))
  const status = useState<'idle' | 'testing' | 'working' | 'connected' | 'error'>(
    'assistant-status',
    () => 'idle',
  )
  const errorMessage = useState<string>('assistant-error', () => '')
  const proposal = useState<ArtProposal | null>('assistant-proposal', () => null)
  const availableModels = useState<AssistantModel[]>('assistant-models', () => [])
  const chatEntries = useState<AssistantChatEntry[]>('assistant-chat', () => [])
  const chatProjectId = useState<string>('assistant-chat-project', () => '')
  const agentPass = useState('assistant-agent-pass', () => ({
    current: 0,
    total: MAX_AGENT_PASSES,
  }))
  const { loadPreference, savePreference } = useProjectRepository()

  const endpoint = (path: string) => `${connection.value.baseUrl.replace(/\/$/, '')}${path}`
  const headers = () => ({
    'Content-Type': 'application/json',
    ...(connection.value.apiKey ? { Authorization: `Bearer ${connection.value.apiKey}` } : {}),
  })

  const testConnection = async () => {
    status.value = 'testing'
    errorMessage.value = ''
    try {
      const models = await discoverModels(connection.value)
      availableModels.value = models
      if (connection.value.provider === 'ollama' && models.length === 0) {
        throw new Error(
          'Ollama is running, but no models are installed. Pull a model, then refresh.',
        )
      }
      status.value = 'connected'
      return models
    } catch (error) {
      status.value = 'error'
      availableModels.value = []
      errorMessage.value =
        connection.value.provider === 'ollama'
          ? mapOllamaError(error, connection.value.baseUrl, connection.value.model)
          : errorText(error)
      return []
    }
  }

  const persistChat = async () => {
    if (!chatProjectId.value) return
    try {
      await savePreference(`assistant-chat:${chatProjectId.value}`, chatEntries.value.slice(-100))
    } catch (error) {
      console.warn('Zakape could not persist this assistant conversation.', error)
    }
  }

  const loadChat = async (projectId: string) => {
    if (!projectId || chatProjectId.value === projectId) return
    chatProjectId.value = projectId
    proposal.value = null
    let stored: AssistantChatEntry[] | null = null
    try {
      stored = await loadPreference<AssistantChatEntry[]>(`assistant-chat:${projectId}`)
    } catch (error) {
      console.warn('Zakape could not restore this assistant conversation.', error)
    }
    chatEntries.value = Array.isArray(stored)
      ? stored
          .filter(
            (entry) =>
              entry &&
              typeof entry.id === 'string' &&
              (entry.role === 'user' || entry.role === 'assistant') &&
              typeof entry.content === 'string' &&
              typeof entry.createdAt === 'string',
          )
          .slice(-100)
      : []
  }

  const appendChat = (entry: Omit<AssistantChatEntry, 'id' | 'createdAt'>) => {
    chatEntries.value.push({
      ...entry,
      id: makeId('chat'),
      createdAt: new Date().toISOString(),
    })
    if (chatEntries.value.length > 100) chatEntries.value = chatEntries.value.slice(-100)
    void persistChat()
  }

  const requestModel = async (messages: AssistantMessage[]) => {
    if (connection.value.provider === 'ollama') {
      const baseUrl = normalizeOllamaBaseUrl(connection.value.baseUrl)
      if (isTauriRuntime()) {
        return invokeDesktop<string>('ollama_chat', {
          baseUrl,
          model: connection.value.model,
          messages,
        })
      }
      const response = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        signal: AbortSignal.timeout(180_000),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createOllamaChatBody(connection.value.model, messages)),
      })
      if (!response.ok) {
        const message = await response.text()
        throw new Error(`Ollama returned ${response.status}: ${message.slice(0, 180)}`)
      }
      return readOllamaChatContent(await response.json())
    }

    const response = await fetch(endpoint('/chat/completions'), {
      method: 'POST',
      signal: AbortSignal.timeout(180_000),
      headers: headers(),
      body: JSON.stringify({
        model: connection.value.model,
        temperature: 0.1,
        messages,
        response_format: { type: 'json_object' },
      }),
    })
    if (!response.ok) {
      const message = await response.text()
      throw new Error(`Provider returned ${response.status}: ${message.slice(0, 180)}`)
    }
    return readCompatibleChatContent(await response.json())
  }

  const requestProposal = async (
    prompt: string,
    project: SpriteProject,
    frameId: string,
    layerId: string,
    scope: AssistantEditScope,
  ) => {
    if (!prompt.trim()) return
    if (chatProjectId.value !== project.id) await loadChat(project.id)
    appendChat({ role: 'user', content: prompt.trim().slice(0, 4000), scope, state: 'message' })
    status.value = 'working'
    errorMessage.value = ''
    proposal.value = null
    agentPass.value = { current: 1, total: MAX_AGENT_PASSES }
    try {
      const workingProject = cloneProject(project)
      const actions: AssistantProjectAction[] = []
      const edits: AssistantArtEdit[] = []
      const reviewNotes: string[] = []
      const createdFrameIds: string[] = []
      const editableLayerIds = [layerId]
      let summary = ''

      for (let passNumber = 1; passNumber <= MAX_AGENT_PASSES; passNumber += 1) {
        agentPass.value = { current: passNumber, total: MAX_AGENT_PASSES }
        const targetFrameIds =
          scope === 'sheet'
            ? workingProject.frames.map((frame) => frame.id)
            : [frameId, ...createdFrameIds]
        const messages = createAssistantMessages(prompt, workingProject, frameId, layerId, scope, {
          pass: passNumber,
          createdFrameIds,
          editableLayerIds,
          priorSummary: summary,
          priorReviewNotes: reviewNotes.slice(-4),
        })
        const content = await requestModel(messages)
        if (!content) throw new Error('The provider returned an empty response.')
        const pass = validateProposal(parseJsonObject(content), {
          width: workingProject.width,
          height: workingProject.height,
          knownFrameIds: workingProject.frames.map((frame) => frame.id),
          knownLayerIds: workingProject.layers.map((layer) => layer.id),
          targetFrameIds,
          editableLayerIds,
        })
        applyAssistantChanges(workingProject, pass.actions, pass.edits)
        actions.push(...pass.actions)
        edits.push(...pass.edits)
        summary = pass.summary
        reviewNotes.push(...pass.reviewNotes)
        pass.actions.forEach((action) => {
          if (action.type === 'create_frame') createdFrameIds.push(action.frameId)
          else editableLayerIds.push(action.layerId)
        })
        if (passNumber >= MIN_AGENT_PASSES && pass.ready) break
      }

      if (actions.length === 0 && edits.every((edit) => edit.operations.length === 0)) {
        throw new Error('The model reviewed the sprite but did not propose a visible change.')
      }
      proposal.value = {
        summary,
        scope,
        actions,
        edits,
        reviewNotes: [...new Set(reviewNotes)].slice(-8),
        passes: agentPass.value.current,
      }
      appendChat({ role: 'assistant', content: summary, scope, state: 'proposal' })
      status.value = 'connected'
    } catch (error) {
      status.value = 'error'
      errorMessage.value =
        connection.value.provider === 'ollama'
          ? mapOllamaError(error, connection.value.baseUrl, connection.value.model)
          : errorText(error)
      appendChat({ role: 'assistant', content: errorMessage.value, scope, state: 'error' })
    } finally {
      agentPass.value = { current: 0, total: MAX_AGENT_PASSES }
    }
  }

  const updateLatestProposalState = (state: 'applied' | 'discarded') => {
    const entry = chatEntries.value.findLast((item) => item.state === 'proposal')
    if (entry) entry.state = state
    void persistChat()
  }

  const discardProposal = (recordInChat = false) => {
    if (recordInChat) updateLatestProposalState('discarded')
    proposal.value = null
    errorMessage.value = ''
  }

  const markProposalApplied = () => {
    updateLatestProposalState('applied')
    proposal.value = null
    errorMessage.value = ''
  }

  const clearConnectionState = (provider?: ModelProvider) => {
    status.value = 'idle'
    errorMessage.value = ''
    availableModels.value = []
    if (provider && provider !== connection.value.provider) proposal.value = null
  }

  return {
    connection,
    status,
    errorMessage,
    proposal,
    chatEntries,
    agentPass,
    availableModels,
    testConnection,
    requestProposal,
    loadChat,
    discardProposal,
    markProposalApplied,
    clearConnectionState,
  }
}
