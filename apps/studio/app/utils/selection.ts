import type { Pixel, PixelPoint, PixelSample } from '~/types/editor'

export interface SelectionPixelChange {
  index: number
  before: Pixel
  after: Pixel
}

const inBounds = (point: PixelPoint, width: number, height: number) =>
  point.x >= 0 && point.y >= 0 && point.x < width && point.y < height

export const captureColoredSelectionSamples = (
  pixels: Pixel[],
  width: number,
  points: PixelPoint[],
): PixelSample[] =>
  points.flatMap((point) => {
    const color = pixels[point.y * width + point.x] ?? null
    return color ? [{ ...point, color }] : []
  })

export const translateSelectionPoints = (
  points: PixelPoint[],
  offsetX: number,
  offsetY: number,
  width: number,
  height: number,
): PixelPoint[] =>
  points
    .map((point) => ({ x: point.x + offsetX, y: point.y + offsetY }))
    .filter((point) => inBounds(point, width, height))

export const planColoredSelectionMutation = (
  pixels: Pixel[],
  width: number,
  height: number,
  sourcePoints: PixelPoint[],
  targetSamples: PixelSample[],
): SelectionPixelChange[] => {
  const planned = new Map<number, SelectionPixelChange>()
  const setAfter = (index: number, after: Pixel) => {
    const existing = planned.get(index)
    planned.set(index, {
      index,
      before: existing?.before ?? pixels[index] ?? null,
      after,
    })
  }

  sourcePoints.forEach((point) => {
    if (!inBounds(point, width, height)) return
    const index = point.y * width + point.x
    if (pixels[index]) setAfter(index, null)
  })
  targetSamples.forEach((sample) => {
    if (!sample.color || !inBounds(sample, width, height)) return
    setAfter(sample.y * width + sample.x, sample.color)
  })

  return [...planned.values()].filter((change) => change.before !== change.after)
}

/**
 * Plans an atomic floating-selection commit. The complete mask remains
 * isolated while editing, but only colored samples mutate the destination.
 * Transparent cells therefore never erase unrelated destination artwork.
 */
export const planFloatingSelectionMutation = (
  pixels: Pixel[],
  width: number,
  height: number,
  originPoints: PixelPoint[],
  targetSamples: PixelSample[],
): SelectionPixelChange[] => {
  const planned = new Map<number, SelectionPixelChange>()
  const setAfter = (index: number, after: Pixel) => {
    const existing = planned.get(index)
    planned.set(index, {
      index,
      before: existing?.before ?? pixels[index] ?? null,
      after,
    })
  }
  originPoints.forEach((point) => {
    if (inBounds(point, width, height)) setAfter(point.y * width + point.x, null)
  })
  targetSamples.forEach((sample) => {
    if (sample.color && inBounds(sample, width, height))
      setAfter(sample.y * width + sample.x, sample.color)
  })
  return [...planned.values()].filter((change) => change.before !== change.after)
}

export const applySelectionPixelChanges = (pixels: Pixel[], changes: SelectionPixelChange[]) =>
  changes.forEach((change) => (pixels[change.index] = change.after))
