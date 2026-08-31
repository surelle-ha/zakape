<script setup lang="ts">
import type { PixelPoint } from '~/types/editor'
import { drawProjectFrame } from '~/utils/render'

const {
  project,
  activeFrameId,
  activeTool,
  primaryColor,
  zoom,
  showGrid,
  onionSkin,
  dirtyRevision,
  beginStroke,
  paintPixel,
  endStroke,
  pickColor,
  floodFill,
  drawLine,
  drawRectangle,
} = useEditor()

const canvas = ref<HTMLCanvasElement | null>(null)
const drawing = ref(false)
const shapeStart = ref<PixelPoint | null>(null)
const cursor = ref<PixelPoint | null>(null)
let lastPainted = ''

const canvasWidth = computed(() => project.value.width * zoom.value)
const canvasHeight = computed(() => project.value.height * zoom.value)

const redraw = () => {
  const element = canvas.value
  if (!element) return
  element.width = canvasWidth.value
  element.height = canvasHeight.value
  const context = element.getContext('2d')!
  const checkerSize = Math.max(zoom.value * 2, 12)
  for (let y = 0; y < element.height; y += checkerSize) {
    for (let x = 0; x < element.width; x += checkerSize) {
      context.fillStyle = (x / checkerSize + y / checkerSize) % 2 ? '#202520' : '#282e28'
      context.fillRect(x, y, checkerSize, checkerSize)
    }
  }

  if (onionSkin.value && project.value.frames.length > 1) {
    const currentIndex = project.value.frames.findIndex((frame) => frame.id === activeFrameId.value)
    const previous =
      project.value.frames[
        (currentIndex - 1 + project.value.frames.length) % project.value.frames.length
      ]
    if (previous) {
      context.save()
      context.globalAlpha = 0.17
      drawProjectFrame(context, project.value, previous.id, zoom.value)
      context.restore()
    }
  }
  drawProjectFrame(context, project.value, activeFrameId.value, zoom.value)

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
    context.strokeRect(
      cursor.value.x * zoom.value + 0.5,
      cursor.value.y * zoom.value + 0.5,
      zoom.value - 1,
      zoom.value - 1,
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

const paintAt = (point: PixelPoint, erase = false) => {
  const key = `${point.x}:${point.y}:${erase}`
  if (lastPainted === key) return
  lastPainted = key
  paintPixel(point.x, point.y, erase ? null : primaryColor.value)
  redraw()
}

const onPointerDown = (event: PointerEvent) => {
  if (activeTool.value === 'hand') return
  const point = pointFromEvent(event)
  cursor.value = point
  canvas.value?.setPointerCapture(event.pointerId)
  if (activeTool.value === 'picker' || event.altKey) {
    pickColor(point.x, point.y)
    return
  }
  if (activeTool.value === 'fill') {
    floodFill(point.x, point.y, event.button === 2 ? null : primaryColor.value)
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
  paintAt(point, activeTool.value === 'eraser' || event.button === 2)
}

const onPointerMove = (event: PointerEvent) => {
  const point = pointFromEvent(event)
  cursor.value = point
  if (drawing.value && (activeTool.value === 'pencil' || activeTool.value === 'eraser')) {
    paintAt(point, activeTool.value === 'eraser' || (event.buttons & 2) === 2)
  } else {
    redraw()
  }
}

const onPointerUp = (event: PointerEvent) => {
  if (!drawing.value) return
  const point = pointFromEvent(event)
  if (shapeStart.value && activeTool.value === 'line') {
    drawLine(shapeStart.value.x, shapeStart.value.y, point.x, point.y)
  } else if (shapeStart.value && activeTool.value === 'rectangle') {
    drawRectangle(shapeStart.value.x, shapeStart.value.y, point.x, point.y)
  } else {
    endStroke()
  }
  drawing.value = false
  shapeStart.value = null
  lastPainted = ''
  redraw()
}

const onPointerLeave = () => {
  cursor.value = null
  redraw()
}

watch([project, activeFrameId, zoom, showGrid, onionSkin, dirtyRevision], redraw, {
  deep: true,
  flush: 'post',
})
onMounted(redraw)
</script>

<template>
  <div class="canvas-mat" data-testid="canvas-mat">
    <canvas
      ref="canvas"
      class="pixel-canvas"
      :class="{ 'cursor-grab': activeTool === 'hand' }"
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
