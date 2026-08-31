<script setup lang="ts">
import { Eraser, Hand, Minus, PaintBucket, Pencil, Pipette, Square } from '@lucide/vue'
import type { Component } from 'vue'
import type { ToolId } from '~/types/editor'

const { activeTool } = useEditor()

const tools: Array<{ id: ToolId; label: string; shortcut: string; icon: Component }> = [
  { id: 'pencil', label: 'Pencil', shortcut: 'P', icon: Pencil },
  { id: 'eraser', label: 'Eraser', shortcut: 'E', icon: Eraser },
  { id: 'fill', label: 'Fill', shortcut: 'F', icon: PaintBucket },
  { id: 'picker', label: 'Eyedropper', shortcut: 'I', icon: Pipette },
  { id: 'line', label: 'Line', shortcut: 'L', icon: Minus },
  { id: 'rectangle', label: 'Rectangle', shortcut: 'R', icon: Square },
  { id: 'hand', label: 'Hand', shortcut: 'H', icon: Hand },
]
</script>

<template>
  <nav class="tool-rail" aria-label="Drawing tools">
    <button
      v-for="tool in tools"
      :key="tool.id"
      type="button"
      class="tool-button"
      :class="{ active: activeTool === tool.id }"
      :aria-pressed="activeTool === tool.id"
      :aria-label="`${tool.label} (${tool.shortcut})`"
      :title="`${tool.label} · ${tool.shortcut}`"
      :data-testid="`tool-${tool.id}`"
      @click="activeTool = tool.id"
    >
      <component :is="tool.icon" :size="18" :stroke-width="1.8" />
      <span>{{ tool.shortcut }}</span>
    </button>
  </nav>
</template>
