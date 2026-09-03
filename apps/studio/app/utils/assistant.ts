import type {
  ArtOperation,
  AssistantArtEdit,
  AssistantProjectAction,
  Pixel,
  SpriteProject,
} from '~/types/editor'
import { coercePixelToColorMode, emptyPixels, normalizeHex } from '~/utils/project'

const applyOperation = (project: SpriteProject, pixels: Pixel[], operation: ArtOperation) => {
  const set = (x: number, y: number, color: Pixel) => {
    if (x < 0 || y < 0 || x >= project.width || y >= project.height) return
    const nextColor = coercePixelToColorMode(project, color)
    pixels[y * project.width + x] = nextColor
    if (nextColor && !project.palette.some((entry) => entry.toLowerCase() === nextColor)) {
      project.palette.push(nextColor)
    }
  }

  if (operation.type === 'set_pixels') {
    operation.pixels.forEach((pixel) => set(pixel.x, pixel.y, pixel.color))
    return
  }
  if (operation.type === 'fill_rect' || operation.type === 'outline_rect') {
    for (let y = operation.y; y < operation.y + operation.height; y += 1) {
      for (let x = operation.x; x < operation.x + operation.width; x += 1) {
        if (
          operation.type === 'fill_rect' ||
          x === operation.x ||
          y === operation.y ||
          x === operation.x + operation.width - 1 ||
          y === operation.y + operation.height - 1
        ) {
          set(x, y, operation.color)
        }
      }
    }
    return
  }

  if (operation.type === 'replace_palette_color') {
    const from = normalizeHex(operation.from)
    pixels.forEach((pixel, index) => {
      if (pixel?.toLowerCase() === from) {
        const nextColor = coercePixelToColorMode(project, operation.to)
        pixels[index] = nextColor
        if (nextColor && !project.palette.some((entry) => entry.toLowerCase() === nextColor)) {
          project.palette.push(nextColor)
        }
      }
    })
  }
}

export const applyAssistantChanges = (
  project: SpriteProject,
  actions: AssistantProjectAction[],
  edits: AssistantArtEdit[],
) => {
  const frameActions = actions.filter((action) => action.type === 'create_frame')
  const layerActions = actions.filter((action) => action.type === 'create_layer')

  frameActions.forEach((action) => {
    if (project.frames.some((frame) => frame.id === action.frameId)) return
    const anchorIndex = action.afterFrameId
      ? project.frames.findIndex((frame) => frame.id === action.afterFrameId)
      : project.frames.length - 1
    const insertAt = Math.max(0, Math.min(project.frames.length, anchorIndex + 1))
    project.frames.splice(insertAt, 0, {
      id: action.frameId,
      name: action.name,
      duration: action.duration,
    })
    project.layers.forEach((layer) => {
      layer.cels[action.frameId] = action.copyFromFrameId
        ? [...(layer.cels[action.copyFromFrameId] ?? emptyPixels(project.width, project.height))]
        : emptyPixels(project.width, project.height)
    })
  })

  layerActions.forEach((action) => {
    if (project.layers.some((layer) => layer.id === action.layerId)) return
    project.layers.push({
      id: action.layerId,
      name: action.name,
      visible: true,
      opacity: 1,
      cels: Object.fromEntries(
        project.frames.map((frame) => [frame.id, emptyPixels(project.width, project.height)]),
      ),
    })
  })

  edits.forEach((edit) => {
    const layer = project.layers.find((item) => item.id === edit.layerId)
    if (!layer || !project.frames.some((frame) => frame.id === edit.frameId)) return
    const pixels =
      layer.cels[edit.frameId] ??
      (layer.cels[edit.frameId] = emptyPixels(project.width, project.height))
    edit.operations.forEach((operation) => applyOperation(project, pixels, operation))
  })

  return {
    framesCreated: frameActions.length,
    layersCreated: layerActions.length,
    editedCels: edits.filter((edit) => edit.operations.length > 0).length,
  }
}
