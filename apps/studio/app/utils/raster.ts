import type { PixelPoint } from '~/types/editor'

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
