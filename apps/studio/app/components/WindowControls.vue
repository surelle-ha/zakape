<script setup lang="ts">
import { Copy, Minus, Square, X } from '@lucide/vue'

const { isMaximized, minimize, toggleMaximize } = useAppWindow()
const { requestApplicationClose } = useCloseConfirmation()
</script>

<template>
  <div class="window-controls" data-tauri-drag-region-exclude>
    <button
      v-tooltip="{ text: 'Minimize window', placement: 'bottom' }"
      type="button"
      aria-label="Minimize window"
      @click="minimize()"
    >
      <span class="window-dot minimize-dot"><Minus :size="8" /></span>
    </button>
    <button
      v-tooltip="{
        text: isMaximized ? 'Restore window' : 'Maximize window',
        placement: 'bottom',
      }"
      type="button"
      :aria-label="isMaximized ? 'Restore window' : 'Maximize window'"
      @click="toggleMaximize()"
    >
      <span class="window-dot maximize-dot">
        <Copy v-if="isMaximized" :size="7" />
        <Square v-else :size="7" />
      </span>
    </button>
    <button
      v-tooltip="{
        text: 'Close Zakape',
        detail: 'Save open projects and ask for confirmation before exiting.',
        placement: 'bottom',
      }"
      type="button"
      aria-label="Close window"
      @click="requestApplicationClose"
    >
      <span class="window-dot close-dot"><X :size="8" /></span>
    </button>
  </div>
</template>
