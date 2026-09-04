import type { Pixel, SpriteProject } from '~/types/editor'
import { toRaw } from 'vue'

interface PixelSurface {
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  imageData: ImageData
}

let pixelSurface: PixelSurface | null = null

const getPixelSurface = (width: number, height: number): PixelSurface => {
  if (!pixelSurface) {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d')!
    pixelSurface = { canvas, context, imageData: context.createImageData(1, 1) }
  }
  if (pixelSurface.canvas.width !== width || pixelSurface.canvas.height !== height) {
    pixelSurface.canvas.width = width
    pixelSurface.canvas.height = height
    pixelSurface.context = pixelSurface.canvas.getContext('2d')!
    pixelSurface.imageData = pixelSurface.context.createImageData(width, height)
  }
  return pixelSurface
}

const drawPixelBuffer = (
  context: CanvasRenderingContext2D,
  pixels: Pixel[],
  width: number,
  height: number,
  scale: number,
) => {
  const surface = getPixelSurface(width, height)
  const data = surface.imageData.data
  data.fill(0)
  const source = toRaw(pixels)
  for (let index = 0; index < source.length; index += 1) {
    const pixel = source[index]
    if (!pixel) continue
    const color = Number.parseInt(pixel.slice(1), 16)
    if (Number.isNaN(color)) continue
    const offset = index * 4
    data[offset] = color >> 16
    data[offset + 1] = (color >> 8) & 0xff
    data[offset + 2] = color & 0xff
    data[offset + 3] = 0xff
  }
  surface.context.putImageData(surface.imageData, 0, 0)
  context.drawImage(surface.canvas, 0, 0, width, height, 0, 0, width * scale, height * scale)
}

export const drawPixelRuns = (
  context: CanvasRenderingContext2D,
  pixels: Pixel[],
  width: number,
  scale = 1,
  solidColor?: string,
) => {
  if (width <= 0) return
  const height = Math.ceil(pixels.length / width)
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * width
    for (let x = 0; x < width;) {
      const pixel = pixels[rowStart + x]
      if (!pixel) {
        x += 1
        continue
      }
      let runEnd = x + 1
      while (runEnd < width) {
        const nextPixel = pixels[rowStart + runEnd]
        if (solidColor ? !nextPixel : nextPixel !== pixel) break
        runEnd += 1
      }
      context.fillStyle = solidColor ?? pixel
      context.fillRect(x * scale, y * scale, (runEnd - x) * scale, scale)
      x = runEnd
    }
  }
}

export const getCompositePixels = (project: SpriteProject, frameId: string): Pixel[] => {
  const output: Pixel[] = Array.from({ length: project.width * project.height }, () => null)
  for (const layer of project.layers) {
    if (!layer.visible || layer.opacity <= 0) continue
    const cel = layer.cels[frameId]
    if (!cel) continue
    toRaw(cel).forEach((pixel, index) => {
      if (pixel) output[index] = pixel
    })
  }
  return output
}

export const drawProjectFrame = (
  context: CanvasRenderingContext2D,
  project: SpriteProject,
  frameId: string,
  scale = 1,
  clear = true,
) => {
  if (clear) context.clearRect(0, 0, project.width * scale, project.height * scale)
  context.imageSmoothingEnabled = false
  for (const layer of project.layers) {
    if (!layer.visible || layer.opacity <= 0) continue
    const pixels = layer.cels[frameId]
    if (!pixels) continue
    context.save()
    context.globalAlpha = layer.opacity
    drawPixelBuffer(context, pixels, project.width, project.height, scale)
    context.restore()
  }
}

export const drawLayerFrame = (
  context: CanvasRenderingContext2D,
  project: SpriteProject,
  frameId: string,
  layerId: string,
  scale = 1,
) => {
  context.clearRect(0, 0, project.width * scale, project.height * scale)
  context.imageSmoothingEnabled = false
  const layer = project.layers.find((item) => item.id === layerId)
  const pixels = layer?.cels[frameId]
  if (!layer || !pixels) return
  context.save()
  context.globalAlpha = layer.opacity
  drawPixelBuffer(context, pixels, project.width, project.height, scale)
  context.restore()
}
