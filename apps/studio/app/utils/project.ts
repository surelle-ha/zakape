import type { CanvasBackground, ColorMode, Layer, Pixel, SpriteProject } from '~/types/editor'
import { defaultPalette, normalizePalette } from '~/utils/palettes'

export const makeId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`

export const emptyPixels = (width: number, height: number): Pixel[] =>
  Array.from({ length: width * height }, () => null)

export const cloneProject = (project: SpriteProject): SpriteProject =>
  JSON.parse(JSON.stringify(project)) as SpriteProject

export const createBlankProject = (
  width = 32,
  height = width,
  name = 'Untitled sprite',
  colorMode: ColorMode = 'rgba',
  background: CanvasBackground = 'transparent',
  selectedPalette: string[] = defaultPalette,
): SpriteProject => {
  const canvasWidth = Math.max(1, Math.min(1024, Math.round(width)))
  const canvasHeight = Math.max(1, Math.min(1024, Math.round(height)))
  if (canvasWidth * canvasHeight > 1_048_576) {
    throw new Error('A canvas can contain at most 1,048,576 pixels.')
  }
  const now = new Date().toISOString()
  const frameId = makeId('frame')
  const backgroundColor =
    background === 'black' ? '#000000' : background === 'white' ? '#ffffff' : null
  const normalizedPalette = normalizePalette(selectedPalette)
  const palette =
    colorMode === 'grayscale'
      ? ['#000000', '#333333', '#666666', '#999999', '#cccccc', '#ffffff']
      : normalizedPalette.length
        ? normalizedPalette
        : [...defaultPalette]
  return {
    version: 1,
    id: makeId('project'),
    name: name.trim().slice(0, 64) || 'Untitled sprite',
    width: canvasWidth,
    height: canvasHeight,
    colorMode,
    background,
    palette,
    frames: [{ id: frameId, name: 'F1', duration: 120 }],
    layers: [
      {
        id: makeId('layer'),
        name: 'Pixel layer',
        visible: true,
        opacity: 1,
        cels: {
          [frameId]: Array.from({ length: canvasWidth * canvasHeight }, () => backgroundColor),
        },
      },
    ],
    createdAt: now,
    updatedAt: now,
  }
}

const paintRect = (
  pixels: Pixel[],
  canvasWidth: number,
  x: number,
  y: number,
  width: number,
  height: number,
  color: string,
) => {
  for (let row = y; row < y + height; row += 1) {
    for (let column = x; column < x + width; column += 1) {
      pixels[row * canvasWidth + column] = color
    }
  }
}

export const createDemoProject = (): SpriteProject => {
  const width = 32
  const height = 32
  const now = new Date().toISOString()
  const frames = [0, 1, 2, 3].map((index) => ({
    id: `frame_${index + 1}`,
    name: `F${index + 1}`,
    duration: index === 1 || index === 3 ? 140 : 110,
  }))
  const bodyCels: Record<string, Pixel[]> = {}
  const detailCels: Record<string, Pixel[]> = {}

  frames.forEach((frame, frameIndex) => {
    const body = emptyPixels(width, height)
    const detail = emptyPixels(width, height)
    const bounce = frameIndex === 1 ? -1 : frameIndex === 3 ? 1 : 0
    const leg = frameIndex % 2

    paintRect(body, width, 11, 10 + bounce, 10, 11, '#c4b5fd')
    paintRect(body, width, 9, 13 + bounce, 2, 6, '#8b5cf6')
    paintRect(body, width, 21, 13 + bounce, 2, 6, '#8b5cf6')
    paintRect(body, width, 12 + leg * 4, 21 + bounce, 3, 4, '#5b3f82')
    paintRect(body, width, 17 - leg * 4, 21 + bounce, 3, 4, '#5b3f82')
    paintRect(body, width, 13, 7 + bounce, 2, 3, '#c4b5fd')
    paintRect(body, width, 18, 7 + bounce, 2, 3, '#c4b5fd')
    paintRect(body, width, 12, 11 + bounce, 8, 1, '#ede9fe')

    paintRect(detail, width, 13, 13 + bounce, 2, 2, '#1c1628')
    paintRect(detail, width, 18, 13 + bounce, 2, 2, '#1c1628')
    paintRect(detail, width, 15, 17 + bounce, 3, 1, '#d946ef')
    detail[(9 + bounce) * width + (frameIndex % 2 ? 23 : 8)] = '#e9d5ff'
    detail[(8 + bounce) * width + (frameIndex % 2 ? 24 : 7)] = '#fae8ff'

    bodyCels[frame.id] = body
    detailCels[frame.id] = detail
  })

  const layers: Layer[] = [
    {
      id: 'layer_body',
      name: 'Mint runner',
      visible: true,
      opacity: 1,
      cels: bodyCels,
    },
    {
      id: 'layer_details',
      name: 'Face + spark',
      visible: true,
      opacity: 1,
      cels: detailCels,
    },
  ]

  return {
    version: 1,
    id: 'welcome-sprite',
    name: 'Mint runner',
    width,
    height,
    colorMode: 'rgba',
    background: 'transparent',
    palette: [
      '#1c1628',
      '#5b3f82',
      '#8b5cf6',
      '#c4b5fd',
      '#ede9fe',
      '#d946ef',
      '#e9d5ff',
      '#fae8ff',
    ],
    frames,
    layers,
    createdAt: now,
    updatedAt: now,
  }
}

export const normalizeHex = (color: string): string | null => {
  const value = color.trim()
  if (/^#[\da-f]{6}$/i.test(value)) return value.toLowerCase()
  if (/^#[\da-f]{3}$/i.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`.toLowerCase()
  }
  return null
}

const colorChannels = (color: string) => [
  Number.parseInt(color.slice(1, 3), 16),
  Number.parseInt(color.slice(3, 5), 16),
  Number.parseInt(color.slice(5, 7), 16),
]

export const coercePixelToColorMode = (project: SpriteProject, color: Pixel): Pixel => {
  if (!color || project.colorMode === 'rgba') return color
  const normalized = normalizeHex(color)
  if (!normalized) return color
  const channels = colorChannels(normalized)
  if (project.colorMode === 'grayscale') {
    const value = Math.round(channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722)
    const hex = value.toString(16).padStart(2, '0')
    return `#${hex}${hex}${hex}`
  }
  const palette = project.palette
    .map(normalizeHex)
    .filter((entry): entry is string => Boolean(entry))
  return palette.reduce(
    (nearest, candidate) => {
      const candidateChannels = colorChannels(candidate)
      const distance = candidateChannels.reduce(
        (sum, channel, index) => sum + (channel - channels[index]!) ** 2,
        0,
      )
      return distance < nearest.distance ? { color: candidate, distance } : nearest
    },
    { color: normalized, distance: Number.POSITIVE_INFINITY },
  ).color
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const isSafeId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-z0-9_-]{1,128}$/i.test(value)

const unsupportedProject = () =>
  new Error('This project is invalid or unsupported. Open a .zakape file exported by Zakape.')

export const parseSpriteProject = (input: unknown): SpriteProject => {
  if (!isRecord(input)) throw unsupportedProject()
  const width = Number(input.width)
  const height = Number(input.height)
  if (
    input.version !== 1 ||
    !isSafeId(input.id) ||
    typeof input.name !== 'string' ||
    !input.name.trim() ||
    input.name.length > 64 ||
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 1024 ||
    height > 1024 ||
    width * height > 1_048_576 ||
    (input.colorMode !== undefined &&
      !['rgba', 'grayscale', 'indexed'].includes(String(input.colorMode))) ||
    (input.background !== undefined &&
      !['transparent', 'black', 'white'].includes(String(input.background))) ||
    typeof input.createdAt !== 'string' ||
    typeof input.updatedAt !== 'string' ||
    !Array.isArray(input.palette) ||
    input.palette.length > 256 ||
    !input.palette.every((color) => typeof color === 'string' && normalizeHex(color)) ||
    !Array.isArray(input.frames) ||
    input.frames.length < 1 ||
    input.frames.length > 512 ||
    !Array.isArray(input.layers) ||
    input.layers.length < 1 ||
    input.layers.length > 256
  ) {
    throw unsupportedProject()
  }

  const frameIds = new Set<string>()
  for (const frame of input.frames) {
    if (
      !isRecord(frame) ||
      !isSafeId(frame.id) ||
      frameIds.has(frame.id) ||
      typeof frame.name !== 'string' ||
      frame.name.length > 64 ||
      typeof frame.duration !== 'number' ||
      !Number.isFinite(frame.duration) ||
      frame.duration <= 0 ||
      frame.duration > 60_000
    ) {
      throw unsupportedProject()
    }
    frameIds.add(frame.id)
  }

  const layerIds = new Set<string>()
  for (const layer of input.layers) {
    if (
      !isRecord(layer) ||
      !isSafeId(layer.id) ||
      layerIds.has(layer.id) ||
      typeof layer.name !== 'string' ||
      !layer.name.trim() ||
      layer.name.length > 64 ||
      typeof layer.visible !== 'boolean' ||
      typeof layer.opacity !== 'number' ||
      !Number.isFinite(layer.opacity) ||
      layer.opacity < 0 ||
      layer.opacity > 1 ||
      !isRecord(layer.cels)
    ) {
      throw unsupportedProject()
    }
    layerIds.add(layer.id)
    for (const frameId of frameIds) {
      const pixels = layer.cels[frameId]
      if (
        !Array.isArray(pixels) ||
        pixels.length !== width * height ||
        !pixels.every(
          (pixel) => pixel === null || (typeof pixel === 'string' && Boolean(normalizeHex(pixel))),
        )
      ) {
        throw unsupportedProject()
      }
    }
  }

  const project = cloneProject(input as unknown as SpriteProject)
  project.colorMode ??= 'rgba'
  project.background ??= 'transparent'
  return project
}
