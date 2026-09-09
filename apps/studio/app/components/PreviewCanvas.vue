<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    frameId?: string
    layerId?: string
    size?: number
    animate?: boolean
  }>(),
  { frameId: undefined, layerId: undefined, size: 144, animate: false },
)

const { project, activeFrameId, dirtyRevision } = useEditor()
const canvas = ref<HTMLCanvasElement | null>(null)
const animationFrameId = ref(activeFrameId.value)
let timer: number | null = null
let redrawFrame: number | null = null

const displayedFrame = computed(
  () => props.frameId ?? (props.animate ? animationFrameId.value : activeFrameId.value),
)
const previewScale = computed(() => {
  const largestEdge = Math.max(project.value.width, project.value.height)
  return largestEdge <= props.size
    ? Math.max(1, Math.floor(props.size / largestEdge))
    : props.size / largestEdge
})
const previewWidth = computed(() =>
  Math.max(1, Math.round(project.value.width * previewScale.value)),
)
const previewHeight = computed(() =>
  Math.max(1, Math.round(project.value.height * previewScale.value)),
)

const redraw = () => {
  const element = canvas.value
  if (!element) return
  const width = previewWidth.value
  const height = previewHeight.value
  if (element.width !== width) element.width = width
  if (element.height !== height) element.height = height
  const context = element.getContext('2d')!
  context.clearRect(0, 0, width, height)
  context.imageSmoothingEnabled = false
  const layer = props.layerId
    ? project.value.layers.find((item) => item.id === props.layerId)
    : null
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(
      project.value.height - 1,
      Math.floor((y / height) * project.value.height),
    )
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(
        project.value.width - 1,
        Math.floor((x / width) * project.value.width),
      )
      const index = sourceY * project.value.width + sourceX
      let color: string | null = null
      if (layer) {
        if (layer.visible && layer.opacity > 0)
          color = layer.cels[displayedFrame.value]?.[index] ?? null
      } else {
        for (const candidate of project.value.layers) {
          if (!candidate.visible || candidate.opacity <= 0) continue
          const next = candidate.cels[displayedFrame.value]?.[index]
          if (next) {
            color = next
          }
        }
      }
      if (color) {
        context.fillStyle = color
        context.fillRect(x, y, 1, 1)
      }
    }
  }
}

const scheduleRedraw = () => {
  if (redrawFrame !== null) return
  redrawFrame = window.requestAnimationFrame(() => {
    redrawFrame = null
    redraw()
  })
}

const schedule = () => {
  if (!props.animate) return
  if (timer) window.clearTimeout(timer)
  const currentIndex = project.value.frames.findIndex(
    (frame) => frame.id === animationFrameId.value,
  )
  const current = project.value.frames[currentIndex] ?? project.value.frames[0]!
  timer = window.setTimeout(() => {
    animationFrameId.value =
      project.value.frames[(currentIndex + 1) % project.value.frames.length]!.id
    schedule()
  }, current.duration)
}

watch(
  [
    () => project.value.id,
    () => project.value.width,
    () => project.value.height,
    displayedFrame,
    dirtyRevision,
    previewWidth,
    previewHeight,
    () => props.layerId,
  ],
  scheduleRedraw,
  { flush: 'post' },
)
watch(() => props.animate, schedule)
onMounted(() => {
  redraw()
  schedule()
})
onBeforeUnmount(() => {
  if (timer) window.clearTimeout(timer)
  if (redrawFrame !== null) window.cancelAnimationFrame(redrawFrame)
})
</script>

<template>
  <canvas
    ref="canvas"
    class="preview-canvas"
    :style="{ width: `${previewWidth}px`, height: `${previewHeight}px` }"
    aria-label="Sprite preview"
  />
</template>
