<script setup lang="ts">
import {
  ArrowDownUp,
  Blend,
  BoxSelect,
  Eraser,
  FlipHorizontal2,
  Hand,
  LassoSelect,
  Minus,
  PaintBucket,
  Pencil,
  Pipette,
  RotateCcw,
  Square,
} from '@lucide/vue'
import type { Component } from 'vue'
import type { ToolId } from '~/types/editor'
import { formatShortcut, toolDefinitions } from '~/utils/commands'

const {
  project,
  activeTool,
  primaryColor,
  secondaryColor,
  activeDrawingColor,
  resetColors,
  swapColors,
  selectDrawingColor,
} = useEditor()
const colorPicker = ref<'primary' | 'secondary' | null>(null)
const swapDrawingColors = () => {
  colorPicker.value = null
  swapColors()
}
const resetDrawingColors = () => {
  colorPicker.value = null
  resetColors()
}

const toolIcons: Record<ToolId, Component> = {
  pencil: Pencil,
  mirror: FlipHorizontal2,
  dither: Blend,
  eraser: Eraser,
  fill: PaintBucket,
  picker: Pipette,
  line: Minus,
  rectangle: Square,
  'select-rect': BoxSelect,
  'select-lasso': LassoSelect,
  hand: Hand,
}

const tools = toolDefinitions.map((tool) => ({ ...tool, icon: toolIcons[tool.id] }))
</script>

<template>
  <nav class="tool-rail" aria-label="Drawing tools">
    <div class="tool-color-stack" aria-label="Drawing colors">
      <ColorPicker
        v-model="primaryColor"
        label="Primary color"
        swatch-class="primary"
        :palette="project.palette"
        :open="colorPicker === 'primary'"
        :active="activeDrawingColor === 'primary'"
        @select="selectDrawingColor('primary')"
        @toggle="colorPicker = colorPicker === 'primary' ? null : 'primary'"
        @close="colorPicker = null"
      />
      <ColorPicker
        v-model="secondaryColor"
        label="Secondary color"
        swatch-class="secondary"
        :palette="project.palette"
        :open="colorPicker === 'secondary'"
        :active="activeDrawingColor === 'secondary'"
        @select="selectDrawingColor('secondary')"
        @toggle="colorPicker = colorPicker === 'secondary' ? null : 'secondary'"
        @close="colorPicker = null"
      />
      <button
        v-tooltip="{
          text: 'Swap colors',
          detail: 'Exchange the primary and secondary drawing colors.',
          shortcut: 'X',
        }"
        type="button"
        class="color-swap"
        aria-label="Swap primary and secondary colors"
        @click="swapDrawingColors"
      >
        <ArrowDownUp :size="10" />
      </button>
      <button
        v-tooltip="{
          text: 'Reset colors',
          detail: 'Restore the default black and white drawing colors.',
          shortcut: 'D',
        }"
        type="button"
        class="color-reset"
        aria-label="Reset drawing colors"
        @click="resetDrawingColors"
      >
        <RotateCcw :size="9" />
      </button>
    </div>
    <span class="tool-rail-separator" />
    <button
      v-for="tool in tools"
      :key="tool.id"
      v-tooltip="{
        text: tool.label,
        detail: tool.description,
        shortcut: formatShortcut(tool.shortcut),
        placement: 'right',
      }"
      type="button"
      class="tool-button"
      :class="{ active: activeTool === tool.id }"
      :aria-pressed="activeTool === tool.id"
      :aria-label="`${tool.label} (${tool.shortcut})`"
      :data-testid="`tool-${tool.id}`"
      @click="activeTool = tool.id"
    >
      <component :is="tool.icon" :size="18" :stroke-width="1.8" />
      <span>{{ formatShortcut(tool.shortcut) }}</span>
    </button>
  </nav>
</template>
