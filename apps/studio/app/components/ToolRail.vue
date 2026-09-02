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
import { formatShortcut, toolDefinitions } from '~/utils/commands'

const {
  activeTool,
  primaryColor,
  secondaryColor,
  activeDrawingColor,
  resetColors,
  swapColors,
  selectDrawingColor,
} = useEditor()

const toolIcons: Record<ToolId, Component> = {
  pencil: Pencil,
  mirror: FlipHorizontal2,
  dither: Blend,
  eraser: Eraser,
  fill: PaintBucket,
  picker: Pipette,
  line: Minus,
  rectangle: Square,
  hand: Hand,
}

const tools = toolDefinitions.map((tool) => ({ ...tool, icon: toolIcons[tool.id] }))
</script>

<template>
  <nav class="tool-rail" aria-label="Drawing tools">
    <div class="tool-color-stack" aria-label="Drawing colors">
      <input
        v-model="primaryColor"
        v-tooltip="{
          text: 'Primary color',
          detail: 'Left-click drawing uses this color. Click the swatch to edit it.',
        }"
        class="tool-color primary"
        :class="{ active: activeDrawingColor === 'primary' }"
        type="color"
        aria-label="Primary drawing color"
        @pointerdown="selectDrawingColor('primary')"
      />
      <input
        v-model="secondaryColor"
        v-tooltip="{
          text: 'Secondary color',
          detail: 'Right-click drawing uses this color. Click the swatch to edit it.',
        }"
        class="tool-color secondary"
        :class="{ active: activeDrawingColor === 'secondary' }"
        type="color"
        aria-label="Secondary drawing color"
        @pointerdown="selectDrawingColor('secondary')"
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
        @click="swapColors"
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
        @click="resetColors"
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
