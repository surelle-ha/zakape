import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CANVAS_ZOOM,
  MIN_CANVAS_ZOOM,
  adjustCanvasZoom,
  pinchCanvasZoom,
} from '~/utils/zoom'

describe('canvas zoom', () => {
  it('keeps step zooming open-ended beyond the old toolbar range', () => {
    expect(adjustCanvasZoom(24, 1)).toBe(25)
    expect(adjustCanvasZoom(4, -1)).toBe(3)
    expect(adjustCanvasZoom(40, 8)).toBe(48)
  })

  it('keeps zoom positive and recovers from invalid values', () => {
    expect(adjustCanvasZoom(MIN_CANVAS_ZOOM, -1)).toBe(MIN_CANVAS_ZOOM)
    expect(adjustCanvasZoom(Number.NaN, 1)).toBe(DEFAULT_CANVAS_ZOOM + 1)
    expect(pinchCanvasZoom(8, 0.5)).toBe(4)
  })
})
