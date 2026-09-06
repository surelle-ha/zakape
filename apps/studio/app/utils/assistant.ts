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
    return
  }

  const source = Array.from({ length: operation.height }, (_, row) =>
    Array.from(
      { length: operation.width },
      (_, column) => pixels[(operation.y + row) * project.width + operation.x + column] ?? null,
    ),
  )
  if (operation.type === 'translate_region') {
    if (operation.mode === 'move') {
      for (let row = 0; row < operation.height; row += 1) {
        for (let column = 0; column < operation.width; column += 1) {
          set(operation.x + column, operation.y + row, null)
        }
      }
    }
    for (let row = 0; row < operation.height; row += 1) {
      for (let column = 0; column < operation.width; column += 1) {
        set(
          operation.x + operation.offsetX + column,
          operation.y + operation.offsetY + row,
          source[row]![column]!,
        )
      }
    }
    return
  }

  if (operation.type === 'flip_region') {
    for (let row = 0; row < operation.height; row += 1) {
      for (let column = 0; column < operation.width; column += 1) {
        const sourceRow = operation.axis === 'vertical' ? operation.height - row - 1 : row
        const sourceColumn = operation.axis === 'horizontal' ? operation.width - column - 1 : column
        set(operation.x + column, operation.y + row, source[sourceRow]![sourceColumn]!)
      }
    }
  }
}

export const applyAssistantChanges = (
  project: SpriteProject,
  actions: AssistantProjectAction[],
  edits: AssistantArtEdit[],
) => {
  const frameActions = actions.filter((action) => action.type === 'create_frame')
  const layerActions = actions.filter((action) => action.type === 'create_layer')
  const durationActions = actions.filter((action) => action.type === 'set_frame_duration')

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

  let durationsChanged = 0
  durationActions.forEach((action) => {
    const frame = project.frames.find((item) => item.id === action.frameId)
    if (!frame || frame.duration === action.duration) return
    frame.duration = action.duration
    durationsChanged += 1
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
    durationsChanged,
    editedCels: edits.filter((edit) => edit.operations.length > 0).length,
  }
}
