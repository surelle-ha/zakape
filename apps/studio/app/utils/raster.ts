import type {
  BrushShape,
  GradientDither,
  Pixel,
  PixelPoint,
  PixelSample,
  SprayDistribution,
} from '~/types/editor'
import { colorDistance, interpolateHex } from '~/utils/color'

export interface TiledPoint extends PixelPoint {
  sourceX: number
  sourceY: number
  column: number
  row: number
  inSourceTile: boolean
}

export const positiveModulo = (value: number, modulus: number) =>
  modulus > 0 ? ((value % modulus) + modulus) % modulus : 0

export const tiledSourceTile = (columns: number, rows: number) => ({
  column: Math.floor((Math.max(1, columns) - 1) / 2),
  row: Math.floor((Math.max(1, rows) - 1) / 2),
})

export const mapTiledPoint = (
  point: PixelPoint,
  sourceWidth: number,
  sourceHeight: number,
  columns: number,
  rows: number,
): TiledPoint => {
  const sourceTile = tiledSourceTile(columns, rows)
  const column = Math.floor(point.x / sourceWidth)
  const row = Math.floor(point.y / sourceHeight)
  return {
    ...point,
    sourceX: positiveModulo(point.x, sourceWidth),
    sourceY: positiveModulo(point.y, sourceHeight),
    column,
    row,
    inSourceTile: column === sourceTile.column && row === sourceTile.row,
  }
}

export const wrapRasterPoints = (
  points: PixelPoint[],
  width: number,
  height: number,
  brushSize = 1,
  brushShape: BrushShape = 'square',
): PixelPoint[] => {
  const wrapped = new Map<string, PixelPoint>()
  points.forEach((point) => {
    brushFootprint(point, brushSize, brushShape).forEach((footprint) => {
      const next = {
        x: positiveModulo(footprint.x, width),
        y: positiveModulo(footprint.y, height),
      }
      wrapped.set(`${next.x}:${next.y}`, next)
    })
  })
  return [...wrapped.values()]
}

export const rasterLine = (from: PixelPoint, to: PixelPoint): PixelPoint[] => {
  const points: PixelPoint[] = []
  let x = from.x
  let y = from.y
  const deltaX = Math.abs(to.x - from.x)
  const deltaY = -Math.abs(to.y - from.y)
  const stepX = from.x < to.x ? 1 : -1
  const stepY = from.y < to.y ? 1 : -1
  let error = deltaX + deltaY

  while (true) {
    points.push({ x, y })
    if (x === to.x && y === to.y) break
    const doubleError = 2 * error
    if (doubleError >= deltaY) {
      error += deltaY
      x += stepX
    }
    if (doubleError <= deltaX) {
      error += deltaX
      y += stepY
    }
  }

  return points
}

export const rasterRectangle = (from: PixelPoint, to: PixelPoint): PixelPoint[] => {
  const left = Math.min(from.x, to.x)
  const right = Math.max(from.x, to.x)
  const top = Math.min(from.y, to.y)
  const bottom = Math.max(from.y, to.y)
  const points = new Map<string, PixelPoint>()
  const add = (x: number, y: number) => points.set(`${x}:${y}`, { x, y })

  for (let x = left; x <= right; x += 1) {
    add(x, top)
    add(x, bottom)
  }
  for (let y = top; y <= bottom; y += 1) {
    add(left, y)
    add(right, y)
  }

  return [...points.values()]
}

export const rasterCircle = (from: PixelPoint, to: PixelPoint): PixelPoint[] => {
  const left = Math.min(from.x, to.x)
  const right = Math.max(from.x, to.x)
  const top = Math.min(from.y, to.y)
  const bottom = Math.max(from.y, to.y)
  const width = right - left + 1
  const height = bottom - top + 1
  if (width === 1 || height === 1) return rasterLine(from, to)

  const centerX = (left + right) / 2
  const centerY = (top + bottom) / 2
  const radiusX = Math.max(0.5, (right - left) / 2)
  const radiusY = Math.max(0.5, (bottom - top) / 2)
  const steps = Math.max(16, Math.ceil(Math.PI * Math.max(width, height) * 3))
  const points = new Map<string, PixelPoint>()

  for (let step = 0; step < steps; step += 1) {
    const angle = (step / steps) * Math.PI * 2
    const x = Math.round(centerX + Math.cos(angle) * radiusX)
    const y = Math.round(centerY + Math.sin(angle) * radiusY)
    points.set(`${x}:${y}`, { x, y })
  }

  return [...points.values()]
}

export const rasterFilledRectangle = (from: PixelPoint, to: PixelPoint): PixelPoint[] => {
  const left = Math.min(from.x, to.x)
  const right = Math.max(from.x, to.x)
  const top = Math.min(from.y, to.y)
  const bottom = Math.max(from.y, to.y)
  const points: PixelPoint[] = []
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) points.push({ x, y })
  }
  return points
}

export const brushFootprint = (
  center: PixelPoint,
  size: number,
  shape: BrushShape,
): PixelPoint[] => {
  const bounded = Math.max(1, Math.min(64, Math.round(size)))
  const radius = Math.floor((bounded - 1) / 2)
  const points: PixelPoint[] = []
  for (let y = -radius; y < bounded - radius; y += 1) {
    for (let x = -radius; x < bounded - radius; x += 1) {
      if (shape === 'circle') {
        const center = (bounded - 1) / 2
        const dx = x + radius - center
        const dy = y + radius - center
        if (dx * dx + dy * dy > (bounded / 2) ** 2) continue
      }
      points.push({ x: center.x + x, y: center.y + y })
    }
  }
  return points
}

export const expandRasterPoints = (
  points: PixelPoint[],
  size: number,
  shape: BrushShape,
): PixelPoint[] => {
  const unique = new Map<string, PixelPoint>()
  points.forEach((point) =>
    brushFootprint(point, size, shape).forEach((next) => unique.set(`${next.x}:${next.y}`, next)),
  )
  return [...unique.values()]
}

export const pixelPerfectPoints = (points: PixelPoint[]): PixelPoint[] => {
  if (points.length < 3) return points
  const unique = new Map(points.map((point) => [`${point.x}:${point.y}`, point]))
  const result = [...unique.values()]
  const remove = new Set<string>()
  for (let index = 1; index < result.length - 1; index += 1) {
    const previous = result[index - 1]!
    const current = result[index]!
    const next = result[index + 1]!
    const diagonalIn =
      Math.abs(previous.x - current.x) === 1 && Math.abs(previous.y - current.y) === 1
    const diagonalOut = Math.abs(next.x - current.x) === 1 && Math.abs(next.y - current.y) === 1
    const sameAxis = previous.x === next.x || previous.y === next.y
    if (diagonalIn && diagonalOut && sameAxis) remove.add(`${current.x}:${current.y}`)
  }
  return result.filter((point) => !remove.has(`${point.x}:${point.y}`))
}

export const rasterContour = (path: PixelPoint[], close = false): PixelPoint[] => {
  if (path.length < 2) return path
  const points: PixelPoint[] = []
  path.forEach((point, index) => {
    const next = path[index + 1] ?? (close ? path[0] : undefined)
    if (!next) return
    rasterLine(point, next).forEach((entry, entryIndex) => {
      if (index > 0 && entryIndex === 0) return
      points.push(entry)
    })
  })
  return [...new Map(points.map((point) => [`${point.x}:${point.y}`, point])).values()]
}

export const seededRandom = (seed: number) => {
  let state = seed >>> 0 || 1
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0
    return state / 0x100000000
  }
}

export const rasterSpray = (
  center: PixelPoint,
  radius: number,
  density: number,
  distribution: SprayDistribution,
  seed = 1,
): PixelPoint[] => {
  const boundedRadius = Math.max(1, Math.min(64, Math.round(radius)))
  const count = Math.max(
    1,
    Math.min(4096, Math.round((density / 100) * Math.PI * boundedRadius ** 2)),
  )
  const random = seededRandom(seed)
  const points = new Map<string, PixelPoint>()
  for (let index = 0; index < count; index += 1) {
    const angle = random() * Math.PI * 2
    // Squaring biases samples toward the centre while remaining deterministic.
    const rawDistance = distribution === 'gaussian' ? random() * random() : random()
    const distance =
      distribution === 'edge'
        ? boundedRadius * (0.7 + rawDistance * 0.3)
        : boundedRadius * rawDistance
    const point = {
      x: Math.round(center.x + Math.cos(angle) * distance),
      y: Math.round(center.y + Math.sin(angle) * distance),
    }
    points.set(`${point.x}:${point.y}`, point)
  }
  return [...points.values()]
}

export const rasterFilledEllipse = (from: PixelPoint, to: PixelPoint): PixelPoint[] => {
  const left = Math.min(from.x, to.x)
  const right = Math.max(from.x, to.x)
  const top = Math.min(from.y, to.y)
  const bottom = Math.max(from.y, to.y)
  const centerX = (left + right) / 2
  const centerY = (top + bottom) / 2
  const radiusX = Math.max(0.5, (right - left + 1) / 2)
  const radiusY = Math.max(0.5, (bottom - top + 1) / 2)
  const points: PixelPoint[] = []
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      if (((x + 0.5 - centerX) / radiusX) ** 2 + ((y + 0.5 - centerY) / radiusY) ** 2 <= 1)
        points.push({ x, y })
    }
  }
  return points
}

export const gradientSamples = (
  from: PixelPoint,
  to: PixelPoint,
  bounds: PixelBounds,
  firstColor: string,
  secondColor: string,
  mode: 'linear' | 'radial',
  dither: GradientDither = 'none',
): PixelSample[] => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const lengthSquared = Math.max(1, dx * dx + dy * dy)
  const radius = Math.max(1, Math.hypot(dx, dy))
  const pattern =
    dither === 'checker'
      ? [
          [0, 1],
          [1, 0],
        ]
      : dither === 'quarter'
        ? [
            [0, 1, 0, 1],
            [0, 0, 0, 0],
            [0, 1, 0, 1],
            [0, 0, 0, 0],
          ]
        : [
            [0, 0, 0, 1],
            [0, 0, 1, 0],
            [0, 1, 0, 0],
            [1, 0, 0, 0],
          ]
  const samples: PixelSample[] = []
  for (let y = bounds.top; y <= bounds.bottom; y += 1) {
    for (let x = bounds.left; x <= bounds.right; x += 1) {
      const projection = ((x - from.x) * dx + (y - from.y) * dy) / lengthSquared
      const distance = mode === 'radial' ? Math.hypot(x - from.x, y - from.y) / radius : projection
      let amount = Math.max(0, Math.min(1, distance))
      if (dither !== 'none') {
        const threshold = pattern[y % pattern.length]![x % pattern[0]!.length]!
        amount = Math.max(0, Math.min(1, amount + (threshold ? 0.08 : -0.08)))
      }
      samples.push({ x, y, color: interpolateHex(firstColor, secondColor, amount) })
    }
  }
  return samples
}

export const matchingPixels = (
  pixels: Pixel[],
  width: number,
  height: number,
  start: PixelPoint,
  replacement: Pixel,
  tolerance: number,
  connectivity: 4 | 8,
): PixelPoint[] => {
  const target = pixels[start.y * width + start.x] ?? null
  if (colorDistance(target, replacement) <= 0) return []
  const queue = [start]
  const visited = new Uint8Array(width * height)
  const result: PixelPoint[] = []
  visited[start.y * width + start.x] = 1
  const directions = connectivity === 8 ? [-1, 0, 1] : [0, 1, -1]
  while (queue.length) {
    const point = queue.shift()!
    if (colorDistance(pixels[point.y * width + point.x] ?? null, target) > tolerance) continue
    result.push(point)
    for (const y of directions)
      for (const x of directions) {
        if (x === 0 && y === 0) continue
        if (connectivity === 4 && x !== 0 && y !== 0) continue
        const next = { x: point.x + x, y: point.y + y }
        if (next.x < 0 || next.y < 0 || next.x >= width || next.y >= height) continue
        const index = next.y * width + next.x
        if (visited[index]) continue
        visited[index] = 1
        queue.push(next)
      }
  }
  return result
}

/** Return every pixel within tolerance of the starting color, regardless of connectivity. */
export const matchingPixelsNonContiguous = (
  pixels: Pixel[],
  width: number,
  height: number,
  start: PixelPoint,
  tolerance: number,
): PixelPoint[] => {
  const target = pixels[start.y * width + start.x] ?? null
  const result: PixelPoint[] = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (colorDistance(pixels[y * width + x] ?? null, target) <= tolerance) result.push({ x, y })
    }
  }
  return result
}

const pointInsidePolygon = (point: PixelPoint, polygon: PixelPoint[]) => {
  let inside = false
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index]!
    const previousPoint = polygon[previous]!
    const intersects =
      currentPoint.y > point.y !== previousPoint.y > point.y &&
      point.x <
        ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
          (previousPoint.y - currentPoint.y) +
          currentPoint.x
    if (intersects) inside = !inside
  }
  return inside
}

export const rasterLassoSelection = (
  path: PixelPoint[],
  width: number,
  height: number,
): PixelPoint[] => {
  if (path.length === 0) return []
  const boundary = new Map<string, PixelPoint>()
  path.forEach((point, index) => {
    const next = path[(index + 1) % path.length]!
    rasterLine(point, next).forEach((entry) => {
      if (entry.x >= 0 && entry.y >= 0 && entry.x < width && entry.y < height) {
        boundary.set(`${entry.x}:${entry.y}`, entry)
      }
    })
  })
  if (path.length < 3) return [...boundary.values()]

  const left = Math.max(0, Math.min(...path.map((point) => point.x)))
  const right = Math.min(width - 1, Math.max(...path.map((point) => point.x)))
  const top = Math.max(0, Math.min(...path.map((point) => point.y)))
  const bottom = Math.min(height - 1, Math.max(...path.map((point) => point.y)))
  const polygon = path.map((point) => ({ x: point.x + 0.5, y: point.y + 0.5 }))
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      if (pointInsidePolygon({ x: x + 0.5, y: y + 0.5 }, polygon)) {
        boundary.set(`${x}:${y}`, { x, y })
      }
    }
  }
  return [...boundary.values()]
}

export interface PixelBounds {
  left: number
  right: number
  top: number
  bottom: number
}

export const pixelBounds = (points: PixelPoint[]): PixelBounds => ({
  left: Math.min(...points.map((point) => point.x)),
  right: Math.max(...points.map((point) => point.x)),
  top: Math.min(...points.map((point) => point.y)),
  bottom: Math.max(...points.map((point) => point.y)),
})

const sampleMap = (samples: PixelSample[]) =>
  new Map(samples.map((sample) => [`${sample.x}:${sample.y}`, sample]))

export const resizePixelSamples = (samples: PixelSample[], target: PixelBounds): PixelSample[] => {
  if (!samples.length) return []
  const source = pixelBounds(samples)
  const sourceWidth = source.right - source.left + 1
  const sourceHeight = source.bottom - source.top + 1
  const targetWidth = target.right - target.left + 1
  const targetHeight = target.bottom - target.top + 1
  const byPoint = sampleMap(samples)
  const resized: PixelSample[] = []

  for (let y = target.top; y <= target.bottom; y += 1) {
    const sourceY =
      source.top +
      Math.min(sourceHeight - 1, Math.floor(((y - target.top) * sourceHeight) / targetHeight))
    for (let x = target.left; x <= target.right; x += 1) {
      const sourceX =
        source.left +
        Math.min(sourceWidth - 1, Math.floor(((x - target.left) * sourceWidth) / targetWidth))
      const sample = byPoint.get(`${sourceX}:${sourceY}`)
      if (sample) resized.push({ x, y, color: sample.color })
    }
  }

  return resized
}

export const rotatePixelSamples = (
  samples: PixelSample[],
  angleRadians: number,
  canvasWidth: number,
  canvasHeight: number,
): PixelSample[] => {
  if (!samples.length) return []
  const source = pixelBounds(samples)
  const byPoint = sampleMap(samples)
  const centerX = (source.left + source.right + 1) / 2
  const centerY = (source.top + source.bottom + 1) / 2
  const cosine = Math.cos(angleRadians)
  const sine = Math.sin(angleRadians)
  const corners = [
    { x: source.left, y: source.top },
    { x: source.right + 1, y: source.top },
    { x: source.right + 1, y: source.bottom + 1 },
    { x: source.left, y: source.bottom + 1 },
  ].map((corner) => ({
    x: centerX + (corner.x - centerX) * cosine - (corner.y - centerY) * sine,
    y: centerY + (corner.x - centerX) * sine + (corner.y - centerY) * cosine,
  }))
  const left = Math.max(0, Math.floor(Math.min(...corners.map((point) => point.x))))
  const right = Math.min(
    canvasWidth - 1,
    Math.ceil(Math.max(...corners.map((point) => point.x))) - 1,
  )
  const top = Math.max(0, Math.floor(Math.min(...corners.map((point) => point.y))))
  const bottom = Math.min(
    canvasHeight - 1,
    Math.ceil(Math.max(...corners.map((point) => point.y))) - 1,
  )
  const rotated: PixelSample[] = []

  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      const deltaX = x + 0.5 - centerX
      const deltaY = y + 0.5 - centerY
      const sourceX = Math.floor(centerX + deltaX * cosine + deltaY * sine + 1e-8)
      const sourceY = Math.floor(centerY - deltaX * sine + deltaY * cosine + 1e-8)
      const sample = byPoint.get(`${sourceX}:${sourceY}`)
      if (sample) rotated.push({ x, y, color: sample.color })
    }
  }

  return rotated
}
