import type { PixelPoint, PixelSample } from '~/types/editor'

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
