import type { ArtOperation, FrameArtEdit, Pixel, SpriteProject, ToolId } from '~/types/editor'
import {
  cloneProject,
  coercePixelToColorMode,
  createDemoProject,
  emptyPixels,
  makeId,
  normalizeHex,
} from '~/utils/project'
import { rasterLine, rasterRectangle } from '~/utils/raster'

const HISTORY_LIMIT = 60

export interface EditorDocument {
  id: string
  project: SpriteProject
  activeFrameId: string
  activeLayerId: string
  history: SpriteProject[]
  future: SpriteProject[]
  dirtyRevision: number
  lastAction: string
  placeholder: boolean
}

const createEditorDocument = (
  project: SpriteProject,
  placeholder = false,
  lastAction = 'Project ready',
): EditorDocument => ({
  id: project.id,
  project: cloneProject(project),
  activeFrameId: project.frames[0]!.id,
  activeLayerId: project.layers.at(-1)!.id,
  history: [],
  future: [],
  dirtyRevision: 0,
  lastAction,
  placeholder,
})

export const useEditor = () => {
  const documents = useState<EditorDocument[]>('editor-documents', () => [
    createEditorDocument(createDemoProject(), true),
  ])
  const activeDocumentId = useState<string>('active-document', () => documents.value[0]!.id)
  const currentDocument = computed(
    () =>
      documents.value.find((document) => document.id === activeDocumentId.value) ??
      documents.value[0]!,
  )
  const project = computed<SpriteProject>({
    get: () => currentDocument.value.project,
    set: (value) => {
      currentDocument.value.project = value
    },
  })
  const activeFrameId = computed<string>({
    get: () => currentDocument.value.activeFrameId,
    set: (value) => {
      currentDocument.value.activeFrameId = value
    },
  })
  const activeLayerId = computed<string>({
    get: () => currentDocument.value.activeLayerId,
    set: (value) => {
      currentDocument.value.activeLayerId = value
    },
  })
  const history = computed<SpriteProject[]>({
    get: () => currentDocument.value.history,
    set: (value) => {
      currentDocument.value.history = value
    },
  })
  const future = computed<SpriteProject[]>({
    get: () => currentDocument.value.future,
    set: (value) => {
      currentDocument.value.future = value
    },
  })
  const dirtyRevision = computed<number>({
    get: () => currentDocument.value.dirtyRevision,
    set: (value) => {
      currentDocument.value.dirtyRevision = value
    },
  })
  const lastAction = computed<string>({
    get: () => currentDocument.value.lastAction,
    set: (value) => {
      currentDocument.value.lastAction = value
    },
  })
  const isPlaceholder = computed(() => currentDocument.value.placeholder)
  const activeTool = useState<ToolId>('active-tool', () => 'pencil')
  const primaryColor = useState<string>('primary-color', () => '#ff875f')
  const secondaryColor = useState<string>('secondary-color', () => '#16221c')
  const activeDrawingColor = useState<'primary' | 'secondary'>(
    'active-drawing-color',
    () => 'primary',
  )
  const brushSize = useState<number>('brush-size', () => 1)
  const zoom = useState<number>('canvas-zoom', () => 14)
  const showGrid = useState<boolean>('show-grid', () => true)
  const showTransparency = useState<boolean>('show-transparency', () => true)
  const onionSkin = useState<boolean>('onion-skin', () => true)
  const layerEditingId = useState<string | null>('layer-editing-id', () => null)

  const activeFrame = computed(() =>
    project.value.frames.find((frame) => frame.id === activeFrameId.value),
  )
  const activeLayer = computed(() =>
    project.value.layers.find((layer) => layer.id === activeLayerId.value),
  )
  const activePixels = computed(
    () =>
      activeLayer.value?.cels[activeFrameId.value] ??
      emptyPixels(project.value.width, project.value.height),
  )
  const canUndo = computed(() => history.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)
  const drawingColor = computed(() =>
    activeDrawingColor.value === 'primary' ? primaryColor.value : secondaryColor.value,
  )

  const touch = (action: string) => {
    project.value.updatedAt = new Date().toISOString()
    dirtyRevision.value += 1
    lastAction.value = action
  }

  const checkpoint = (action: string) => {
    history.value.push(cloneProject(project.value))
    if (history.value.length > HISTORY_LIMIT) history.value.shift()
    future.value = []
    lastAction.value = action
  }

  const replaceProject = (next: SpriteProject, action = 'Project opened') => {
    const existing = documents.value.find((document) => document.id === next.id)
    if (existing) {
      activeDocumentId.value = existing.id
      return existing.id
    }

    const document = createEditorDocument(next, false, action)
    if (documents.value.length === 1 && documents.value[0]!.placeholder) {
      documents.value = [document]
    } else {
      documents.value.push(document)
    }
    activeDocumentId.value = document.id
    return document.id
  }

  const activateDocument = (documentId: string) => {
    if (!documents.value.some((document) => document.id === documentId)) return false
    activeDocumentId.value = documentId
    return true
  }

  const closeDocument = (documentId: string) => {
    const index = documents.value.findIndex((document) => document.id === documentId)
    if (index < 0) return false
    if (documents.value.length === 1) {
      const placeholder = createEditorDocument(createDemoProject(), true)
      documents.value = [placeholder]
      activeDocumentId.value = placeholder.id
      return true
    }

    const closingActive = documentId === activeDocumentId.value
    documents.value.splice(index, 1)
    if (closingActive) {
      activeDocumentId.value = documents.value[Math.max(0, index - 1)]!.id
    }
    return false
  }

  const swapColors = () => {
    const primary = primaryColor.value
    primaryColor.value = secondaryColor.value
    secondaryColor.value = primary
    lastAction.value = 'Swapped drawing colors'
  }

  const resetColors = () => {
    primaryColor.value = '#16221c'
    secondaryColor.value = '#ffffff'
    lastAction.value = 'Reset drawing colors'
  }

  const selectDrawingColor = (target: 'primary' | 'secondary') => {
    activeDrawingColor.value = target
    lastAction.value = `${target === 'primary' ? 'Primary' : 'Secondary'} color selected`
  }

  const beginStroke = () => {
    const action =
      activeTool.value === 'eraser'
        ? 'Erase stroke'
        : activeTool.value === 'mirror'
          ? 'Mirror stroke'
          : activeTool.value === 'dither'
            ? 'Dither stroke'
            : 'Paint stroke'
    checkpoint(action)
  }

  const paintPixel = (x: number, y: number, color: Pixel = primaryColor.value) => {
    const pixels = activeLayer.value?.cels[activeFrameId.value]
    if (!pixels) return
    const radius = Math.floor((brushSize.value - 1) / 2)
    const drawingPixel = coercePixelToColorMode(project.value, color)
    for (let offsetY = -radius; offsetY < brushSize.value - radius; offsetY += 1) {
      for (let offsetX = -radius; offsetX < brushSize.value - radius; offsetX += 1) {
        const targetX = x + offsetX
        const targetY = y + offsetY
        if (
          targetX >= 0 &&
          targetY >= 0 &&
          targetX < project.value.width &&
          targetY < project.value.height
        ) {
          pixels[targetY * project.value.width + targetX] = drawingPixel
        }
      }
    }
    dirtyRevision.value += 1
  }

  const paintDitherPixel = (x: number, y: number) => {
    const pixels = activeLayer.value?.cels[activeFrameId.value]
    if (!pixels) return
    const radius = Math.floor((brushSize.value - 1) / 2)
    const invert = activeDrawingColor.value === 'secondary' ? 1 : 0
    for (let offsetY = -radius; offsetY < brushSize.value - radius; offsetY += 1) {
      for (let offsetX = -radius; offsetX < brushSize.value - radius; offsetX += 1) {
        const targetX = x + offsetX
        const targetY = y + offsetY
        if (
          targetX < 0 ||
          targetY < 0 ||
          targetX >= project.value.width ||
          targetY >= project.value.height
        ) {
          continue
        }
        const useSecondary = (targetX + targetY + invert) % 2 === 1
        pixels[targetY * project.value.width + targetX] = coercePixelToColorMode(
          project.value,
          useSecondary ? secondaryColor.value : primaryColor.value,
        )
      }
    }
    dirtyRevision.value += 1
  }

  const endStroke = () => {
    const action =
      activeTool.value === 'eraser'
        ? 'Erased pixels'
        : activeTool.value === 'mirror'
          ? 'Painted mirrored pixels'
          : activeTool.value === 'dither'
            ? 'Painted dither pattern'
            : 'Painted pixels'
    touch(action)
  }

  const pickColor = (x: number, y: number, target: 'primary' | 'secondary' = 'primary') => {
    for (const layer of [...project.value.layers].reverse()) {
      if (!layer.visible) continue
      const pixel = layer.cels[activeFrameId.value]?.[y * project.value.width + x]
      if (pixel) {
        if (target === 'primary') primaryColor.value = pixel
        else secondaryColor.value = pixel
        lastAction.value = `Picked ${pixel}`
        return
      }
    }
  }

  const floodFill = (x: number, y: number, color: Pixel) => {
    const pixels = activeLayer.value?.cels[activeFrameId.value]
    if (!pixels) return
    const fillColor = coercePixelToColorMode(project.value, color)
    const target = pixels[y * project.value.width + x]
    if (target === fillColor) return
    checkpoint('Fill area')
    const queue: Array<[number, number]> = [[x, y]]
    const visited = new Set<string>()
    while (queue.length) {
      const [currentX, currentY] = queue.shift()!
      const key = `${currentX}:${currentY}`
      if (visited.has(key)) continue
      visited.add(key)
      if (
        currentX < 0 ||
        currentY < 0 ||
        currentX >= project.value.width ||
        currentY >= project.value.height ||
        pixels[currentY * project.value.width + currentX] !== target
      ) {
        continue
      }
      pixels[currentY * project.value.width + currentX] = fillColor
      queue.push(
        [currentX + 1, currentY],
        [currentX - 1, currentY],
        [currentX, currentY + 1],
        [currentX, currentY - 1],
      )
    }
    touch('Filled area')
  }

  const drawLine = (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: Pixel = primaryColor.value,
  ) => {
    checkpoint('Draw line')
    rasterLine({ x: fromX, y: fromY }, { x: toX, y: toY }).forEach((point) =>
      paintPixel(point.x, point.y, color),
    )
    touch('Drew line')
  }

  const drawRectangle = (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: Pixel = primaryColor.value,
  ) => {
    checkpoint('Draw rectangle')
    rasterRectangle({ x: fromX, y: fromY }, { x: toX, y: toY }).forEach((point) =>
      paintPixel(point.x, point.y, color),
    )
    touch('Drew rectangle')
  }

  const undo = () => {
    const previous = history.value.pop()
    if (!previous) return
    future.value.push(cloneProject(project.value))
    project.value = previous
    touch('Undo')
  }

  const redo = () => {
    const next = future.value.pop()
    if (!next) return
    history.value.push(cloneProject(project.value))
    project.value = next
    touch('Redo')
  }

  const addFrame = (
    duplicate = false,
    insertAt = project.value.frames.findIndex((frame) => frame.id === activeFrameId.value) + 1,
    sourceFrameId = activeFrameId.value,
  ) => {
    checkpoint(duplicate ? 'Duplicate frame' : 'Add frame')
    const frameId = makeId('frame')
    const sourceFrame = project.value.frames.find((frame) => frame.id === sourceFrameId)
    const boundedIndex = Math.max(0, Math.min(project.value.frames.length, insertAt))
    project.value.frames.splice(boundedIndex, 0, {
      id: frameId,
      name: `F${boundedIndex + 1}`,
      duration: sourceFrame?.duration ?? 120,
    })
    project.value.layers.forEach((layer) => {
      layer.cels[frameId] = duplicate
        ? [...(layer.cels[sourceFrameId] ?? emptyPixels(project.value.width, project.value.height))]
        : emptyPixels(project.value.width, project.value.height)
    })
    project.value.frames.forEach((frame, index) => (frame.name = `F${index + 1}`))
    activeFrameId.value = frameId
    touch(duplicate ? 'Duplicated frame' : 'Added frame')
  }

  const deleteFrame = (frameId = activeFrameId.value) => {
    if (project.value.frames.length === 1) return
    checkpoint('Delete frame')
    const index = project.value.frames.findIndex((frame) => frame.id === frameId)
    if (index < 0) return
    project.value.frames.splice(index, 1)
    project.value.layers.forEach((layer) => Reflect.deleteProperty(layer.cels, frameId))
    project.value.frames.forEach((frame, frameIndex) => (frame.name = `F${frameIndex + 1}`))
    if (activeFrameId.value === frameId) {
      activeFrameId.value =
        project.value.frames[Math.min(index, project.value.frames.length - 1)]!.id
    }
    touch('Deleted frame')
  }

  const moveFrame = (frameId: string, destinationIndex: number) => {
    const sourceIndex = project.value.frames.findIndex((frame) => frame.id === frameId)
    if (sourceIndex < 0) return false
    const boundedIndex = Math.max(0, Math.min(project.value.frames.length - 1, destinationIndex))
    if (sourceIndex === boundedIndex) return false
    checkpoint('Reorder frames')
    const [frame] = project.value.frames.splice(sourceIndex, 1)
    project.value.frames.splice(boundedIndex, 0, frame!)
    project.value.frames.forEach((item, index) => (item.name = `F${index + 1}`))
    touch(`Moved frame to position ${boundedIndex + 1}`)
    return true
  }

  const addLayer = () => {
    checkpoint('Add layer')
    const id = makeId('layer')
    project.value.layers.push({
      id,
      name: `Layer ${project.value.layers.length + 1}`,
      visible: true,
      opacity: 1,
      cels: Object.fromEntries(
        project.value.frames.map((frame) => [
          frame.id,
          emptyPixels(project.value.width, project.value.height),
        ]),
      ),
    })
    activeLayerId.value = id
    touch('Added layer')
  }

  const deleteLayer = (layerId = activeLayerId.value) => {
    if (project.value.layers.length === 1) return
    const index = project.value.layers.findIndex((layer) => layer.id === layerId)
    if (index < 0) return
    checkpoint('Delete layer')
    project.value.layers.splice(index, 1)
    activeLayerId.value = project.value.layers[Math.max(0, index - 1)]!.id
    layerEditingId.value = null
    touch('Deleted layer')
  }

  const toggleLayer = (layerId: string) => {
    const layer = project.value.layers.find((item) => item.id === layerId)
    if (!layer) return
    checkpoint(layer.visible ? 'Hide layer' : 'Show layer')
    layer.visible = !layer.visible
    touch(layer.visible ? 'Layer shown' : 'Layer hidden')
  }

  const requestLayerRename = (layerId = activeLayerId.value) => {
    if (!project.value.layers.some((layer) => layer.id === layerId)) return
    activeLayerId.value = layerId
    layerEditingId.value = layerId
  }

  const renameLayer = (layerId: string, name: string) => {
    const layer = project.value.layers.find((item) => item.id === layerId)
    const clean = name.trim().slice(0, 64)
    layerEditingId.value = null
    if (!layer || !clean || clean === layer.name) return false
    checkpoint('Rename layer')
    layer.name = clean
    touch('Renamed layer')
    return true
  }

  const setLayerOpacity = (layerId: string, opacity: number) => {
    const layer = project.value.layers.find((item) => item.id === layerId)
    const next = Math.max(0, Math.min(1, opacity))
    if (!layer || !Number.isFinite(next) || layer.opacity === next) return
    checkpoint('Change layer opacity')
    layer.opacity = next
    touch('Changed layer opacity')
  }

  const renameProject = (name: string) => {
    const clean = name.trim().slice(0, 64)
    if (!clean || clean === project.value.name) return
    checkpoint('Rename project')
    project.value.name = clean
    touch('Renamed project')
  }

  const applyOperations = (frameEdits: FrameArtEdit[], layerId = activeLayerId.value) => {
    const layer = project.value.layers.find((item) => item.id === layerId)
    const edits = frameEdits.filter(
      (frameEdit) =>
        frameEdit.operations.length > 0 &&
        project.value.frames.some((frame) => frame.id === frameEdit.frameId),
    )
    if (!layer || edits.length === 0) return
    checkpoint('Apply assistant proposal')
    edits.forEach((frameEdit) => {
      const pixels =
        layer.cels[frameEdit.frameId] ??
        (layer.cels[frameEdit.frameId] = emptyPixels(project.value.width, project.value.height))
      const set = (x: number, y: number, color: Pixel) => {
        if (x >= 0 && y >= 0 && x < project.value.width && y < project.value.height) {
          pixels[y * project.value.width + x] = coercePixelToColorMode(project.value, color)
        }
      }
      frameEdit.operations.forEach((operation: ArtOperation) => {
        if (operation.type === 'set_pixels') {
          operation.pixels.forEach((pixel) => set(pixel.x, pixel.y, pixel.color))
        } else if (operation.type === 'fill_rect' || operation.type === 'outline_rect') {
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
        } else if (operation.type === 'replace_palette_color') {
          const from = normalizeHex(operation.from)
          pixels.forEach((pixel, index) => {
            if (pixel?.toLowerCase() === from) {
              pixels[index] = coercePixelToColorMode(project.value, operation.to)
            }
          })
        }
      })
    })
    touch(`Applied assistant edit to ${edits.length} frame${edits.length === 1 ? '' : 's'}`)
  }

  return {
    documents,
    activeDocumentId,
    isPlaceholder,
    project,
    activeFrameId,
    activeLayerId,
    activeTool,
    primaryColor,
    secondaryColor,
    activeDrawingColor,
    drawingColor,
    brushSize,
    zoom,
    showGrid,
    showTransparency,
    onionSkin,
    layerEditingId,
    dirtyRevision,
    lastAction,
    activeFrame,
    activeLayer,
    activePixels,
    canUndo,
    canRedo,
    checkpoint,
    replaceProject,
    activateDocument,
    closeDocument,
    swapColors,
    resetColors,
    selectDrawingColor,
    beginStroke,
    paintPixel,
    paintDitherPixel,
    endStroke,
    pickColor,
    floodFill,
    drawLine,
    drawRectangle,
    undo,
    redo,
    addFrame,
    deleteFrame,
    moveFrame,
    addLayer,
    deleteLayer,
    toggleLayer,
    requestLayerRename,
    renameLayer,
    setLayerOpacity,
    renameProject,
    applyOperations,
  }
}
