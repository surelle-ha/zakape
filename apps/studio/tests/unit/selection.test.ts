import { describe, expect, it } from 'vitest'
import type { Pixel } from '~/types/editor'
import {
  applySelectionPixelChanges,
  captureColoredSelectionSamples,
  planColoredSelectionMutation,
  planFloatingSelectionMutation,
  translateSelectionPoints,
} from '~/utils/selection'

describe('selection pixel mutations', () => {
  it('captures only colored pixels while translating the complete mask', () => {
    const pixels: Pixel[] = ['#ff0000', null, null, '#00ff00']
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]

    expect(captureColoredSelectionSamples(pixels, 2, points)).toEqual([
      { x: 0, y: 0, color: '#ff0000' },
    ])
    expect(translateSelectionPoints(points, 0, 1, 2, 2)).toEqual([
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ])
  })

  it('cuts colored pixels without erasing destinations under transparent holes', () => {
    const pixels: Pixel[] = ['#ff0000', null, '#0000ff', '#00ff00']
    const source = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ]
    const target = [
      { x: 0, y: 1, color: '#ff0000' },
      { x: 1, y: 1, color: null },
    ]

    const changes = planColoredSelectionMutation(pixels, 2, 2, source, target)
    applySelectionPixelChanges(pixels, changes)

    expect(pixels).toEqual([null, null, '#ff0000', '#00ff00'])
  })

  it('captures before values before applying overlapping moves', () => {
    const pixels: Pixel[] = ['#111111', '#222222', '#333333', null]
    const changes = planColoredSelectionMutation(
      pixels,
      4,
      1,
      [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      [
        { x: 1, y: 0, color: '#111111' },
        { x: 2, y: 0, color: '#222222' },
      ],
    )
    applySelectionPixelChanges(pixels, changes)

    expect(pixels).toEqual([null, '#111111', '#222222', null])
    expect(changes.find((change) => change.index === 1)?.before).toBe('#222222')
  })

  it('clips targets and produces no changes for transparent-only selections', () => {
    const pixels: Pixel[] = [null, null, '#445566', null]
    expect(
      planColoredSelectionMutation(
        pixels,
        2,
        2,
        [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
        ],
        [
          { x: 2, y: 0, color: null },
          { x: -1, y: 0, color: '#ffffff' },
        ],
      ),
    ).toEqual([])
  })

  it('commits colored floating pixels without erasing destination art through transparent holes', () => {
    const pixels: Pixel[] = ['#ff0000', '#00ff00', '#0000ff', '#ffffff']
    const changes = planFloatingSelectionMutation(
      pixels,
      4,
      1,
      [{ x: 0, y: 0 }, { x: 1, y: 0 }],
      [{ x: 2, y: 0, color: '#ff0000' }, { x: 3, y: 0, color: null }],
    )
    applySelectionPixelChanges(pixels, changes)
    expect(pixels).toEqual([null, null, '#ff0000', '#ffffff'])
  })
})
