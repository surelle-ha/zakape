import { describe, expect, it } from 'vitest'
import {
  rasterFilledRectangle,
  rasterCircle,
  rasterLassoSelection,
  rasterLine,
  rasterRectangle,
  resizePixelSamples,
  rotatePixelSamples,
} from '~/utils/raster'

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

  it('fills box selections and closes lasso selections', () => {
    expect(rasterFilledRectangle({ x: 1, y: 1 }, { x: 3, y: 2 })).toHaveLength(6)

    const lasso = rasterLassoSelection(
      [
        { x: 1, y: 1 },
        { x: 4, y: 1 },
        { x: 4, y: 4 },
        { x: 1, y: 4 },
      ],
      8,
      8,
    )
    expect(lasso).toContainEqual({ x: 2, y: 2 })
    expect(lasso).not.toContainEqual({ x: 6, y: 6 })
  })

  it('creates a crisp circle outline inside the dragged bounds', () => {
    const points = rasterCircle({ x: 1, y: 1 }, { x: 7, y: 7 })

    expect(points).toContainEqual({ x: 4, y: 1 })
    expect(points).toContainEqual({ x: 7, y: 4 })
    expect(points).not.toContainEqual({ x: 4, y: 4 })
  })

  it('resizes and rotates selection pixels with nearest-neighbor sampling', () => {
    const samples = [
      { x: 1, y: 1, color: '#ffffff' },
      { x: 2, y: 1, color: '#000000' },
    ]
    const resized = resizePixelSamples(samples, { left: 2, right: 5, top: 2, bottom: 3 })
    expect(resized).toHaveLength(8)
    expect(resized.filter((sample) => sample.color === '#ffffff')).toHaveLength(4)
    expect(resized.filter((sample) => sample.color === '#000000')).toHaveLength(4)

    const rotated = rotatePixelSamples(samples, Math.PI / 2, 8, 8)
    expect(rotated).toHaveLength(2)
    expect(new Set(rotated.map((sample) => sample.x))).toHaveLength(1)
  })
})
