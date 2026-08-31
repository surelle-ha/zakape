import type { Pixel, SpriteProject } from '~/types/editor'

export const getCompositePixels = (project: SpriteProject, frameId: string): Pixel[] => {
  const output: Pixel[] = Array.from({ length: project.width * project.height }, () => null)
  for (const layer of project.layers) {
    if (!layer.visible || layer.opacity <= 0) continue
    const cel = layer.cels[frameId]
    if (!cel) continue
    cel.forEach((pixel, index) => {
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
) => {
  context.clearRect(0, 0, project.width * scale, project.height * scale)
  context.imageSmoothingEnabled = false
  for (const layer of project.layers) {
    if (!layer.visible || layer.opacity <= 0) continue
    const pixels = layer.cels[frameId]
    if (!pixels) continue
    context.save()
    context.globalAlpha = layer.opacity
    pixels.forEach((pixel, index) => {
      if (!pixel) return
      context.fillStyle = pixel
      context.fillRect(
        (index % project.width) * scale,
        Math.floor(index / project.width) * scale,
        scale,
        scale,
      )
    })
    context.restore()
  }
}
