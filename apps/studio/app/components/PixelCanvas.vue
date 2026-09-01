<script setup lang="ts">
import type { Pixel, PixelPoint } from '~/types/editor'
import { drawProjectFrame, getCompositePixels } from '~/utils/render'
import { rasterLine, rasterRectangle } from '~/utils/raster'

const {
  project,
  activeFrameId,
  activeTool,
  activeDrawingColor,
  drawingColor,
  brushSize,
  zoom,
  showGrid,
  showTransparency,
  onionSkin,
  dirtyRevision,
  beginStroke,
  paintPixel,
  paintDitherPixel,
  endStroke,
  pickColor,
  floodFill,
  drawLine,
  drawRectangle,
} = useEditor()

const canvas = ref<HTMLCanvasElement | null>(null)
const drawing = ref(false)
const panning = ref(false)
const shapeStart = ref<PixelPoint | null>(null)
const cursor = ref<PixelPoint | null>(null)
const strokeColor = ref<Pixel>(drawingColor.value)
const lastStrokePoint = ref<PixelPoint | null>(null)
const panOrigin = ref({ clientX: 0, clientY: 0, scrollLeft: 0, scrollTop: 0 })
const modifierKeys = ref({ ctrl: false, shift: false })
let lastPainted = ''

const canvasWidth = computed(() => project.value.width * zoom.value)
const canvasHeight = computed(() => project.value.height * zoom.value)

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
        context.fillStyle = (x / checkerSize + y / checkerSize) % 2 ? '#202520' : '#303730'
        context.fillRect(x, y, checkerSize, checkerSize)
      }
    }
  } else {
    context.fillStyle = '#202520'
    context.fillRect(0, 0, element.width, element.height)
  }

  if (onionSkin.value && project.value.frames.length > 1) {
    const currentIndex = project.value.frames.findIndex((frame) => frame.id === activeFrameId.value)
    const previous = currentIndex > 0 ? project.value.frames[currentIndex - 1] : undefined
    if (previous) {
      context.save()
      context.globalAlpha = 0.24
      context.fillStyle = '#79d8b0'
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
    const points =
      activeTool.value === 'line'
        ? rasterLine(shapeStart.value, cursor.value)
        : rasterRectangle(shapeStart.value, cursor.value)
    const radius = Math.floor((brushSize.value - 1) / 2)
    context.save()
    context.globalAlpha = 0.78
    context.fillStyle = strokeColor.value ?? '#ff875f'
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

  if (showGrid.value && zoom.value >= 8) {
    context.beginPath()
    context.strokeStyle = 'rgba(6, 10, 7, 0.34)'
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

  if (cursor.value && activeTool.value !== 'hand') {
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
  if (activeTool.value === 'dither') paintDitherPixel(point.x, point.y)
  else paintPixel(point.x, point.y, color)
  redraw()
}

const paintStrokeAt = (point: PixelPoint, color: Pixel) => {
  mirrorPoints(point).forEach((target) => paintAt(target, color))
}

const onPointerDown = (event: PointerEvent) => {
  if (event.button !== 0) return
  modifierKeys.value = { ctrl: event.ctrlKey || event.metaKey, shift: event.shiftKey }
  canvas.value?.setPointerCapture(event.pointerId)
  if (activeTool.value === 'hand') {
    const scrollHost = canvas.value?.closest<HTMLElement>('.canvas-scroll')
    if (!scrollHost) return
    panning.value = true
    panOrigin.value = {
      clientX: event.clientX,
      clientY: event.clientY,
      scrollLeft: scrollHost.scrollLeft,
      scrollTop: scrollHost.scrollTop,
    }
    event.preventDefault()
    return
  }
  const point = pointFromEvent(event)
  cursor.value = point
  strokeColor.value = activeTool.value === 'eraser' ? null : drawingColor.value
  if (activeTool.value === 'picker' || event.altKey) {
    pickColor(point.x, point.y, activeDrawingColor.value)
    return
  }
  if (activeTool.value === 'fill') {
    floodFill(point.x, point.y, strokeColor.value)
    return
  }
  if (activeTool.value === 'line' || activeTool.value === 'rectangle') {
    shapeStart.value = point
    drawing.value = true
    return
  }
  beginStroke()
  drawing.value = true
  lastPainted = ''
  lastStrokePoint.value = point
  paintStrokeAt(point, strokeColor.value)
}

const onPointerMove = (event: PointerEvent) => {
  modifierKeys.value = { ctrl: event.ctrlKey || event.metaKey, shift: event.shiftKey }
  if (panning.value) {
    const scrollHost = canvas.value?.closest<HTMLElement>('.canvas-scroll')
    if (!scrollHost) return
    scrollHost.scrollLeft = panOrigin.value.scrollLeft - (event.clientX - panOrigin.value.clientX)
    scrollHost.scrollTop = panOrigin.value.scrollTop - (event.clientY - panOrigin.value.clientY)
    return
  }
  const point = pointFromEvent(event)
  cursor.value = point
  if (drawing.value && ['pencil', 'mirror', 'dither', 'eraser'].includes(activeTool.value)) {
    const points = lastStrokePoint.value ? rasterLine(lastStrokePoint.value, point) : [point]
    points.forEach((strokePoint) => paintStrokeAt(strokePoint, strokeColor.value))
    lastStrokePoint.value = point
  } else {
    redraw()
  }
}

const onPointerUp = (event: PointerEvent) => {
  if (panning.value) {
    panning.value = false
    canvas.value?.releasePointerCapture(event.pointerId)
    return
  }
  if (!drawing.value) return
  const point = pointFromEvent(event)
  if (shapeStart.value && activeTool.value === 'line') {
    drawLine(shapeStart.value.x, shapeStart.value.y, point.x, point.y, strokeColor.value)
  } else if (shapeStart.value && activeTool.value === 'rectangle') {
    drawRectangle(shapeStart.value.x, shapeStart.value.y, point.x, point.y, strokeColor.value)
  } else {
    endStroke()
  }
  drawing.value = false
  shapeStart.value = null
  lastStrokePoint.value = null
  lastPainted = ''
  canvas.value?.releasePointerCapture(event.pointerId)
  redraw()
}

const onPointerLeave = () => {
  if (panning.value) return
  cursor.value = null
  redraw()
}

watch(
  [project, activeFrameId, zoom, showGrid, showTransparency, onionSkin, dirtyRevision],
  redraw,
  {
    deep: true,
    flush: 'post',
  },
)
onMounted(redraw)
</script>

<template>
  <div class="canvas-mat" data-testid="canvas-mat">
    <canvas
      ref="canvas"
      class="pixel-canvas"
      :class="{ 'cursor-grab': activeTool === 'hand' && !panning, 'cursor-grabbing': panning }"
      :style="{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }"
      :aria-label="`${project.name} pixel canvas, ${project.width} by ${project.height}`"
      tabindex="0"
      data-testid="pixel-canvas"
      @contextmenu.prevent
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
      @pointerleave="onPointerLeave"
    />
  </div>
</template>
