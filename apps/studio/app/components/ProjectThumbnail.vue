<script setup lang="ts">
import type { WorkspaceProjectPreview } from '~/composables/useProjectRepository'

const props = defineProps<{
  preview?: WorkspaceProjectPreview
}>()

const canvas = ref<HTMLCanvasElement | null>(null)

const draw = () => {
  const element = canvas.value
  if (!element) return
  const context = element.getContext('2d')
  if (!context) return

  const size = element.width
  context.clearRect(0, 0, size, size)
  const checkerSize = 8
  for (let y = 0; y < size; y += checkerSize) {
    for (let x = 0; x < size; x += checkerSize) {
      context.fillStyle = (x / checkerSize + y / checkerSize) % 2 ? '#1d1929' : '#292239'
      context.fillRect(x, y, checkerSize, checkerSize)
    }
  }

  const preview = props.preview
  if (!preview) return
  const padding = 8
  const scale = Math.min(
    (size - padding * 2) / preview.width,
    (size - padding * 2) / preview.height,
  )
  const drawWidth = preview.width * scale
  const drawHeight = preview.height * scale
  const originX = (size - drawWidth) / 2
  const originY = (size - drawHeight) / 2
  context.imageSmoothingEnabled = false
  preview.pixels.forEach((pixel, index) => {
    if (!pixel) return
    const x = index % preview.width
    const y = Math.floor(index / preview.width)
    context.fillStyle = pixel
    context.fillRect(originX + x * scale, originY + y * scale, scale + 0.25, scale + 0.25)
  })
}

watch(() => props.preview, draw, { deep: true, flush: 'post' })
onMounted(draw)
</script>

<template>
  <canvas ref="canvas" width="96" height="96" aria-hidden="true" />
</template>
