import type {
  ArtOperation,
  ArtProposal,
  AssistantEditScope,
  FrameArtEdit,
  ModelConnection,
  ModelProvider,
  Pixel,
  SpriteProject,
} from '~/types/editor'
import { getCompositePixels } from '~/utils/render'
import { normalizeHex } from '~/utils/project'

const MAX_OPERATIONS_PER_FRAME = 32
const MAX_TARGET_FRAMES = 64
const MAX_PIXEL_CHANGES_PER_FRAME = 16_384
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
- Build intentional pixel clusters and readable negative space. Avoid isolated noise, accidental stair-steps, pillow shading, gradients, anti-aliasing, and excessive colors.
- Preserve a strong silhouette, clear focal point, consistent light direction, and the existing design language unless the artist explicitly asks to change them.
- Prefer the supplied palette. Reuse nearby ramps for outline, shadow, midtone, and highlight. Add a color only when the request cannot be expressed cleanly with the palette.
- Make the fewest changes that fully solve the request. Every one-pixel mark must have a purpose at the native resolution.
- Use set_pixels for organic contours and cleanup. Use fill_rect or outline_rect only when the intended shape is genuinely rectangular. Use replace_palette_color only for an exact, deliberate recolor.
- composite_rows show the visible result. active_layer_rows show the only layer you may edit. Do not flatten other visible layers into the active layer. Erasing an active-layer pixel may reveal a lower layer.

ANIMATION CRAFT
- For one-frame work, use reference frames to preserve character proportions, palette, lighting, and motion continuity; never edit a reference frame.
- For full-animation work, preserve each pose's intended motion. Keep volumes, landmarks, outline weight, lighting, and attached details consistent across frames. Do not copy one static pose over the sequence.

RESPONSE CONTRACT
Return exactly one JSON object:
{"summary":"short concrete art direction","frames":[{"frame_id":"exact target id","operations":[...]}]}
Return exactly one frames entry for every target_frame_id, in the supplied order, even when an entry has no operations. Never return a reference frame.

Allowed operations:
- {"type":"set_pixels","pixels":[{"x":0,"y":0,"color":"#rrggbb"}]}
- {"type":"fill_rect","x":0,"y":0,"width":2,"height":2,"color":"#rrggbb"}
- {"type":"outline_rect","x":0,"y":0,"width":2,"height":2,"color":"#rrggbb"}
- {"type":"replace_palette_color","from":"#rrggbb","to":"#rrggbb"}

Use null only to erase. Coordinates start at the top-left. Stay inside the canvas. Before responding, silently audit silhouette readability, cluster cleanliness, palette discipline, animation continuity, frame IDs, coordinates, and JSON validity. Do not include markdown or commentary outside the JSON.`

export const assistantResponseFormat = {
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

export const validateProposal = (
  input: unknown,
  width: number,
  height: number,
  expectedFrameIds: string[],
): Pick<ArtProposal, 'summary' | 'frames'> => {
  if (!input || typeof input !== 'object')
    throw new Error('The model did not return a proposal object.')
  if (expectedFrameIds.length === 0 || expectedFrameIds.length > MAX_TARGET_FRAMES) {
    throw new Error(`Assistant edits support between 1 and ${MAX_TARGET_FRAMES} target frames.`)
  }
  const candidate = input as { summary?: unknown; frames?: unknown }
  if (typeof candidate.summary !== 'string' || !candidate.summary.trim()) {
    throw new Error('The proposal is missing a summary.')
  }
  if (!Array.isArray(candidate.frames) || candidate.frames.length !== expectedFrameIds.length) {
    throw new Error('The proposal does not cover every requested frame.')
  }

  const expectedFrameSet = new Set(expectedFrameIds)
  const seenFrames = new Set<string>()
  const frames: FrameArtEdit[] = candidate.frames.map((rawFrame, index) => {
    if (!rawFrame || typeof rawFrame !== 'object') {
      throw new Error('A frame proposal is not an object.')
    }
    const frame = rawFrame as { frame_id?: unknown; operations?: unknown }
    if (typeof frame.frame_id !== 'string' || !expectedFrameSet.has(frame.frame_id)) {
      throw new Error('The proposal contains an unexpected frame ID.')
    }
    if (seenFrames.has(frame.frame_id)) throw new Error('The proposal repeats a frame ID.')
    if (frame.frame_id !== expectedFrameIds[index]) {
      throw new Error('The proposal returned frames in the wrong order.')
    }
    seenFrames.add(frame.frame_id)
    return {
      frameId: frame.frame_id,
      operations: validateOperations(frame.operations, width, height),
    }
  })

  if (frames.every((frame) => frame.operations.length === 0)) {
    throw new Error(
      'The model did not propose any pixel changes. Add more visual direction and try again.',
    )
  }

  return { summary: candidate.summary.trim().slice(0, 240), frames }
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

export const createAssistantMessages = (
  prompt: string,
  project: SpriteProject,
  frameId: string,
  layerId: string,
  scope: AssistantEditScope = 'frame',
): AssistantMessage[] => {
  const activeLayer = project.layers.find((layer) => layer.id === layerId)
  if (!activeLayer) throw new Error('The active layer is no longer available.')

  const targetFrameIds = scope === 'sheet' ? project.frames.map((frame) => frame.id) : [frameId]
  if (targetFrameIds.length > MAX_TARGET_FRAMES) {
    throw new Error(`Full-animation edits currently support up to ${MAX_TARGET_FRAMES} frames.`)
  }
  const referenceFrameIds = scope === 'frame' ? neighboringFrameIds(project, frameId) : []
  const contextFrameIds = [...targetFrameIds, ...referenceFrameIds]
  const palette = collectPalette(project, contextFrameIds)
  const paletteIndexes = new Map(palette.map((color, index) => [color, index]))

  return [
    { role: 'system', content: assistantSystemPrompt },
    {
      role: 'user',
      content: JSON.stringify({
        request: prompt,
        edit_scope: scope === 'sheet' ? 'full_animation' : 'current_frame',
        target_frame_ids: targetFrameIds,
        canvas: {
          width: project.width,
          height: project.height,
          coordinate_origin: 'top_left',
          transparent_index: -1,
          palette,
        },
        active_layer: { id: activeLayer.id, name: activeLayer.name },
        frames: contextFrameIds.map((contextFrameId) => {
          const frame = project.frames.find((item) => item.id === contextFrameId)!
          return {
            frame_id: frame.id,
            sequence_index: project.frames.indexOf(frame),
            name: frame.name,
            duration_ms: frame.duration,
            role: targetFrameIds.includes(frame.id) ? 'target' : 'reference_only',
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

  const requestProposal = async (
    prompt: string,
    project: SpriteProject,
    frameId: string,
    layerId: string,
    scope: AssistantEditScope,
  ) => {
    if (!prompt.trim()) return
    status.value = 'working'
    errorMessage.value = ''
    proposal.value = null
    try {
      const targetFrameIds = scope === 'sheet' ? project.frames.map((frame) => frame.id) : [frameId]
      const messages = createAssistantMessages(prompt, project, frameId, layerId, scope)
      let content = ''

      if (connection.value.provider === 'ollama') {
        const baseUrl = normalizeOllamaBaseUrl(connection.value.baseUrl)
        if (isTauriRuntime()) {
          content = await invokeDesktop<string>('ollama_chat', {
            baseUrl,
            model: connection.value.model,
            messages,
          })
        } else {
          const response = await fetch(`${baseUrl}/api/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(createOllamaChatBody(connection.value.model, messages)),
          })
          if (!response.ok) {
            const message = await response.text()
            throw new Error(`Ollama returned ${response.status}: ${message.slice(0, 180)}`)
          }
          content = readOllamaChatContent(await response.json())
        }
      } else {
        const response = await fetch(endpoint('/chat/completions'), {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({
            model: connection.value.model,
            temperature: 0.1,
            messages,
          }),
        })
        if (!response.ok) {
          const message = await response.text()
          throw new Error(`Provider returned ${response.status}: ${message.slice(0, 180)}`)
        }
        content = readCompatibleChatContent(await response.json())
      }
      if (!content) throw new Error('The provider returned an empty response.')
      proposal.value = {
        ...validateProposal(
          parseJsonObject(content),
          project.width,
          project.height,
          targetFrameIds,
        ),
        scope,
        layerId,
      }
      status.value = 'connected'
    } catch (error) {
      status.value = 'error'
      errorMessage.value =
        connection.value.provider === 'ollama'
          ? mapOllamaError(error, connection.value.baseUrl, connection.value.model)
          : errorText(error)
    }
  }

  const discardProposal = () => {
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
    availableModels,
    testConnection,
    requestProposal,
    discardProposal,
    clearConnectionState,
  }
}
