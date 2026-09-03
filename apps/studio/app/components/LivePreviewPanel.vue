<script setup lang="ts">
import { Pause, Play } from '@lucide/vue'

const { project, activeFrame, dirtyRevision } = useEditor()
const playing = useState<boolean>('preview-playing', () => true)

const updateDuration = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value)
  if (!activeFrame.value || !Number.isFinite(value)) return
  activeFrame.value.duration = Math.max(40, Math.min(2000, Math.round(value)))
  dirtyRevision.value += 1
}
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
      <span>{{ project.width }} × {{ project.height }} · {{ project.frames.length }}f</span>
      <label class="preview-delay">
        <span>Delay</span>
        <input
          :value="activeFrame?.duration ?? 120"
          type="number"
          min="40"
          max="2000"
          step="10"
          aria-label="Active frame delay in milliseconds"
          @change="updateDuration"
        />
        <span>ms</span>
      </label>
    </footer>
  </section>
</template>
