<script setup lang="ts">
import {
  ArrowDownUp,
  Blend,
  Eraser,
  FlipHorizontal2,
  Hand,
  Minus,
  PaintBucket,
  Pencil,
  Pipette,
  RotateCcw,
  Square,
} from '@lucide/vue'
import type { Component } from 'vue'
import type { ToolId } from '~/types/editor'

const {
  activeTool,
  primaryColor,
  secondaryColor,
  activeDrawingColor,
  resetColors,
  swapColors,
  selectDrawingColor,
} = useEditor()

const tools: Array<{ id: ToolId; label: string; shortcut: string; icon: Component }> = [
  { id: 'pencil', label: 'Pencil', shortcut: 'P', icon: Pencil },
  { id: 'mirror', label: 'Mirror pencil', shortcut: 'M', icon: FlipHorizontal2 },
  { id: 'dither', label: 'Dither pencil', shortcut: 'T', icon: Blend },
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
    <div class="tool-color-stack" aria-label="Drawing colors">
      <input
        v-model="primaryColor"
        class="tool-color primary"
        :class="{ active: activeDrawingColor === 'primary' }"
        type="color"
        aria-label="Primary drawing color"
        title="Select primary drawing color"
        @pointerdown="selectDrawingColor('primary')"
      />
      <input
        v-model="secondaryColor"
        class="tool-color secondary"
        :class="{ active: activeDrawingColor === 'secondary' }"
        type="color"
        aria-label="Secondary drawing color"
        title="Select secondary drawing color"
        @pointerdown="selectDrawingColor('secondary')"
      />
      <button
        type="button"
        class="color-swap"
        aria-label="Swap primary and secondary colors"
        title="Swap colors · X"
        @click="swapColors"
      >
        <ArrowDownUp :size="10" />
      </button>
      <button
        type="button"
        class="color-reset"
        aria-label="Reset drawing colors"
        title="Reset colors · D"
        @click="resetColors"
      >
        <RotateCcw :size="9" />
      </button>
    </div>
    <span class="tool-rail-separator" />
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
