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
