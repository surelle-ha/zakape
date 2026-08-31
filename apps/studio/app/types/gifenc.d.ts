declare module 'gifenc' {
  export type GifPalette = number[][]

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: string },
  ): GifPalette

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: GifPalette,
    format?: string,
  ): Uint8Array

  export function GIFEncoder(): {
    writeFrame: (
      index: Uint8Array,
      width: number,
      height: number,
      options: {
        palette: GifPalette
        delay?: number
        transparent?: boolean
        repeat?: number
      },
    ) => void
    finish: () => void
    bytes: () => Uint8Array
  }
}
