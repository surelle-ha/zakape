import { describe, expect, it, vi } from 'vitest'
import { drawPixelRuns, drawRepeatedSurface, nativeCanvasSize } from '~/utils/render'

describe('pixel rendering', () => {
  it('keeps high-resolution backing stores independent from visual zoom', () => {
    expect(nativeCanvasSize(1024, 1024)).toEqual({ width: 1024, height: 1024 })
    expect(nativeCanvasSize(1024, 1024, 3, 3)).toEqual({ width: 3072, height: 3072 })
  })
  it('draws contiguous colors as horizontal runs without crossing rows', () => {
    const context = {
      fillStyle: '',
      fillRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D

    drawPixelRuns(context, ['#ffffff', '#ffffff', null, '#ff00ff', '#ff00ff', '#ff00ff'], 3, 4)

    expect(context.fillRect).toHaveBeenCalledTimes(2)
    expect(context.fillRect).toHaveBeenNthCalledWith(1, 0, 0, 8, 4)
    expect(context.fillRect).toHaveBeenNthCalledWith(2, 0, 4, 12, 4)
  })

  it('merges adjacent occupied pixels when drawing a solid onion-skin tint', () => {
    const context = {
      fillStyle: '',
      fillRect: vi.fn(),
    } as unknown as CanvasRenderingContext2D

    drawPixelRuns(context, ['#111111', '#222222', null, '#333333'], 4, 2, '#c4b5fd')

    expect(context.fillRect).toHaveBeenCalledTimes(2)
    expect(context.fillRect).toHaveBeenNthCalledWith(1, 0, 0, 4, 2)
    expect(context.fillRect).toHaveBeenNthCalledWith(2, 6, 0, 2, 2)
    expect(context.fillStyle).toBe('#c4b5fd')
  })

  it('blits one composed source surface across the requested grid', () => {
    const context = {
      imageSmoothingEnabled: true,
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D
    const source = {} as CanvasImageSource

    drawRepeatedSurface(context, source, 32, 24, 3, 2)

    expect(context.imageSmoothingEnabled).toBe(false)
    expect(context.drawImage).toHaveBeenCalledTimes(6)
    expect(context.drawImage).toHaveBeenLastCalledWith(source, 64, 24, 32, 24)
  })
})
