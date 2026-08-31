import type { Layer, Pixel, SpriteProject } from '~/types/editor'

export const makeId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`

export const emptyPixels = (width: number, height: number): Pixel[] =>
  Array.from({ length: width * height }, () => null)

export const cloneProject = (project: SpriteProject): SpriteProject =>
  JSON.parse(JSON.stringify(project)) as SpriteProject

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

    paintRect(body, width, 11, 10 + bounce, 10, 11, '#b9f5d0')
    paintRect(body, width, 9, 13 + bounce, 2, 6, '#7ed0aa')
    paintRect(body, width, 21, 13 + bounce, 2, 6, '#7ed0aa')
    paintRect(body, width, 12 + leg * 4, 21 + bounce, 3, 4, '#456b5a')
    paintRect(body, width, 17 - leg * 4, 21 + bounce, 3, 4, '#456b5a')
    paintRect(body, width, 13, 7 + bounce, 2, 3, '#b9f5d0')
    paintRect(body, width, 18, 7 + bounce, 2, 3, '#b9f5d0')
    paintRect(body, width, 12, 11 + bounce, 8, 1, '#d9ffe7')

    paintRect(detail, width, 13, 13 + bounce, 2, 2, '#16221c')
    paintRect(detail, width, 18, 13 + bounce, 2, 2, '#16221c')
    paintRect(detail, width, 15, 17 + bounce, 3, 1, '#ff875f')
    detail[(9 + bounce) * width + (frameIndex % 2 ? 23 : 8)] = '#ffd36a'
    detail[(8 + bounce) * width + (frameIndex % 2 ? 24 : 7)] = '#fff1bd'

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
    palette: [
      '#16221c',
      '#456b5a',
      '#7ed0aa',
      '#b9f5d0',
      '#d9ffe7',
      '#ff875f',
      '#ffd36a',
      '#fff1bd',
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
