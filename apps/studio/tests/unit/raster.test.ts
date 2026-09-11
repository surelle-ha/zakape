import { describe, expect, it } from 'vitest'
import {
  rasterFilledRectangle,
  rasterCircle,
  rasterLassoSelection,
  rasterLine,
  rasterRectangle,
  resizePixelSamples,
  rotatePixelSamples,
  mapTiledPoint,
  positiveModulo,
  tiledSourceTile,
  wrapRasterPoints,
  brushFootprint,
  pixelPerfectPoints,
  rasterFilledEllipse,
  rasterSpray,
  gradientSamples,
  matchingPixels,
  matchingPixelsNonContiguous,
} from '~/utils/raster'

describe('raster previews', () => {
  it('maps repeated canvas coordinates through positive modulo', () => {
    expect(positiveModulo(-1, 8)).toBe(7)
    expect(positiveModulo(9, 8)).toBe(1)
    expect(mapTiledPoint({ x: 17, y: 23 }, 8, 10, 3, 3)).toEqual({
      x: 17,
      y: 23,
      sourceX: 1,
      sourceY: 3,
      column: 2,
      row: 2,
      inSourceTile: false,
    })
  })

  it('selects the upper-left central tile for even grids', () => {
    expect(tiledSourceTile(3, 3)).toEqual({ column: 1, row: 1 })
    expect(tiledSourceTile(2, 2)).toEqual({ column: 0, row: 0 })
    expect(tiledSourceTile(4, 6)).toEqual({ column: 1, row: 2 })
  })

  it('wraps brush footprints over edges and deduplicates source pixels', () => {
    expect(wrapRasterPoints([{ x: 0, y: 0 }], 4, 4, 2)).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ])
    expect(
      wrapRasterPoints(
        [
          { x: -1, y: 3 },
          { x: 3, y: 3 },
        ],
        4,
        4,
      ),
    ).toEqual([{ x: 3, y: 3 }])
  })
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

  it('flips selection content when a resize handle crosses its opposite edge', () => {
    const samples = [
      { x: 1, y: 0, color: '#111111' },
      { x: 2, y: 0, color: '#222222' },
    ]
    expect(resizePixelSamples(samples, { left: 1, right: 2, top: 0, bottom: 0 }, true)).toEqual([
      { x: 1, y: 0, color: '#222222' },
      { x: 2, y: 0, color: '#111111' },
    ])
  })

  it('supports bounded brush footprints and conservative pixel-perfect cleanup', () => {
    expect(brushFootprint({ x: 2, y: 2 }, 3, 'circle')).toHaveLength(9)
    expect(brushFootprint({ x: 2, y: 2 }, 5, 'circle').length).toBeLessThan(25)
    expect(
      pixelPerfectPoints([
        { x: 0, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 0 },
      ]),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ])
  })

  it('creates deterministic sprays and clipped filled ellipses', () => {
    expect(rasterSpray({ x: 4, y: 4 }, 4, 50, 'uniform', 42)).toEqual(
      rasterSpray({ x: 4, y: 4 }, 4, 50, 'uniform', 42),
    )
    expect(
      rasterFilledEllipse({ x: 0, y: 0 }, { x: 4, y: 2 }).every(
        (point) => point.x >= 0 && point.y >= 0,
      ),
    ).toBe(true)
  })

  it('supports tolerance, connectivity, and non-contiguous matching', () => {
    const pixels = ['#000000', '#010101', '#ffffff', '#000000']
    expect(matchingPixels(pixels, 2, 2, { x: 0, y: 0 }, '#ffffff', 2, 4)).toHaveLength(3)
    expect(matchingPixelsNonContiguous(pixels, 2, 2, { x: 0, y: 0 }, 2)).toHaveLength(3)
  })

  it('samples gradients with an ordered dither pattern', () => {
    const samples = gradientSamples(
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { left: 0, top: 0, right: 3, bottom: 1 },
      '#000000',
      '#ffffff',
      'linear',
      'checker',
    )
    expect(samples).toHaveLength(8)
    expect(samples[0]!.color).not.toBe(samples[1]!.color)
  })
})
