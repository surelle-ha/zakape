<script setup lang="ts">
import { drawProjectFrame } from '~/utils/render'

const props = withDefaults(
  defineProps<{
    frameId?: string
    size?: number
    animate?: boolean
  }>(),
  { frameId: undefined, size: 144, animate: false },
)

const { project, activeFrameId, dirtyRevision } = useEditor()
const canvas = ref<HTMLCanvasElement | null>(null)
const animationFrameId = ref(activeFrameId.value)
let timer: number | null = null

const displayedFrame = computed(
  () => props.frameId ?? (props.animate ? animationFrameId.value : activeFrameId.value),
)
const scale = computed(() =>
  Math.max(1, Math.floor(props.size / Math.max(project.value.width, project.value.height))),
)

const redraw = () => {
  const element = canvas.value
  if (!element) return
  element.width = project.value.width * scale.value
  element.height = project.value.height * scale.value
  drawProjectFrame(element.getContext('2d')!, project.value, displayedFrame.value, scale.value)
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

watch([project, displayedFrame, dirtyRevision, scale], redraw, { deep: true, flush: 'post' })
watch(() => props.animate, schedule)
onMounted(() => {
  redraw()
  schedule()
})
onBeforeUnmount(() => timer && window.clearTimeout(timer))
</script>

<template>
  <canvas
    ref="canvas"
    class="preview-canvas"
    :style="{ width: `${project.width * scale}px`, height: `${project.height * scale}px` }"
    aria-label="Sprite preview"
  />
</template>
