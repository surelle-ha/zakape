import type {
  ArtOperation,
  ArtProposal,
  ModelConnection,
  ModelProvider,
  SpriteProject,
} from '~/types/editor'
import { getCompositePixels } from '~/utils/render'
import { normalizeHex } from '~/utils/project'

const MAX_OPERATIONS = 24
const MAX_PIXELS = 2048
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

const assistantSystemPrompt = `You are Zakape's pixel-art editing assistant. Return only one JSON object with this shape:
{"summary":"short explanation","operations":[...]}
Allowed operations:
- {"type":"set_pixels","pixels":[{"x":0,"y":0,"color":"#rrggbb"}]}
- {"type":"fill_rect","x":0,"y":0,"width":2,"height":2,"color":"#rrggbb"}
- {"type":"outline_rect","x":0,"y":0,"width":2,"height":2,"color":"#rrggbb"}
- {"type":"replace_palette_color","from":"#rrggbb","to":"#rrggbb"}
Use null as a color only to erase. Stay inside the canvas, prefer the supplied palette, preserve the silhouette unless asked, and keep changes economical.`

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

export const validateProposal = (input: unknown, width: number, height: number): ArtProposal => {
  if (!input || typeof input !== 'object')
    throw new Error('The model did not return a proposal object.')
  const candidate = input as { summary?: unknown; operations?: unknown }
  if (typeof candidate.summary !== 'string' || !candidate.summary.trim()) {
    throw new Error('The proposal is missing a summary.')
  }
  if (!Array.isArray(candidate.operations) || candidate.operations.length > MAX_OPERATIONS) {
    throw new Error('The proposal has an invalid number of operations.')
  }

  let pixelCount = 0
  const operations: ArtOperation[] = candidate.operations.map((raw) => {
    if (!raw || typeof raw !== 'object') throw new Error('An operation is not an object.')
    const operation = raw as Record<string, unknown>
    if (operation.type === 'set_pixels') {
      if (!Array.isArray(operation.pixels)) throw new Error('set_pixels requires a pixels array.')
      pixelCount += operation.pixels.length
      if (pixelCount > MAX_PIXELS) throw new Error('The proposal changes too many pixels at once.')
      return {
        type: 'set_pixels',
        pixels: operation.pixels.map((rawPixel) => {
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

  return { summary: candidate.summary.trim().slice(0, 240), operations }
}

const encodeCanvas = (project: SpriteProject, frameId: string) => {
  const pixels = getCompositePixels(project, frameId)
  const palette = [
    ...new Set([...project.palette, ...pixels.filter((pixel): pixel is string => Boolean(pixel))]),
  ]
  const rows = Array.from({ length: project.height }, (_, y) =>
    Array.from({ length: project.width }, (_, x) => {
      const pixel = pixels[y * project.width + x]
      return pixel ? palette.indexOf(pixel) : -1
    }),
  )
  return { palette, rows }
}

export const createAssistantMessages = (
  prompt: string,
  project: SpriteProject,
  frameId: string,
  layerName: string,
): AssistantMessage[] => {
  const canvas = encodeCanvas(project, frameId)
  return [
    { role: 'system', content: assistantSystemPrompt },
    {
      role: 'user',
      content: JSON.stringify({
        request: prompt,
        canvas: { width: project.width, height: project.height, ...canvas },
        activeLayer: layerName,
      }),
    },
  ]
}

export const createOllamaChatBody = (model: string, messages: AssistantMessage[]) => ({
  model,
  messages,
  stream: false,
  format: 'json',
  options: { temperature: 0.2 },
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
    layerName: string,
  ) => {
    if (!prompt.trim()) return
    status.value = 'working'
    errorMessage.value = ''
    proposal.value = null
    try {
      const messages = createAssistantMessages(prompt, project, frameId, layerName)
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
            temperature: 0.2,
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
      proposal.value = validateProposal(parseJsonObject(content), project.width, project.height)
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
