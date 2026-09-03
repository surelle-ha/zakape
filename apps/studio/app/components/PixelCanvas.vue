<script setup lang="ts">
import type { Pixel, PixelPoint } from '~/types/editor'
import { drawProjectFrame, getCompositePixels } from '~/utils/render'
import {
  rasterFilledRectangle,
  rasterLassoSelection,
  rasterLine,
  rasterRectangle,
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
  setSelection,
  clearSelection,
  moveSelection,
} = useEditor()

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
const panOrigin = ref({ clientX: 0, clientY: 0, scrollLeft: 0, scrollTop: 0 })
const modifierKeys = ref({ ctrl: false, shift: false })
const activeTouches = new Map<number, { clientX: number; clientY: number }>()
let pendingTouch: { pointerId: number; point: PixelPoint; timer: number } | null = null
let pinchActive = false
let touchMutationCheckpoint = false
let pinchGesture: {
  distance: number
  zoom: number
  focusX: number
  focusY: number
  contentX: number
  contentY: number
  host: HTMLElement
} | null = null
let lastPainted = ''

const canvasWidth = computed(() => project.value.width * zoom.value)
const canvasHeight = computed(() => project.value.height * zoom.value)
const selectionTools = ['select-rect', 'select-lasso'] as const
const isSelectionTool = computed(() =>
  selectionTools.includes(activeTool.value as (typeof selectionTools)[number]),
)

const selectionBounds = (points: PixelPoint[]) => ({
  left: Math.min(...points.map((point) => point.x)),
  right: Math.max(...points.map((point) => point.x)),
  top: Math.min(...points.map((point) => point.y)),
  bottom: Math.max(...points.map((point) => point.y)),
})

const boundedSelectionOffset = (from: PixelPoint, to: PixelPoint) => {
  if (!activeSelection.value?.points.length) return { x: 0, y: 0 }
  const bounds = selectionBounds(activeSelection.value.points)
  return {
    x: Math.max(-bounds.left, Math.min(project.value.width - 1 - bounds.right, to.x - from.x)),
    y: Math.max(-bounds.top, Math.min(project.value.height - 1 - bounds.bottom, to.y - from.y)),
  }
}

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
    const checkerSize = Math.max(zoom.value * 2, 12)
    for (let y = 0; y < element.height; y += checkerSize) {
      for (let x = 0; x < element.width; x += checkerSize) {
        context.fillStyle = (x / checkerSize + y / checkerSize) % 2 ? '#211c2d' : '#383047'
        context.fillRect(x, y, checkerSize, checkerSize)
      }
    }
  } else {
    context.fillStyle = '#211c2d'
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
    if (movingSelection.value) {
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
    drawSelection(
      context,
      activeSelection.value.points,
      movingSelection.value ? selectionOffset.value : undefined,
    )
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
  if (activeTool.value === 'line' || activeTool.value === 'rectangle') {
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
  lastStrokePoint.value = null
  lastPainted = ''
  pinchActive = true
  const bounds = host.getBoundingClientRect()
  const focusX = (first.clientX + second.clientX) / 2 - bounds.left
  const focusY = (first.clientY + second.clientY) / 2 - bounds.top
  pinchGesture = {
    distance: Math.max(1, touchDistance()),
    zoom: zoom.value,
    focusX,
    focusY,
    contentX: host.scrollLeft + focusX,
    contentY: host.scrollTop + focusY,
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
  const scale = nextZoom / pinchGesture.zoom
  pinchGesture.host.scrollLeft = pinchGesture.contentX * scale - pinchGesture.focusX
  pinchGesture.host.scrollTop = pinchGesture.contentY * scale - pinchGesture.focusY
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
    queueTouchAction(event)
    return
  }
  if (activeTool.value === 'hand') {
    beginPan(event)
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
  if (panning.value || drawing.value || movingSelection.value) return
  cursor.value = null
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
      :style="{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }"
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
