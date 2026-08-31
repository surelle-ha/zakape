import type { ArtOperation, ArtProposal, ModelConnection, SpriteProject } from '~/types/editor'
import { getCompositePixels } from '~/utils/render'
import { normalizeHex } from '~/utils/project'

const MAX_OPERATIONS = 24
const MAX_PIXELS = 2048

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

export const useAiAssistant = () => {
  const connection = useState<ModelConnection>('model-connection', () => ({
    baseUrl: 'http://localhost:11434/v1',
    model: '',
    apiKey: '',
  }))
  const status = useState<'idle' | 'testing' | 'working' | 'connected' | 'error'>(
    'assistant-status',
    () => 'idle',
  )
  const errorMessage = useState<string>('assistant-error', () => '')
  const proposal = useState<ArtProposal | null>('assistant-proposal', () => null)

  const endpoint = (path: string) => `${connection.value.baseUrl.replace(/\/$/, '')}${path}`
  const headers = () => ({
    'Content-Type': 'application/json',
    ...(connection.value.apiKey ? { Authorization: `Bearer ${connection.value.apiKey}` } : {}),
  })

  const testConnection = async () => {
    status.value = 'testing'
    errorMessage.value = ''
    try {
      const response = await fetch(endpoint('/models'), { headers: headers() })
      if (!response.ok) throw new Error(`Provider returned ${response.status}.`)
      status.value = 'connected'
      return true
    } catch (error) {
      status.value = 'error'
      errorMessage.value = error instanceof Error ? error.message : 'Connection failed.'
      return false
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
      const canvas = encodeCanvas(project, frameId)
      const response = await fetch(endpoint('/chat/completions'), {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          model: connection.value.model,
          temperature: 0.2,
          messages: [
            { role: 'system', content: assistantSystemPrompt },
            {
              role: 'user',
              content: JSON.stringify({
                request: prompt,
                canvas: { width: project.width, height: project.height, ...canvas },
                activeLayer: layerName,
              }),
            },
          ],
        }),
      })
      if (!response.ok) {
        const message = await response.text()
        throw new Error(`Provider returned ${response.status}: ${message.slice(0, 180)}`)
      }
      const payload = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>
      }
      const content = payload.choices?.[0]?.message?.content
      if (!content) throw new Error('The provider returned an empty response.')
      proposal.value = validateProposal(parseJsonObject(content), project.width, project.height)
      status.value = 'connected'
    } catch (error) {
      status.value = 'error'
      errorMessage.value =
        error instanceof Error ? error.message : 'The proposal could not be created.'
    }
  }

  const discardProposal = () => {
    proposal.value = null
    errorMessage.value = ''
  }

  return {
    connection,
    status,
    errorMessage,
    proposal,
    testConnection,
    requestProposal,
    discardProposal,
  }
}
