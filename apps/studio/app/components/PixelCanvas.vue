<script setup lang="ts">
import type { Pixel, PixelPoint, PixelSample } from '~/types/editor'
import {
  drawPixelRuns,
  drawProjectFrame,
  drawRepeatedSurface,
  getCompositePixels,
} from '~/utils/render'
import {
  mapTiledPoint,
  rasterFilledRectangle,
  rasterLassoSelection,
  pixelBounds,
  rasterCircle,
  rasterLine,
  rasterRectangle,
  resizePixelSamples,
  rotatePixelSamples,
  tiledSourceTile,
  wrapRasterPoints,
} from '~/utils/raster'

const {
  project,
  activeFrameId,
  activeTool,
  activeDrawingColor,
  drawingColor,
  primaryColor,
  secondaryColor,
  brushSize,
  zoom,
  showGrid,
  showTransparency,
  onionSkin,
  dirtyRevision,
  lastAction,
  activePixels,
  activeSelection,
  beginStroke,
  paintPixelSamples,
  endStroke,
  cancelStroke,
  pickColor,
  floodFill,
  commitPixelSamples,
  setSelection,
  clearSelection,
  moveSelection,
  transformSelection,
} = useEditor()
const { enabled: tiledMode, effectiveColumns, effectiveRows } = useTiledMode()

type SelectionTransformMode = 'resize-nw' | 'resize-ne' | 'resize-se' | 'resize-sw' | 'rotate'

const canvas = ref<HTMLCanvasElement | null>(null)
const drawing = ref(false)
const panning = ref(false)
const shapeStart = ref<PixelPoint | null>(null)
const shapeStartDisplay = ref<PixelPoint | null>(null)
const cursor = ref<PixelPoint | null>(null)
const displayCursor = ref<PixelPoint | null>(null)
const strokeColor = ref<Pixel>(drawingColor.value)
const strokeColorTarget = ref<'primary' | 'secondary'>('primary')
const lastStrokePoint = ref<PixelPoint | null>(null)
const lastStrokeDisplayPoint = ref<PixelPoint | null>(null)
const selectionPath = ref<PixelPoint[]>([])
const movingSelection = ref(false)
const selectionDragStart = ref<PixelPoint | null>(null)
const selectionOffset = ref<PixelPoint>({ x: 0, y: 0 })
const selectionTransformMode = ref<SelectionTransformMode | null>(null)
const selectionTransformSamples = ref<PixelSample[]>([])
const selectionTransformPreview = ref<PixelSample[]>([])
const selectionRotation = ref(0)
const selectionRotationStart = ref(0)
const hoveredSelectionHandle = ref<SelectionTransformMode | null>(null)
const selectionTileAvailable = ref(true)
const panOrigin = ref({ clientX: 0, clientY: 0, scrollLeft: 0, scrollTop: 0 })
const modifierKeys = ref({ ctrl: false, shift: false })
const activeTouches = new Map<number, { clientX: number; clientY: number }>()
let pendingTouch: { pointerId: number; point: PixelPoint; timer: number } | null = null
let pinchActive = false
let touchMutationCheckpoint = false
let pinchGesture: {
  distance: number
  zoom: number
  focusClientX: number
  focusClientY: number
  canvasPixelX: number
  canvasPixelY: number
  host: HTMLElement
} | null = null
let lastPainted = ''
let redrawFrame: number | null = null
let presentationSurface: HTMLCanvasElement | null = null

const tileWidth = computed(() => project.value.width * zoom.value)
const tileHeight = computed(() => project.value.height * zoom.value)
const canvasWidth = computed(() => tileWidth.value * effectiveColumns.value)
const canvasHeight = computed(() => tileHeight.value * effectiveRows.value)
const sourceTile = computed(() => tiledSourceTile(effectiveColumns.value, effectiveRows.value))
const sourceOffset = computed(() => ({
  x: sourceTile.value.column * tileWidth.value,
  y: sourceTile.value.row * tileHeight.value,
}))
const selectionTools = ['select-rect', 'select-lasso'] as const
const isSelectionTool = computed(() =>
  selectionTools.includes(activeTool.value as (typeof selectionTools)[number]),
)

const boundedSelectionOffset = (from: PixelPoint, to: PixelPoint) => {
  if (!activeSelection.value?.points.length) return { x: 0, y: 0 }
  const bounds = pixelBounds(activeSelection.value.points)
  return {
    x: Math.max(-bounds.left, Math.min(project.value.width - 1 - bounds.right, to.x - from.x)),
    y: Math.max(-bounds.top, Math.min(project.value.height - 1 - bounds.bottom, to.y - from.y)),
  }
}

const selectionCursor = computed(() => {
  const handle = selectionTransformMode.value ?? hoveredSelectionHandle.value
  if (handle === 'rotate') return 'crosshair'
  if (handle === 'resize-nw' || handle === 'resize-se') return 'nwse-resize'
  if (handle === 'resize-ne' || handle === 'resize-sw') return 'nesw-resize'
  return undefined
})

const captureSelectionSamples = (): PixelSample[] =>
  (activeSelection.value?.points ?? []).map((point) => ({
    ...point,
    color: activePixels.value[point.y * project.value.width + point.x] ?? null,
  }))

const draftSelectionPoints = () => {
  if (!drawing.value || !shapeStart.value || !cursor.value || !isSelectionTool.value) return []
  return activeTool.value === 'select-rect'
    ? rasterFilledRectangle(shapeStart.value, cursor.value)
    : rasterLassoSelection(selectionPath.value, project.value.width, project.value.height)
}

const drawSelection = (
  context: CanvasRenderingContext2D,
  points: PixelPoint[],
  offset: PixelPoint = { x: 0, y: 0 },
) => {
  if (!points.length) return
  const selected = new Set(points.map((point) => `${point.x}:${point.y}`))
  context.save()
  context.fillStyle = 'rgba(139, 92, 246, 0.18)'
  points.forEach((point) => {
    context.fillRect(
      (point.x + offset.x) * zoom.value,
      (point.y + offset.y) * zoom.value,
      zoom.value,
      zoom.value,
    )
  })
  context.beginPath()
  context.setLineDash([
    Math.max(2, Math.round(zoom.value / 3)),
    Math.max(2, Math.round(zoom.value / 4)),
  ])
  context.strokeStyle = '#f5f3ff'
  context.lineWidth = 1.25
  points.forEach((point) => {
    const x = (point.x + offset.x) * zoom.value
    const y = (point.y + offset.y) * zoom.value
    if (!selected.has(`${point.x}:${point.y - 1}`)) {
      context.moveTo(x, y + 0.5)
      context.lineTo(x + zoom.value, y + 0.5)
    }
    if (!selected.has(`${point.x + 1}:${point.y}`)) {
      context.moveTo(x + zoom.value - 0.5, y)
      context.lineTo(x + zoom.value - 0.5, y + zoom.value)
    }
    if (!selected.has(`${point.x}:${point.y + 1}`)) {
      context.moveTo(x, y + zoom.value - 0.5)
      context.lineTo(x + zoom.value, y + zoom.value - 0.5)
    }
    if (!selected.has(`${point.x - 1}:${point.y}`)) {
      context.moveTo(x + 0.5, y)
      context.lineTo(x + 0.5, y + zoom.value)
    }
  })
  context.stroke()
  context.restore()
}

const selectionHandlePositions = (points: PixelPoint[]) => {
  const bounds = pixelBounds(points)
  const left = bounds.left * zoom.value
  const right = (bounds.right + 1) * zoom.value
  const top = bounds.top * zoom.value
  const bottom = (bounds.bottom + 1) * zoom.value
  const inset = Math.min(5, Math.max(2, zoom.value / 3))
  const rotateAbove = top >= 18
  const rotateBelow = tileHeight.value - bottom >= 18
  const rotationY = rotateAbove
    ? top - 11
    : rotateBelow
      ? bottom + 11
      : top + Math.min(11, Math.max(5, (bottom - top) / 2))
  return {
    'resize-nw': { x: left + inset, y: top + inset },
    'resize-ne': { x: right - inset, y: top + inset },
    'resize-se': { x: right - inset, y: bottom - inset },
    'resize-sw': { x: left + inset, y: bottom - inset },
    rotate: { x: (left + right) / 2, y: rotationY },
    rotationAnchor: { x: (left + right) / 2, y: rotateAbove ? top : rotateBelow ? bottom : top },
  }
}

const drawSelectionHandles = (context: CanvasRenderingContext2D, points: PixelPoint[]) => {
  if (!points.length || !isSelectionTool.value) return
  const handles = selectionHandlePositions(points)
  const radius = Math.min(4, Math.max(3, zoom.value / 3))
  context.save()
  context.setLineDash([])
  context.lineWidth = 1.5
  context.strokeStyle = '#a78bfa'
  context.fillStyle = '#111318'
  context.beginPath()
  context.moveTo(handles.rotationAnchor.x, handles.rotationAnchor.y)
  context.lineTo(handles.rotate.x, handles.rotate.y)
  context.stroke()
  ;(['resize-nw', 'resize-ne', 'resize-se', 'resize-sw'] as const).forEach((handle) => {
    const point = handles[handle]
    context.fillRect(point.x - radius, point.y - radius, radius * 2, radius * 2)
    context.strokeRect(point.x - radius, point.y - radius, radius * 2, radius * 2)
  })
  context.beginPath()
  context.arc(handles.rotate.x, handles.rotate.y, radius + 0.5, 0, Math.PI * 2)
  context.fill()
  context.stroke()
  context.restore()
}

const drawTransformedSamples = (context: CanvasRenderingContext2D, samples: PixelSample[]) => {
  context.save()
  context.globalAlpha = 0.94
  samples.forEach((sample) => {
    if (!sample.color) return
    context.fillStyle = sample.color
    context.fillRect(sample.x * zoom.value, sample.y * zoom.value, zoom.value, zoom.value)
  })
  context.restore()
}

const mirrorPoints = (point: PixelPoint): PixelPoint[] => {
  if (activeTool.value !== 'mirror') return [point]
  const horizontal = { x: point.x, y: project.value.height - 1 - point.y }
  const vertical = { x: project.value.width - 1 - point.x, y: point.y }
  const both = { x: vertical.x, y: horizontal.y }
  const points = modifierKeys.value.shift
    ? [point, horizontal, vertical, both]
    : modifierKeys.value.ctrl
      ? [point, horizontal]
      : [point, vertical]
  return [...new Map(points.map((entry) => [`${entry.x}:${entry.y}`, entry])).values()]
}

const samplesFromDisplayPoints = (points: PixelPoint[], color: Pixel): PixelSample[] => {
  const centers = points.flatMap((point) => {
    const mapped = mapTiledPoint(
      point,
      project.value.width,
      project.value.height,
      effectiveColumns.value,
      effectiveRows.value,
    )
    return mirrorPoints({ x: mapped.sourceX, y: mapped.sourceY })
  })
  const rasterPoints = tiledMode.value
    ? wrapRasterPoints(centers, project.value.width, project.value.height, brushSize.value)
    : [
        ...new Map(
          centers
            .flatMap((point) => {
              const radius = Math.floor((brushSize.value - 1) / 2)
              const expanded: PixelPoint[] = []
              for (let offsetY = -radius; offsetY < brushSize.value - radius; offsetY += 1) {
                for (let offsetX = -radius; offsetX < brushSize.value - radius; offsetX += 1) {
                  const next = { x: point.x + offsetX, y: point.y + offsetY }
                  if (
                    next.x >= 0 &&
                    next.y >= 0 &&
                    next.x < project.value.width &&
                    next.y < project.value.height
                  )
                    expanded.push(next)
                }
              }
              return expanded
            })
            .map((point) => [`${point.x}:${point.y}`, point]),
        ).values(),
      ]
  return rasterPoints.map((point) => {
    if (activeTool.value !== 'dither') return { ...point, color }
    const invert = strokeColorTarget.value === 'secondary' ? 1 : 0
    return {
      ...point,
      color: (point.x + point.y + invert) % 2 === 1 ? secondaryColor.value : primaryColor.value,
    }
  })
}

const activeShapeSamples = () => {
  if (!shapeStartDisplay.value || !displayCursor.value) return []
  const points =
    activeTool.value === 'line'
      ? rasterLine(shapeStartDisplay.value, displayCursor.value)
      : activeTool.value === 'circle'
        ? rasterCircle(shapeStartDisplay.value, displayCursor.value)
        : rasterRectangle(shapeStartDisplay.value, displayCursor.value)
  return samplesFromDisplayPoints(points, strokeColor.value)
}

const getPresentationSurface = () => {
  presentationSurface ??= document.createElement('canvas')
  if (presentationSurface.width !== tileWidth.value) presentationSurface.width = tileWidth.value
  if (presentationSurface.height !== tileHeight.value) presentationSurface.height = tileHeight.value
  return presentationSurface
}

const redraw = () => {
  const element = canvas.value
  if (!element) return
  if (element.width !== canvasWidth.value) element.width = canvasWidth.value
  if (element.height !== canvasHeight.value) element.height = canvasHeight.value
  const context = element.getContext('2d')!
  context.clearRect(0, 0, element.width, element.height)

  const surface = getPresentationSurface()
  const surfaceContext = surface.getContext('2d')!
  surfaceContext.clearRect(0, 0, surface.width, surface.height)
  if (onionSkin.value && project.value.frames.length > 1) {
    const currentIndex = project.value.frames.findIndex((frame) => frame.id === activeFrameId.value)
    const previous = currentIndex > 0 ? project.value.frames[currentIndex - 1] : undefined
    if (previous) {
      surfaceContext.save()
      surfaceContext.globalAlpha = 0.24
      drawPixelRuns(
        surfaceContext,
        getCompositePixels(project.value, previous.id),
        project.value.width,
        zoom.value,
        '#c4b5fd',
      )
      surfaceContext.restore()
    }
  }
  drawProjectFrame(surfaceContext, project.value, activeFrameId.value, zoom.value, false)
  drawRepeatedSurface(
    context,
    surface,
    tileWidth.value,
    tileHeight.value,
    effectiveColumns.value,
    effectiveRows.value,
  )

  if (drawing.value && !isSelectionTool.value && shapeStartDisplay.value) {
    context.save()
    context.globalAlpha = 0.78
    activeShapeSamples().forEach((sample) => {
      if (!sample.color) return
      context.fillStyle = sample.color
      for (let row = 0; row < effectiveRows.value; row += 1) {
        for (let column = 0; column < effectiveColumns.value; column += 1) {
          context.fillRect(
            (column * project.value.width + sample.x) * zoom.value,
            (row * project.value.height + sample.y) * zoom.value,
            zoom.value,
            zoom.value,
          )
        }
      }
    })
    context.restore()
  }

  if (showGrid.value && zoom.value >= 8) {
    context.beginPath()
    context.strokeStyle = 'rgba(15, 13, 23, 0.42)'
    context.lineWidth = 1
    for (let x = 0; x <= project.value.width * effectiveColumns.value; x += 1) {
      context.moveTo(x * zoom.value + 0.5, 0)
      context.lineTo(x * zoom.value + 0.5, element.height)
    }
    for (let y = 0; y <= project.value.height * effectiveRows.value; y += 1) {
      context.moveTo(0, y * zoom.value + 0.5)
      context.lineTo(element.width, y * zoom.value + 0.5)
    }
    context.stroke()
  }

  if (tiledMode.value) {
    context.save()
    context.beginPath()
    context.strokeStyle = 'rgba(167, 139, 250, 0.24)'
    context.lineWidth = 1
    for (let column = 1; column < effectiveColumns.value; column += 1) {
      const x = column * tileWidth.value + 0.5
      context.moveTo(x, 0)
      context.lineTo(x, element.height)
    }
    for (let row = 1; row < effectiveRows.value; row += 1) {
      const y = row * tileHeight.value + 0.5
      context.moveTo(0, y)
      context.lineTo(element.width, y)
    }
    context.stroke()
    context.restore()
  }

  context.save()
  context.translate(sourceOffset.value.x, sourceOffset.value.y)
  if (drawing.value && shapeStart.value && cursor.value && isSelectionTool.value) {
    drawSelection(context, draftSelectionPoints())
  }
  if (activeSelection.value && !drawing.value) {
    if (selectionTransformMode.value && selectionTransformPreview.value.length) {
      drawTransformedSamples(context, selectionTransformPreview.value)
      drawSelection(
        context,
        selectionTransformPreview.value.map(({ x, y }) => ({ x, y })),
      )
    } else if (movingSelection.value) {
      context.save()
      context.globalAlpha = 0.92
      activeSelection.value.points.forEach((point) => {
        const pixel = activePixels.value[point.y * project.value.width + point.x]
        if (!pixel) return
        context.fillStyle = pixel
        context.fillRect(
          (point.x + selectionOffset.value.x) * zoom.value,
          (point.y + selectionOffset.value.y) * zoom.value,
          zoom.value,
          zoom.value,
        )
      })
      context.restore()
    }
    if (!selectionTransformMode.value) {
      drawSelection(
        context,
        activeSelection.value.points,
        movingSelection.value ? selectionOffset.value : undefined,
      )
    }
  }
  if (activeSelection.value && !drawing.value && !movingSelection.value) {
    const handlePoints = selectionTransformMode.value
      ? selectionTransformPreview.value.map(({ x, y }) => ({ x, y }))
      : activeSelection.value.points
    drawSelectionHandles(context, handlePoints)
    if (selectionTransformMode.value === 'rotate') {
      context.save()
      context.fillStyle = '#f4f4f5'
      context.font = "10px 'Azeret Mono Variable', monospace"
      context.textAlign = 'center'
      const bounds = pixelBounds(handlePoints)
      context.fillText(
        `${Math.round((selectionRotation.value * 180) / Math.PI)}°`,
        ((bounds.left + bounds.right + 1) / 2) * zoom.value,
        Math.max(12, bounds.top * zoom.value - 22),
      )
      context.restore()
    }
  }
  context.restore()

  if (tiledMode.value) {
    context.save()
    context.strokeStyle = '#a78bfa'
    context.lineWidth = 2
    context.strokeRect(
      sourceOffset.value.x + 1,
      sourceOffset.value.y + 1,
      tileWidth.value - 2,
      tileHeight.value - 2,
    )
    context.restore()
  }

  if (cursor.value && activeTool.value !== 'hand' && !isSelectionTool.value) {
    context.strokeStyle = '#ffffff'
    context.lineWidth = 1
    mirrorPoints(cursor.value).forEach((point) => {
      for (let row = 0; row < effectiveRows.value; row += 1) {
        for (let column = 0; column < effectiveColumns.value; column += 1) {
          context.strokeRect(
            (column * project.value.width + point.x) * zoom.value + 0.5,
            (row * project.value.height + point.y) * zoom.value + 0.5,
            zoom.value - 1,
            zoom.value - 1,
          )
        }
      }
    })
  }
}

const scheduleRedraw = () => {
  if (redrawFrame !== null) return
  redrawFrame = window.requestAnimationFrame(() => {
    redrawFrame = null
    redraw()
  })
}

const displayPointFromEvent = (event: PointerEvent): PixelPoint => {
  const bounds = canvas.value!.getBoundingClientRect()
  const width = project.value.width * effectiveColumns.value
  const height = project.value.height * effectiveRows.value
  const raw = {
    x: Math.floor(((event.clientX - bounds.left) / bounds.width) * width),
    y: Math.floor(((event.clientY - bounds.top) / bounds.height) * height),
  }
  if (tiledMode.value) return raw
  return {
    x: Math.max(0, Math.min(project.value.width - 1, raw.x)),
    y: Math.max(0, Math.min(project.value.height - 1, raw.y)),
  }
}

const mappedPointFromEvent = (event: PointerEvent) =>
  mapTiledPoint(
    displayPointFromEvent(event),
    project.value.width,
    project.value.height,
    effectiveColumns.value,
    effectiveRows.value,
  )

const pointFromEvent = (event: PointerEvent): PixelPoint => {
  const mapped = mappedPointFromEvent(event)
  return { x: mapped.sourceX, y: mapped.sourceY }
}

const selectionPointFromEvent = (event: PointerEvent): PixelPoint => {
  const display = displayPointFromEvent(event)
  const originX = sourceTile.value.column * project.value.width
  const originY = sourceTile.value.row * project.value.height
  return {
    x: Math.max(0, Math.min(project.value.width - 1, display.x - originX)),
    y: Math.max(0, Math.min(project.value.height - 1, display.y - originY)),
  }
}

const floatingPointFromEvent = (event: PointerEvent): PixelPoint => {
  const bounds = canvas.value!.getBoundingClientRect()
  return {
    x: (event.clientX - bounds.left - sourceOffset.value.x) / zoom.value,
    y: (event.clientY - bounds.top - sourceOffset.value.y) / zoom.value,
  }
}

const selectionHandleFromEvent = (event: PointerEvent): SelectionTransformMode | null => {
  if (!isSelectionTool.value || !activeSelection.value?.points.length) return null
  if (!mappedPointFromEvent(event).inSourceTile) return null
  const bounds = canvas.value!.getBoundingClientRect()
  const local = {
    x: event.clientX - bounds.left - sourceOffset.value.x,
    y: event.clientY - bounds.top - sourceOffset.value.y,
  }
  const handles = selectionHandlePositions(activeSelection.value.points)
  const hitRadius = event.pointerType === 'touch' ? 15 : 9
  const ordered: SelectionTransformMode[] = [
    'rotate',
    'resize-nw',
    'resize-ne',
    'resize-se',
    'resize-sw',
  ]
  return (
    ordered.find((handle) => {
      const point = handles[handle]
      return Math.hypot(local.x - point.x, local.y - point.y) <= hitRadius
    }) ?? null
  )
}

const beginSelectionTransform = (event: PointerEvent, mode: SelectionTransformMode) => {
  const samples = captureSelectionSamples()
  if (!samples.length) return
  selectionTransformMode.value = mode
  selectionTransformSamples.value = samples
  selectionTransformPreview.value = samples
  selectionRotation.value = 0
  if (mode === 'rotate') {
    const bounds = pixelBounds(samples)
    const centerX = (bounds.left + bounds.right + 1) / 2
    const centerY = (bounds.top + bounds.bottom + 1) / 2
    const point = floatingPointFromEvent(event)
    selectionRotationStart.value = Math.atan2(point.y - centerY, point.x - centerX)
  }
}

const resizedBounds = (mode: Exclude<SelectionTransformMode, 'rotate'>, point: PixelPoint) => {
  const source = pixelBounds(selectionTransformSamples.value)
  const target = { ...source }
  if (mode.endsWith('nw')) {
    target.left = Math.min(point.x, source.right)
    target.top = Math.min(point.y, source.bottom)
  } else if (mode.endsWith('ne')) {
    target.right = Math.max(point.x, source.left)
    target.top = Math.min(point.y, source.bottom)
  } else if (mode.endsWith('se')) {
    target.right = Math.max(point.x, source.left)
    target.bottom = Math.max(point.y, source.top)
  } else {
    target.left = Math.min(point.x, source.right)
    target.bottom = Math.max(point.y, source.top)
  }
  return target
}

const updateSelectionTransform = (event: PointerEvent) => {
  const mode = selectionTransformMode.value
  if (!mode || !selectionTransformSamples.value.length) return
  if (mode === 'rotate') {
    const bounds = pixelBounds(selectionTransformSamples.value)
    const centerX = (bounds.left + bounds.right + 1) / 2
    const centerY = (bounds.top + bounds.bottom + 1) / 2
    const point = floatingPointFromEvent(event)
    let angle = Math.atan2(point.y - centerY, point.x - centerX) - selectionRotationStart.value
    if (event.shiftKey) angle = Math.round(angle / (Math.PI / 12)) * (Math.PI / 12)
    selectionRotation.value = angle
    selectionTransformPreview.value = rotatePixelSamples(
      selectionTransformSamples.value,
      angle,
      project.value.width,
      project.value.height,
    )
  } else {
    selectionTransformPreview.value = resizePixelSamples(
      selectionTransformSamples.value,
      resizedBounds(mode, selectionPointFromEvent(event)),
    )
  }
  scheduleRedraw()
}

const resetSelectionTransform = () => {
  selectionTransformMode.value = null
  selectionTransformSamples.value = []
  selectionTransformPreview.value = []
  selectionRotation.value = 0
  selectionRotationStart.value = 0
}

const finishSelectionTransform = () => {
  const mode = selectionTransformMode.value
  if (!mode || !selectionTransformPreview.value.length) {
    resetSelectionTransform()
    return false
  }
  const bounds = pixelBounds(selectionTransformPreview.value)
  const action =
    mode === 'rotate'
      ? `Rotated selection ${Math.round((selectionRotation.value * 180) / Math.PI)}°`
      : `Resized selection to ${bounds.right - bounds.left + 1}×${bounds.bottom - bounds.top + 1}`
  transformSelection(selectionTransformPreview.value, action)
  resetSelectionTransform()
  return true
}

const paintAt = (point: PixelPoint, color: Pixel) => {
  const samples = samplesFromDisplayPoints([point], color)
  const key = samples
    .map((sample) => `${sample.x}:${sample.y}:${sample.color ?? 'transparent'}`)
    .join('|')
  if (lastPainted === key) return
  lastPainted = key
  paintPixelSamples(samples)
  scheduleRedraw()
}

const paintStrokeAt = (point: PixelPoint, color: Pixel) => {
  paintAt(point, color)
}

const beginToolAction = (
  displayPoint: PixelPoint,
  altKey = false,
  fromTouch = false,
  colorTarget: 'primary' | 'secondary' = activeDrawingColor.value,
) => {
  const mapped = mapTiledPoint(
    displayPoint,
    project.value.width,
    project.value.height,
    effectiveColumns.value,
    effectiveRows.value,
  )
  selectionTileAvailable.value = !isSelectionTool.value || mapped.inSourceTile
  const point = { x: mapped.sourceX, y: mapped.sourceY }
  cursor.value = point
  displayCursor.value = displayPoint
  strokeColorTarget.value = colorTarget
  strokeColor.value =
    activeTool.value === 'eraser'
      ? null
      : colorTarget === 'secondary'
        ? secondaryColor.value
        : primaryColor.value
  if (activeTool.value === 'picker' || altKey) {
    pickColor(point.x, point.y, colorTarget)
    return
  }
  if (isSelectionTool.value) {
    if (!mapped.inSourceTile) {
      lastAction.value = 'Selections are available on the outlined source tile'
      return
    }
    if (
      activeSelection.value?.points.some(
        (selected) => selected.x === point.x && selected.y === point.y,
      )
    ) {
      movingSelection.value = true
      selectionDragStart.value = point
      selectionOffset.value = { x: 0, y: 0 }
      return
    }
    clearSelection()
    shapeStart.value = point
    selectionPath.value = [point]
    drawing.value = true
    return
  }
  if (activeTool.value === 'fill') {
    touchMutationCheckpoint = floodFill(point.x, point.y, strokeColor.value, fromTouch) && fromTouch
    return
  }
  if (['line', 'rectangle', 'circle'].includes(activeTool.value)) {
    shapeStartDisplay.value = displayPoint
    drawing.value = true
    return
  }
  beginStroke()
  touchMutationCheckpoint = fromTouch
  drawing.value = true
  lastPainted = ''
  lastStrokePoint.value = point
  lastStrokeDisplayPoint.value = displayPoint
  paintStrokeAt(displayPoint, strokeColor.value)
}

const touchDistance = () => {
  const [first, second] = [...activeTouches.values()]
  return first && second
    ? Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY)
    : 0
}

const cancelPendingTouch = () => {
  if (!pendingTouch) return
  window.clearTimeout(pendingTouch.timer)
  pendingTouch = null
}

const beginPinch = () => {
  const [first, second] = [...activeTouches.values()]
  const host = canvas.value?.closest<HTMLElement>('.canvas-scroll')
  if (!first || !second || !host) return
  cancelPendingTouch()
  if (touchMutationCheckpoint) cancelStroke()
  touchMutationCheckpoint = false
  drawing.value = false
  movingSelection.value = false
  panning.value = false
  shapeStart.value = null
  shapeStartDisplay.value = null
  selectionPath.value = []
  selectionDragStart.value = null
  selectionOffset.value = { x: 0, y: 0 }
  resetSelectionTransform()
  lastStrokePoint.value = null
  lastStrokeDisplayPoint.value = null
  lastPainted = ''
  pinchActive = true
  const bounds = canvas.value!.getBoundingClientRect()
  const focusClientX = (first.clientX + second.clientX) / 2
  const focusClientY = (first.clientY + second.clientY) / 2
  pinchGesture = {
    distance: Math.max(1, touchDistance()),
    zoom: zoom.value,
    focusClientX,
    focusClientY,
    canvasPixelX: Math.max(
      0,
      Math.min(
        project.value.width * effectiveColumns.value,
        (focusClientX - bounds.left) / zoom.value,
      ),
    ),
    canvasPixelY: Math.max(
      0,
      Math.min(
        project.value.height * effectiveRows.value,
        (focusClientY - bounds.top) / zoom.value,
      ),
    ),
    host,
  }
}

const updatePinch = async () => {
  if (!pinchGesture || activeTouches.size < 2) return
  const nextZoom = Math.max(
    4,
    Math.min(24, Math.round(pinchGesture.zoom * (touchDistance() / pinchGesture.distance))),
  )
  if (nextZoom === zoom.value) return
  zoom.value = nextZoom
  await nextTick()
  const bounds = canvas.value!.getBoundingClientRect()
  pinchGesture.host.scrollLeft +=
    bounds.left + pinchGesture.canvasPixelX * nextZoom - pinchGesture.focusClientX
  pinchGesture.host.scrollTop +=
    bounds.top + pinchGesture.canvasPixelY * nextZoom - pinchGesture.focusClientY
}

const queueTouchAction = (event: PointerEvent) => {
  const pending = {
    pointerId: event.pointerId,
    point: displayPointFromEvent(event),
    timer: 0,
  }
  pending.timer = window.setTimeout(() => {
    if (pendingTouch !== pending || pinchActive || activeTouches.size !== 1) return
    pendingTouch = null
    beginToolAction(pending.point, false, true, activeDrawingColor.value)
  }, 110)
  pendingTouch = pending
  const mapped = mapTiledPoint(
    pending.point,
    project.value.width,
    project.value.height,
    effectiveColumns.value,
    effectiveRows.value,
  )
  cursor.value = { x: mapped.sourceX, y: mapped.sourceY }
  displayCursor.value = pending.point
  scheduleRedraw()
}

const beginPan = (event: PointerEvent) => {
  const scrollHost = canvas.value?.closest<HTMLElement>('.canvas-scroll')
  if (!scrollHost) return
  panning.value = true
  panOrigin.value = {
    clientX: event.clientX,
    clientY: event.clientY,
    scrollLeft: scrollHost.scrollLeft,
    scrollTop: scrollHost.scrollTop,
  }
}

const onPointerDown = (event: PointerEvent) => {
  if (event.button !== 0 && event.button !== 2) return
  if (isSelectionTool.value && event.button === 2) return
  modifierKeys.value = { ctrl: event.ctrlKey || event.metaKey, shift: event.shiftKey }
  canvas.value?.setPointerCapture(event.pointerId)
  if (event.pointerType === 'touch') {
    event.preventDefault()
    activeTouches.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY })
    if (activeTouches.size >= 2) {
      beginPinch()
      return
    }
    if (pinchActive) return
    if (activeTool.value === 'hand') {
      beginPan(event)
      return
    }
    const selectionHandle = selectionHandleFromEvent(event)
    if (selectionHandle) {
      beginSelectionTransform(event, selectionHandle)
      return
    }
    queueTouchAction(event)
    return
  }
  if (activeTool.value === 'hand') {
    beginPan(event)
    event.preventDefault()
    return
  }
  const selectionHandle = selectionHandleFromEvent(event)
  if (selectionHandle) {
    beginSelectionTransform(event, selectionHandle)
    event.preventDefault()
    return
  }
  event.preventDefault()
  beginToolAction(
    displayPointFromEvent(event),
    event.altKey,
    false,
    event.button === 2 ? 'secondary' : 'primary',
  )
}

const onPointerMove = async (event: PointerEvent) => {
  modifierKeys.value = { ctrl: event.ctrlKey || event.metaKey, shift: event.shiftKey }
  if (event.pointerType === 'touch' && activeTouches.has(event.pointerId)) {
    event.preventDefault()
    activeTouches.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY })
    if (pinchActive) {
      await updatePinch()
      return
    }
    if (pendingTouch?.pointerId === event.pointerId) {
      pendingTouch.point = displayPointFromEvent(event)
      const mapped = mapTiledPoint(
        pendingTouch.point,
        project.value.width,
        project.value.height,
        effectiveColumns.value,
        effectiveRows.value,
      )
      cursor.value = { x: mapped.sourceX, y: mapped.sourceY }
      displayCursor.value = pendingTouch.point
      scheduleRedraw()
      return
    }
  }
  if (panning.value) {
    const scrollHost = canvas.value?.closest<HTMLElement>('.canvas-scroll')
    if (!scrollHost) return
    scrollHost.scrollLeft = panOrigin.value.scrollLeft - (event.clientX - panOrigin.value.clientX)
    scrollHost.scrollTop = panOrigin.value.scrollTop - (event.clientY - panOrigin.value.clientY)
    return
  }
  if (selectionTransformMode.value) {
    event.preventDefault()
    updateSelectionTransform(event)
    return
  }
  const displayPoint = displayPointFromEvent(event)
  const mapped = mapTiledPoint(
    displayPoint,
    project.value.width,
    project.value.height,
    effectiveColumns.value,
    effectiveRows.value,
  )
  const point = { x: mapped.sourceX, y: mapped.sourceY }
  selectionTileAvailable.value = !isSelectionTool.value || mapped.inSourceTile
  const selectionPoint = selectionPointFromEvent(event)
  cursor.value = point
  displayCursor.value = displayPoint
  if (movingSelection.value && selectionDragStart.value) {
    selectionOffset.value = boundedSelectionOffset(selectionDragStart.value, selectionPoint)
    scheduleRedraw()
  } else if (drawing.value && activeTool.value === 'select-lasso') {
    const previous = selectionPath.value.at(-1) ?? selectionPoint
    rasterLine(previous, selectionPoint)
      .slice(1)
      .forEach((entry) => selectionPath.value.push(entry))
    scheduleRedraw()
  } else if (drawing.value && activeTool.value === 'select-rect') {
    scheduleRedraw()
  } else if (drawing.value && ['pencil', 'mirror', 'dither', 'eraser'].includes(activeTool.value)) {
    const points = lastStrokeDisplayPoint.value
      ? rasterLine(lastStrokeDisplayPoint.value, displayPoint)
      : [displayPoint]
    points.forEach((strokePoint) => paintStrokeAt(strokePoint, strokeColor.value))
    lastStrokePoint.value = point
    lastStrokeDisplayPoint.value = displayPoint
  } else {
    hoveredSelectionHandle.value = selectionHandleFromEvent(event)
    scheduleRedraw()
  }
}

const onPointerUp = (event: PointerEvent) => {
  if (event.pointerType === 'touch') {
    event.preventDefault()
    if (pendingTouch?.pointerId === event.pointerId) {
      const point = displayPointFromEvent(event)
      cancelPendingTouch()
      if (!pinchActive) beginToolAction(point, false, true, activeDrawingColor.value)
    }
    activeTouches.delete(event.pointerId)
    if (pinchActive) {
      if (activeTouches.size === 0) {
        pinchActive = false
        pinchGesture = null
      }
      canvas.value?.releasePointerCapture(event.pointerId)
      return
    }
  }
  if (panning.value) {
    panning.value = false
    canvas.value?.releasePointerCapture(event.pointerId)
    return
  }
  if (selectionTransformMode.value) {
    finishSelectionTransform()
    canvas.value?.releasePointerCapture(event.pointerId)
    scheduleRedraw()
    return
  }
  if (movingSelection.value) {
    moveSelection(selectionOffset.value.x, selectionOffset.value.y)
    movingSelection.value = false
    selectionDragStart.value = null
    selectionOffset.value = { x: 0, y: 0 }
    canvas.value?.releasePointerCapture(event.pointerId)
    scheduleRedraw()
    return
  }
  if (!drawing.value) {
    touchMutationCheckpoint = false
    canvas.value?.releasePointerCapture(event.pointerId)
    return
  }
  const point = isSelectionTool.value ? selectionPointFromEvent(event) : pointFromEvent(event)
  if (shapeStart.value && activeTool.value === 'select-rect') {
    setSelection('rectangle', rasterFilledRectangle(shapeStart.value, point))
  } else if (shapeStart.value && activeTool.value === 'select-lasso') {
    setSelection(
      'lasso',
      rasterLassoSelection(selectionPath.value, project.value.width, project.value.height),
    )
  } else if (
    shapeStartDisplay.value &&
    ['line', 'rectangle', 'circle'].includes(activeTool.value)
  ) {
    const label =
      activeTool.value === 'line'
        ? ['Draw line', 'Drew line']
        : activeTool.value === 'circle'
          ? ['Draw circle', 'Drew circle']
          : ['Draw rectangle', 'Drew rectangle']
    commitPixelSamples(activeShapeSamples(), label[0]!, label[1]!)
  } else {
    endStroke()
  }
  drawing.value = false
  shapeStart.value = null
  shapeStartDisplay.value = null
  displayCursor.value = null
  selectionPath.value = []
  lastStrokePoint.value = null
  lastStrokeDisplayPoint.value = null
  lastPainted = ''
  touchMutationCheckpoint = false
  canvas.value?.releasePointerCapture(event.pointerId)
  scheduleRedraw()
}

const onPointerCancel = (event: PointerEvent) => {
  if (pendingTouch?.pointerId === event.pointerId) cancelPendingTouch()
  activeTouches.delete(event.pointerId)
  if (touchMutationCheckpoint) cancelStroke()
  touchMutationCheckpoint = false
  drawing.value = false
  movingSelection.value = false
  panning.value = false
  shapeStart.value = null
  shapeStartDisplay.value = null
  selectionPath.value = []
  selectionDragStart.value = null
  selectionOffset.value = { x: 0, y: 0 }
  resetSelectionTransform()
  lastStrokePoint.value = null
  lastStrokeDisplayPoint.value = null
  lastPainted = ''
  if (activeTouches.size === 0) {
    pinchActive = false
    pinchGesture = null
  }
  canvas.value?.releasePointerCapture(event.pointerId)
  scheduleRedraw()
}

const onPointerLeave = () => {
  if (panning.value || drawing.value || movingSelection.value || selectionTransformMode.value)
    return
  cursor.value = null
  hoveredSelectionHandle.value = null
  scheduleRedraw()
}

watch(
  [
    () => project.value.id,
    () => project.value.width,
    () => project.value.height,
    () => project.value.checkerSize,
    activeFrameId,
    activeTool,
    activeSelection,
    zoom,
    showGrid,
    showTransparency,
    onionSkin,
    effectiveColumns,
    effectiveRows,
    dirtyRevision,
  ],
  scheduleRedraw,
  {
    flush: 'post',
  },
)
onMounted(redraw)
onBeforeUnmount(() => {
  cancelPendingTouch()
  activeTouches.clear()
  if (redrawFrame !== null) window.cancelAnimationFrame(redrawFrame)
})
</script>

<template>
  <div class="canvas-mat" data-testid="canvas-mat">
    <canvas
      ref="canvas"
      class="pixel-canvas"
      :class="{
        'show-transparency': showTransparency,
        'cursor-grab': activeTool === 'hand' && !panning,
        'cursor-grabbing': panning,
        'cursor-select': isSelectionTool,
        'selection-unavailable': isSelectionTool && !selectionTileAvailable,
      }"
      :style="{
        width: `${canvasWidth}px`,
        height: `${canvasHeight}px`,
        '--checker-tile-size': `${Math.max(zoom * project.checkerSize, 4)}px`,
        cursor: selectionCursor,
      }"
      :aria-label="`${project.name} pixel canvas, ${project.width} by ${project.height}`"
      tabindex="0"
      data-testid="pixel-canvas"
      :data-tiled-mode="tiledMode"
      @contextmenu.prevent
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @pointerleave="onPointerLeave"
    />
  </div>
</template>
