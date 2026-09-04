import type {
  ArtProposal,
  Pixel,
  PixelPoint,
  PixelSample,
  PixelSelection,
  SpriteProject,
  ToolId,
} from '~/types/editor'
import { applyAssistantChanges } from '~/utils/assistant'
import {
  cloneProject,
  coercePixelToColorMode,
  createDemoProject,
  emptyPixels,
  makeId,
} from '~/utils/project'
import { rasterCircle, rasterLine, rasterRectangle } from '~/utils/raster'
import { toRaw } from 'vue'

const HISTORY_LIMIT = 60

interface PixelHistoryChange {
  index: number
  before: Pixel
  after: Pixel
}

type EditorHistoryEntry =
  | { kind: 'project'; project: SpriteProject }
  | {
      kind: 'pixels'
      frameId: string
      layerId: string
      changes: PixelHistoryChange[]
    }

type PixelHistoryEntry = Extract<EditorHistoryEntry, { kind: 'pixels' }>

const rawPixels = (pixels: Pixel[] | undefined) => (pixels ? toRaw(pixels) : undefined)

export interface EditorDocument {
  id: string
  project: SpriteProject
  activeFrameId: string
  activeLayerId: string
  history: EditorHistoryEntry[]
  future: EditorHistoryEntry[]
  dirtyRevision: number
  lastAction: string
  selection: PixelSelection | null
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
  selection: null,
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
  const history = computed<EditorHistoryEntry[]>({
    get: () => currentDocument.value.history,
    set: (value) => {
      currentDocument.value.history = value
    },
  })
  const future = computed<EditorHistoryEntry[]>({
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
  const primaryColor = useState<string>('primary-color', () => '#d946ef')
  const secondaryColor = useState<string>('secondary-color', () => '#1c1628')
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
  const selection = computed<PixelSelection | null>({
    get: () => currentDocument.value.selection,
    set: (value) => {
      currentDocument.value.selection = value
    },
  })

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
  const activeSelection = computed(() =>
    selection.value?.frameId === activeFrameId.value &&
    selection.value.layerId === activeLayerId.value
      ? selection.value
      : null,
  )
  let activeStroke: {
    frameId: string
    layerId: string
    originals: Map<number, Pixel>
  } | null = null
  let committedTouchMutation: PixelHistoryEntry | null = null

  const touch = (action: string) => {
    project.value.updatedAt = new Date().toISOString()
    dirtyRevision.value += 1
    lastAction.value = action
  }

  const pushHistory = (entry: EditorHistoryEntry) => {
    history.value.push(entry)
    if (history.value.length > HISTORY_LIMIT) history.value.shift()
  }

  const checkpoint = (action: string) => {
    committedTouchMutation = null
    pushHistory({ kind: 'project', project: cloneProject(project.value) })
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
    primaryColor.value = '#1c1628'
    secondaryColor.value = '#ffffff'
    lastAction.value = 'Reset drawing colors'
  }

  const selectDrawingColor = (target: 'primary' | 'secondary') => {
    activeDrawingColor.value = target
    lastAction.value = `${target === 'primary' ? 'Primary' : 'Secondary'} color selected`
  }

  const beginPixelMutation = (action: string) => {
    committedTouchMutation = null
    activeStroke = {
      frameId: activeFrameId.value,
      layerId: activeLayerId.value,
      originals: new Map(),
    }
    lastAction.value = action
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
    beginPixelMutation(action)
  }

  const writeStrokePixel = (pixels: Pixel[], index: number, pixel: Pixel) => {
    if (pixels[index] === pixel) return false
    if (
      activeStroke?.frameId === activeFrameId.value &&
      activeStroke.layerId === activeLayerId.value &&
      !activeStroke.originals.has(index)
    ) {
      activeStroke.originals.set(index, pixels[index] ?? null)
    }
    pixels[index] = pixel
    return true
  }

  const paintPixel = (x: number, y: number, color: Pixel = primaryColor.value) => {
    const pixels = rawPixels(activeLayer.value?.cels[activeFrameId.value])
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
          writeStrokePixel(pixels, targetY * project.value.width + targetX, drawingPixel)
        }
      }
    }
  }

  const paintDitherPixel = (
    x: number,
    y: number,
    colorTarget: 'primary' | 'secondary' = activeDrawingColor.value,
  ) => {
    const pixels = rawPixels(activeLayer.value?.cels[activeFrameId.value])
    if (!pixels) return
    const radius = Math.floor((brushSize.value - 1) / 2)
    const invert = colorTarget === 'secondary' ? 1 : 0
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
        writeStrokePixel(
          pixels,
          targetY * project.value.width + targetX,
          coercePixelToColorMode(
            project.value,
            useSecondary ? secondaryColor.value : primaryColor.value,
          ),
        )
      }
    }
  }

  const commitPixelMutation = (action: string): PixelHistoryEntry | null => {
    const completedStroke = activeStroke
    activeStroke = null
    if (!completedStroke) return null
    const layer = project.value.layers.find((item) => item.id === completedStroke.layerId)
    const pixels = rawPixels(layer?.cels[completedStroke.frameId])
    if (!pixels) return null
    const changes = [...completedStroke.originals.entries()]
      .map(([index, before]) => ({ index, before, after: pixels[index] ?? null }))
      .filter((change) => change.before !== change.after)
    if (!changes.length) {
      lastAction.value = 'Stroke unchanged'
      return null
    }
    const entry: PixelHistoryEntry = {
      kind: 'pixels',
      frameId: completedStroke.frameId,
      layerId: completedStroke.layerId,
      changes,
    }
    pushHistory(entry)
    future.value = []
    touch(action)
    return entry
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
    return Boolean(commitPixelMutation(action))
  }

  const cancelStroke = () => {
    const cancelledStroke = activeStroke
    activeStroke = null
    if (cancelledStroke) {
      const layer = project.value.layers.find((item) => item.id === cancelledStroke.layerId)
      const pixels = rawPixels(layer?.cels[cancelledStroke.frameId])
      if (!pixels) return false
      cancelledStroke.originals.forEach((pixel, index) => {
        pixels[index] = pixel
      })
    } else {
      const entry = committedTouchMutation
      if (!entry || history.value.at(-1) !== entry) return false
      const pixels = rawPixels(
        project.value.layers.find((layer) => layer.id === entry.layerId)?.cels[entry.frameId],
      )
      if (!pixels) return false
      entry.changes.forEach((change) => {
        pixels[change.index] = change.before
      })
      history.value.pop()
      future.value = []
      project.value.updatedAt = new Date().toISOString()
      dirtyRevision.value += 1
    }
    committedTouchMutation = null
    lastAction.value = 'Cancelled touch stroke'
    return true
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

  const floodFill = (x: number, y: number, color: Pixel, cancellable = false) => {
    const pixels = rawPixels(activeLayer.value?.cels[activeFrameId.value])
    if (!pixels) return false
    const fillColor = coercePixelToColorMode(project.value, color)
    const target = pixels[y * project.value.width + x]
    if (target === fillColor) return false
    beginPixelMutation('Fill area')
    const width = project.value.width
    const height = project.value.height
    const queue = [y * width + x]
    const visited = new Uint8Array(pixels.length)
    visited[queue[0]!] = 1
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const index = queue[cursor]!
      if (pixels[index] !== target) continue
      writeStrokePixel(pixels, index, fillColor)
      const currentX = index % width
      const currentY = Math.floor(index / width)
      const neighbours = [
        currentX + 1 < width ? index + 1 : -1,
        currentX > 0 ? index - 1 : -1,
        currentY + 1 < height ? index + width : -1,
        currentY > 0 ? index - width : -1,
      ]
      neighbours.forEach((neighbour) => {
        if (neighbour < 0 || visited[neighbour]) return
        visited[neighbour] = 1
        if (pixels[neighbour] === target) queue.push(neighbour)
      })
    }
    const entry = commitPixelMutation('Filled area')
    if (cancellable) committedTouchMutation = entry
    return Boolean(entry)
  }

  const drawLine = (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: Pixel = primaryColor.value,
  ) => {
    beginPixelMutation('Draw line')
    rasterLine({ x: fromX, y: fromY }, { x: toX, y: toY }).forEach((point) =>
      paintPixel(point.x, point.y, color),
    )
    commitPixelMutation('Drew line')
  }

  const drawRectangle = (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: Pixel = primaryColor.value,
  ) => {
    beginPixelMutation('Draw rectangle')
    rasterRectangle({ x: fromX, y: fromY }, { x: toX, y: toY }).forEach((point) =>
      paintPixel(point.x, point.y, color),
    )
    commitPixelMutation('Drew rectangle')
  }

  const drawCircle = (
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: Pixel = primaryColor.value,
  ) => {
    beginPixelMutation('Draw circle')
    rasterCircle({ x: fromX, y: fromY }, { x: toX, y: toY }).forEach((point) =>
      paintPixel(point.x, point.y, color),
    )
    commitPixelMutation('Drew circle')
  }

  const setSelection = (kind: PixelSelection['kind'], points: PixelPoint[]) => {
    const unique = new Map<string, PixelPoint>()
    points.forEach((point) => {
      if (
        point.x >= 0 &&
        point.y >= 0 &&
        point.x < project.value.width &&
        point.y < project.value.height
      ) {
        unique.set(`${point.x}:${point.y}`, point)
      }
    })
    selection.value = unique.size
      ? {
          kind,
          frameId: activeFrameId.value,
          layerId: activeLayerId.value,
          points: [...unique.values()],
        }
      : null
    lastAction.value = selection.value
      ? `Selected ${selection.value.points.length} pixel${selection.value.points.length === 1 ? '' : 's'}`
      : 'Selection cleared'
  }

  const clearSelection = () => {
    if (!selection.value) return
    selection.value = null
    lastAction.value = 'Selection cleared'
  }

  const moveSelection = (offsetX: number, offsetY: number) => {
    const current = activeSelection.value
    const pixels = rawPixels(activeLayer.value?.cels[activeFrameId.value])
    if (!current || !pixels || (offsetX === 0 && offsetY === 0)) return false
    checkpoint('Move selection')
    const captured = current.points.map((point) => ({
      point,
      pixel: pixels[point.y * project.value.width + point.x] ?? null,
    }))
    current.points.forEach((point) => {
      pixels[point.y * project.value.width + point.x] = null
    })
    const movedPoints: PixelPoint[] = []
    captured.forEach(({ point, pixel }) => {
      const x = point.x + offsetX
      const y = point.y + offsetY
      if (x < 0 || y < 0 || x >= project.value.width || y >= project.value.height) return
      pixels[y * project.value.width + x] = pixel
      movedPoints.push({ x, y })
    })
    selection.value = { ...current, points: movedPoints }
    touch(`Moved selection ${offsetX}, ${offsetY}`)
    return true
  }

  const transformSelection = (samples: PixelSample[], action: string) => {
    const current = activeSelection.value
    const pixels = rawPixels(activeLayer.value?.cels[activeFrameId.value])
    if (!current || !pixels || !samples.length) return false
    const transformed = new Map<string, PixelSample>()
    samples.forEach((sample) => {
      if (
        sample.x >= 0 &&
        sample.y >= 0 &&
        sample.x < project.value.width &&
        sample.y < project.value.height
      ) {
        transformed.set(`${sample.x}:${sample.y}`, sample)
      }
    })
    if (!transformed.size) return false

    checkpoint(action)
    current.points.forEach((point) => {
      pixels[point.y * project.value.width + point.x] = null
    })
    transformed.forEach((sample) => {
      pixels[sample.y * project.value.width + sample.x] = sample.color
    })
    selection.value = {
      ...current,
      points: [...transformed.values()].map(({ x, y }) => ({ x, y })),
    }
    touch(action)
    return true
  }

  const deleteSelectionPixels = () => {
    const current = activeSelection.value
    const pixels = rawPixels(activeLayer.value?.cels[activeFrameId.value])
    if (!current || !pixels) return false
    checkpoint('Clear selection')
    current.points.forEach((point) => {
      pixels[point.y * project.value.width + point.x] = null
    })
    touch('Cleared selected pixels')
    return true
  }

  const undo = () => {
    const previous = history.value.at(-1)
    if (!previous) return
    let pixels: Pixel[] | undefined
    if (previous.kind === 'pixels') {
      pixels = rawPixels(
        project.value.layers.find((layer) => layer.id === previous.layerId)?.cels[previous.frameId],
      )
      if (!pixels) return
    }
    history.value.pop()
    if (previous.kind === 'project') {
      future.value.push({ kind: 'project', project: cloneProject(project.value) })
      project.value = previous.project
    } else {
      previous.changes.forEach((change) => {
        pixels![change.index] = change.before
      })
      future.value.push(previous)
    }
    committedTouchMutation = null
    selection.value = null
    touch('Undo')
  }

  const redo = () => {
    const next = future.value.at(-1)
    if (!next) return
    let pixels: Pixel[] | undefined
    if (next.kind === 'pixels') {
      pixels = rawPixels(
        project.value.layers.find((layer) => layer.id === next.layerId)?.cels[next.frameId],
      )
      if (!pixels) return
    }
    future.value.pop()
    if (next.kind === 'project') {
      pushHistory({ kind: 'project', project: cloneProject(project.value) })
      project.value = next.project
    } else {
      next.changes.forEach((change) => {
        pixels![change.index] = change.after
      })
      pushHistory(next)
    }
    committedTouchMutation = null
    selection.value = null
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
    if (selection.value?.frameId === frameId) selection.value = null
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
    if (selection.value?.layerId === layerId) selection.value = null
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

  const applyProposal = (proposal: ArtProposal) => {
    if (
      proposal.actions.length === 0 &&
      proposal.edits.every((edit) => edit.operations.length === 0)
    ) {
      return false
    }
    checkpoint('Apply assistant proposal')
    const result = applyAssistantChanges(project.value, proposal.actions, proposal.edits)
    const lastEdit = proposal.edits.findLast((edit) => edit.operations.length > 0)
    if (lastEdit) {
      activeFrameId.value = lastEdit.frameId
      activeLayerId.value = lastEdit.layerId
    } else {
      const lastFrame = proposal.actions.findLast((action) => action.type === 'create_frame')
      const lastLayer = proposal.actions.findLast((action) => action.type === 'create_layer')
      if (lastFrame) activeFrameId.value = lastFrame.frameId
      if (lastLayer) activeLayerId.value = lastLayer.layerId
    }
    selection.value = null
    const parts = [
      result.layersCreated
        ? `${result.layersCreated} layer${result.layersCreated === 1 ? '' : 's'}`
        : '',
      result.framesCreated
        ? `${result.framesCreated} frame${result.framesCreated === 1 ? '' : 's'}`
        : '',
      result.editedCels ? `${result.editedCels} cel${result.editedCels === 1 ? '' : 's'}` : '',
    ].filter(Boolean)
    touch(`Applied assistant work${parts.length ? `: ${parts.join(', ')}` : ''}`)
    return true
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
    selection,
    activeSelection,
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
    cancelStroke,
    pickColor,
    floodFill,
    drawLine,
    drawRectangle,
    drawCircle,
    setSelection,
    clearSelection,
    moveSelection,
    transformSelection,
    deleteSelectionPixels,
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
    applyProposal,
  }
}
