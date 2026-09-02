<script setup lang="ts">
import { Copy, Minus, Square, X } from '@lucide/vue'

const { isMaximized, minimize, toggleMaximize } = useAppWindow()
const { requestApplicationClose } = useCloseConfirmation()
</script>

<template>
  <div class="window-controls" data-tauri-drag-region-exclude>
    <button type="button" aria-label="Minimize window" title="Minimize" @click="minimize()">
      <span class="window-dot minimize-dot"><Minus :size="8" /></span>
    </button>
    <button
      type="button"
      :aria-label="isMaximized ? 'Restore window' : 'Maximize window'"
      :title="isMaximized ? 'Restore' : 'Maximize'"
      @click="toggleMaximize()"
    >
      <span class="window-dot maximize-dot">
        <Copy v-if="isMaximized" :size="7" />
        <Square v-else :size="7" />
      </span>
    </button>
    <button type="button" aria-label="Close window" title="Close" @click="requestApplicationClose">
      <span class="window-dot close-dot"><X :size="8" /></span>
    </button>
  </div>
</template>
