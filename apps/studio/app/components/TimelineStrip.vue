<script setup lang="ts">
import {
  ChevronLeft,
  ChevronRight,
  CopyPlus,
  Layers3,
  Pause,
  Play,
  Plus,
  Trash2,
} from '@lucide/vue'

const { project, activeFrameId, onionSkin, addFrame, deleteFrame, activeFrame, dirtyRevision } =
  useEditor()
const playing = useState<boolean>('preview-playing', () => true)
const frameTrack = ref<HTMLElement | null>(null)

const updateDuration = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value)
  if (activeFrame.value && Number.isFinite(value)) {
    activeFrame.value.duration = Math.max(40, Math.min(2000, value))
    dirtyRevision.value += 1
  }
}

const scrollFrames = (direction: number) =>
  frameTrack.value?.scrollBy({ left: direction * 180, behavior: 'smooth' })
</script>

<template>
  <section class="timeline" aria-label="Animation timeline">
    <header class="timeline-header">
      <div class="section-kicker"><Layers3 :size="14" /> Timeline</div>
      <div class="timeline-controls">
        <button
          type="button"
          class="icon-button"
          aria-label="Previous frames"
          @click="scrollFrames(-1)"
        >
          <ChevronLeft :size="15" />
        </button>
        <button
          type="button"
          class="play-button"
          :aria-label="playing ? 'Pause preview' : 'Play preview'"
          @click="playing = !playing"
        >
          <Pause v-if="playing" :size="14" fill="currentColor" />
          <Play v-else :size="14" fill="currentColor" />
        </button>
        <button type="button" class="icon-button" aria-label="Next frames" @click="scrollFrames(1)">
          <ChevronRight :size="15" />
        </button>
        <label class="duration-field">
          <span>Delay</span>
          <input
            :value="activeFrame?.duration ?? 120"
            type="number"
            min="40"
            max="2000"
            step="10"
            @change="updateDuration"
          />
          <span>ms</span>
        </label>
        <button
          type="button"
          class="text-toggle"
          :class="{ active: onionSkin }"
          :aria-pressed="onionSkin"
          @click="onionSkin = !onionSkin"
        >
          Onion
        </button>
      </div>
    </header>

    <div class="timeline-body">
      <div class="layer-stub">
        <span class="layer-dot" />
        <div>
          <strong>All layers</strong><small>{{ project.layers.length }} visible stack</small>
        </div>
      </div>
      <div ref="frameTrack" class="frame-track" role="list" aria-label="Frames">
        <button
          v-for="(frame, index) in project.frames"
          :key="frame.id"
          type="button"
          class="frame-cell"
          :class="{ active: frame.id === activeFrameId }"
          role="listitem"
          :aria-label="`Frame ${index + 1}, ${frame.duration} milliseconds`"
          @click="activeFrameId = frame.id"
        >
          <span class="frame-number">{{ String(index + 1).padStart(2, '0') }}</span>
          <span class="frame-preview"><PreviewCanvas :frame-id="frame.id" :size="58" /></span>
          <span class="frame-delay">{{ frame.duration }}ms</span>
        </button>
        <button
          type="button"
          class="frame-add"
          aria-label="Add empty frame"
          @click="addFrame(false)"
        >
          <Plus :size="18" /><span>Add frame</span>
        </button>
      </div>
      <div class="timeline-actions">
        <button
          type="button"
          class="icon-button"
          title="Duplicate frame"
          aria-label="Duplicate frame"
          @click="addFrame(true)"
        >
          <CopyPlus :size="16" />
        </button>
        <button
          type="button"
          class="icon-button danger"
          title="Delete frame"
          aria-label="Delete frame"
          :disabled="project.frames.length === 1"
          @click="deleteFrame()"
        >
          <Trash2 :size="16" />
        </button>
      </div>
    </div>
  </section>
</template>
