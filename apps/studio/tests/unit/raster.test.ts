import { describe, expect, it } from 'vitest'
import { rasterLine, rasterRectangle } from '~/utils/raster'

describe('raster previews', () => {
  it('creates a continuous line between pointer positions', () => {
    expect(rasterLine({ x: 1, y: 1 }, { x: 4, y: 3 })).toEqual([
      { x: 1, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 4, y: 3 },
    ])
  })

  it('creates an outline without filling the rectangle interior', () => {
    const points = rasterRectangle({ x: 1, y: 1 }, { x: 3, y: 3 })

    expect(points).toHaveLength(8)
    expect(points).toContainEqual({ x: 1, y: 1 })
    expect(points).toContainEqual({ x: 3, y: 3 })
    expect(points).not.toContainEqual({ x: 2, y: 2 })
  })
})
