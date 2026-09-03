<script setup lang="ts">
import { Pause, Play } from '@lucide/vue'

const { project } = useEditor()
const playing = useState<boolean>('preview-playing', () => true)
</script>

<template>
  <section class="preview-card workspace-preview-card" aria-label="Live preview">
    <header>
      <div><span class="status-dot" /> Live preview</div>
      <button
        v-tooltip="{
          text: playing ? 'Pause preview' : 'Play preview',
          detail: 'Toggle animation playback without changing frame timing.',
          shortcut: 'K',
        }"
        type="button"
        class="micro-button"
        :aria-label="playing ? 'Pause live preview' : 'Play live preview'"
        @click="playing = !playing"
      >
        <Pause v-if="playing" :size="10" fill="currentColor" aria-hidden="true" />
        <Play v-else :size="10" fill="currentColor" aria-hidden="true" />
        <span>{{ playing ? 'Pause' : 'Play' }}</span>
      </button>
    </header>
    <div class="preview-stage">
      <PreviewCanvas :size="138" :animate="playing" />
    </div>
    <footer>
      <span>{{ project.width }} × {{ project.height }}</span>
      <span>{{ project.frames.length }} frame{{ project.frames.length === 1 ? '' : 's' }}</span>
      <span>{{ Math.round(1000 / (project.frames[0]?.duration ?? 120)) }} fps</span>
    </footer>
  </section>
</template>
