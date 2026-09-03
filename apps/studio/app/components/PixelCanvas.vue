<script setup lang="ts">
import type { Pixel, PixelPoint, PixelSample } from '~/types/editor'
import { drawProjectFrame, getCompositePixels } from '~/utils/render'
import {
  rasterFilledRectangle,
  rasterLassoSelection,
  pixelBounds,
  rasterCircle,
  rasterLine,
  rasterRectangle,
  resizePixelSamples,
  rotatePixelSamples,
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
  activePixels,
  selection,
  activeSelection,
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
} = useEditor()

type SelectionTransformMode = 'resize-nw' | 'resize-ne' | 'resize-se' | 'resize-sw' | 'rotate'

const canvas = ref<HTMLCanvasElement | null>(null)
const drawing = ref(false)
const panning = ref(false)
const shapeStart = ref<PixelPoint | null>(null)
const cursor = ref<PixelPoint | null>(null)
const strokeColor = ref<Pixel>(drawingColor.value)
const strokeColorTarget = ref<'primary' | 'secondary'>('primary')
const lastStrokePoint = ref<PixelPoint | null>(null)
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

const canvasWidth = computed(() => project.value.width * zoom.value)
const canvasHeight = computed(() => project.value.height * zoom.value)
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
  const rotateBelow = canvasHeight.value - bottom >= 18
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

const redraw = () => {
  const element = canvas.value
  if (!element) return
  element.width = canvasWidth.value
  element.height = canvasHeight.value
  const context = element.getContext('2d')!
  if (showTransparency.value) {
    const checkerSize = Math.max(zoom.value * project.value.checkerSize, 4)
    for (let y = 0; y < element.height; y += checkerSize) {
      for (let x = 0; x < element.width; x += checkerSize) {
        context.fillStyle = (x / checkerSize + y / checkerSize) % 2 ? '#171a20' : '#2b3039'
        context.fillRect(x, y, checkerSize, checkerSize)
      }
    }
  } else {
    context.fillStyle = '#171a20'
    context.fillRect(0, 0, element.width, element.height)
  }

  if (onionSkin.value && project.value.frames.length > 1) {
    const currentIndex = project.value.frames.findIndex((frame) => frame.id === activeFrameId.value)
    const previous = currentIndex > 0 ? project.value.frames[currentIndex - 1] : undefined
    if (previous) {
      context.save()
      context.globalAlpha = 0.24
      context.fillStyle = '#c4b5fd'
      getCompositePixels(project.value, previous.id).forEach((pixel, index) => {
        if (!pixel) return
        context.fillRect(
          (index % project.value.width) * zoom.value,
          Math.floor(index / project.value.width) * zoom.value,
          zoom.value,
          zoom.value,
        )
      })
      context.restore()
    }
  }
  drawProjectFrame(context, project.value, activeFrameId.value, zoom.value, false)

  if (drawing.value && shapeStart.value && cursor.value) {
    if (isSelectionTool.value) {
      drawSelection(context, draftSelectionPoints())
    } else {
      const points =
        activeTool.value === 'line'
          ? rasterLine(shapeStart.value, cursor.value)
          : activeTool.value === 'circle'
            ? rasterCircle(shapeStart.value, cursor.value)
            : rasterRectangle(shapeStart.value, cursor.value)
      const radius = Math.floor((brushSize.value - 1) / 2)
      context.save()
      context.globalAlpha = 0.78
      context.fillStyle = strokeColor.value ?? '#d946ef'
      points.forEach((point) => {
        for (let offsetY = -radius; offsetY < brushSize.value - radius; offsetY += 1) {
          for (let offsetX = -radius; offsetX < brushSize.value - radius; offsetX += 1) {
            const x = point.x + offsetX
            const y = point.y + offsetY
            if (x >= 0 && y >= 0 && x < project.value.width && y < project.value.height) {
              context.fillRect(x * zoom.value, y * zoom.value, zoom.value, zoom.value)
            }
          }
        }
      })
      context.restore()
    }
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

  if (showGrid.value && zoom.value >= 8) {
    context.beginPath()
    context.strokeStyle = 'rgba(15, 13, 23, 0.42)'
    context.lineWidth = 1
    for (let x = 0; x <= project.value.width; x += 1) {
      context.moveTo(x * zoom.value + 0.5, 0)
      context.lineTo(x * zoom.value + 0.5, element.height)
    }
    for (let y = 0; y <= project.value.height; y += 1) {
      context.moveTo(0, y * zoom.value + 0.5)
      context.lineTo(element.width, y * zoom.value + 0.5)
    }
    context.stroke()
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
      const labelX = ((bounds.left + bounds.right + 1) / 2) * zoom.value
      const labelY = Math.max(12, bounds.top * zoom.value - 22)
      context.fillText(`${Math.round((selectionRotation.value * 180) / Math.PI)}°`, labelX, labelY)
      context.restore()
    }
  }

  if (cursor.value && activeTool.value !== 'hand' && !isSelectionTool.value) {
    context.strokeStyle = '#ffffff'
    context.lineWidth = 1
    mirrorPoints(cursor.value).forEach((point) =>
      context.strokeRect(
        point.x * zoom.value + 0.5,
        point.y * zoom.value + 0.5,
        zoom.value - 1,
        zoom.value - 1,
      ),
    )
  }
}

const pointFromEvent = (event: PointerEvent): PixelPoint => {
  const bounds = canvas.value!.getBoundingClientRect()
  return {
    x: Math.max(
      0,
      Math.min(
        project.value.width - 1,
        Math.floor(((event.clientX - bounds.left) / bounds.width) * project.value.width),
      ),
    ),
    y: Math.max(
      0,
      Math.min(
        project.value.height - 1,
        Math.floor(((event.clientY - bounds.top) / bounds.height) * project.value.height),
      ),
    ),
  }
}

const floatingPointFromEvent = (event: PointerEvent): PixelPoint => {
  const bounds = canvas.value!.getBoundingClientRect()
  return {
    x: ((event.clientX - bounds.left) / bounds.width) * project.value.width,
    y: ((event.clientY - bounds.top) / bounds.height) * project.value.height,
  }
}

const selectionHandleFromEvent = (event: PointerEvent): SelectionTransformMode | null => {
  if (!isSelectionTool.value || !activeSelection.value?.points.length) return null
  const bounds = canvas.value!.getBoundingClientRect()
  const local = { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
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
      resizedBounds(mode, pointFromEvent(event)),
    )
  }
  redraw()
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
  const key = `${activeTool.value}:${point.x}:${point.y}:${color ?? 'transparent'}`
  if (lastPainted === key) return
  lastPainted = key
  if (activeTool.value === 'dither') paintDitherPixel(point.x, point.y, strokeColorTarget.value)
  else paintPixel(point.x, point.y, color)
  redraw()
}

const paintStrokeAt = (point: PixelPoint, color: Pixel) => {
  mirrorPoints(point).forEach((target) => paintAt(target, color))
}

const beginToolAction = (
  point: PixelPoint,
  altKey = false,
  fromTouch = false,
  colorTarget: 'primary' | 'secondary' = activeDrawingColor.value,
) => {
  cursor.value = point
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
    touchMutationCheckpoint = fromTouch && floodFill(point.x, point.y, strokeColor.value)
    return
  }
  if (['line', 'rectangle', 'circle'].includes(activeTool.value)) {
    shapeStart.value = point
    drawing.value = true
    return
  }
  beginStroke()
  touchMutationCheckpoint = fromTouch
  drawing.value = true
  lastPainted = ''
  lastStrokePoint.value = point
  paintStrokeAt(point, strokeColor.value)
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
  selectionPath.value = []
  selectionDragStart.value = null
  selectionOffset.value = { x: 0, y: 0 }
  resetSelectionTransform()
  lastStrokePoint.value = null
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
      Math.min(project.value.width, (focusClientX - bounds.left) / zoom.value),
    ),
    canvasPixelY: Math.max(
      0,
      Math.min(project.value.height, (focusClientY - bounds.top) / zoom.value),
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
    point: pointFromEvent(event),
    timer: 0,
  }
  pending.timer = window.setTimeout(() => {
    if (pendingTouch !== pending || pinchActive || activeTouches.size !== 1) return
    pendingTouch = null
    beginToolAction(pending.point, false, true, activeDrawingColor.value)
  }, 110)
  pendingTouch = pending
  cursor.value = pending.point
  redraw()
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
    pointFromEvent(event),
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
      pendingTouch.point = pointFromEvent(event)
      cursor.value = pendingTouch.point
      redraw()
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
  const point = pointFromEvent(event)
  cursor.value = point
  if (movingSelection.value && selectionDragStart.value) {
    selectionOffset.value = boundedSelectionOffset(selectionDragStart.value, point)
    redraw()
  } else if (drawing.value && activeTool.value === 'select-lasso') {
    const previous = selectionPath.value.at(-1) ?? point
    rasterLine(previous, point)
      .slice(1)
      .forEach((entry) => selectionPath.value.push(entry))
    redraw()
  } else if (drawing.value && activeTool.value === 'select-rect') {
    redraw()
  } else if (drawing.value && ['pencil', 'mirror', 'dither', 'eraser'].includes(activeTool.value)) {
    const points = lastStrokePoint.value ? rasterLine(lastStrokePoint.value, point) : [point]
    points.forEach((strokePoint) => paintStrokeAt(strokePoint, strokeColor.value))
    lastStrokePoint.value = point
  } else {
    hoveredSelectionHandle.value = selectionHandleFromEvent(event)
    redraw()
  }
}

const onPointerUp = (event: PointerEvent) => {
  if (event.pointerType === 'touch') {
    event.preventDefault()
    if (pendingTouch?.pointerId === event.pointerId) {
      const point = pointFromEvent(event)
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
    redraw()
    return
  }
  if (movingSelection.value) {
    moveSelection(selectionOffset.value.x, selectionOffset.value.y)
    movingSelection.value = false
    selectionDragStart.value = null
    selectionOffset.value = { x: 0, y: 0 }
    canvas.value?.releasePointerCapture(event.pointerId)
    redraw()
    return
  }
  if (!drawing.value) {
    touchMutationCheckpoint = false
    canvas.value?.releasePointerCapture(event.pointerId)
    return
  }
  const point = pointFromEvent(event)
  if (shapeStart.value && activeTool.value === 'select-rect') {
    setSelection('rectangle', rasterFilledRectangle(shapeStart.value, point))
  } else if (shapeStart.value && activeTool.value === 'select-lasso') {
    setSelection(
      'lasso',
      rasterLassoSelection(selectionPath.value, project.value.width, project.value.height),
    )
  } else if (shapeStart.value && activeTool.value === 'line') {
    drawLine(shapeStart.value.x, shapeStart.value.y, point.x, point.y, strokeColor.value)
  } else if (shapeStart.value && activeTool.value === 'rectangle') {
    drawRectangle(shapeStart.value.x, shapeStart.value.y, point.x, point.y, strokeColor.value)
  } else if (shapeStart.value && activeTool.value === 'circle') {
    drawCircle(shapeStart.value.x, shapeStart.value.y, point.x, point.y, strokeColor.value)
  } else {
    endStroke()
  }
  drawing.value = false
  shapeStart.value = null
  selectionPath.value = []
  lastStrokePoint.value = null
  lastPainted = ''
  touchMutationCheckpoint = false
  canvas.value?.releasePointerCapture(event.pointerId)
  redraw()
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
  selectionPath.value = []
  selectionDragStart.value = null
  selectionOffset.value = { x: 0, y: 0 }
  resetSelectionTransform()
  lastStrokePoint.value = null
  lastPainted = ''
  if (activeTouches.size === 0) {
    pinchActive = false
    pinchGesture = null
  }
  canvas.value?.releasePointerCapture(event.pointerId)
  redraw()
}

const onPointerLeave = () => {
  if (panning.value || drawing.value || movingSelection.value || selectionTransformMode.value)
    return
  cursor.value = null
  hoveredSelectionHandle.value = null
  redraw()
}

watch(
  [
    project,
    activeFrameId,
    activeTool,
    selection,
    zoom,
    showGrid,
    showTransparency,
    onionSkin,
    dirtyRevision,
  ],
  redraw,
  {
    deep: true,
    flush: 'post',
  },
)
onMounted(redraw)
onBeforeUnmount(() => {
  cancelPendingTouch()
  activeTouches.clear()
})
</script>

<template>
  <div class="canvas-mat" data-testid="canvas-mat">
    <canvas
      ref="canvas"
      class="pixel-canvas"
      :class="{
        'cursor-grab': activeTool === 'hand' && !panning,
        'cursor-grabbing': panning,
        'cursor-select': isSelectionTool,
      }"
      :style="{
        width: `${canvasWidth}px`,
        height: `${canvasHeight}px`,
        cursor: selectionCursor,
      }"
      :aria-label="`${project.name} pixel canvas, ${project.width} by ${project.height}`"
      tabindex="0"
      data-testid="pixel-canvas"
      @contextmenu.prevent
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @pointerleave="onPointerLeave"
    />
  </div>
</template>
