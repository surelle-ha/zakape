<script setup lang="ts">
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Ellipsis,
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
const frameMenu = ref<{ frameId: string; x: number; y: number } | null>(null)

const menuStyle = computed(() => ({
  left: `${frameMenu.value?.x ?? 0}px`,
  top: `${frameMenu.value?.y ?? 0}px`,
}))

const updateDuration = (event: Event) => {
  const value = Number((event.target as HTMLInputElement).value)
  if (activeFrame.value && Number.isFinite(value)) {
    activeFrame.value.duration = Math.max(40, Math.min(2000, value))
    dirtyRevision.value += 1
  }
}

const scrollFrames = (direction: number) =>
  frameTrack.value?.scrollBy({ left: direction * 180, behavior: 'smooth' })

const openFrameMenu = (event: MouseEvent, frameId: string) => {
  event.preventDefault()
  event.stopPropagation()
  const trigger = event.currentTarget as HTMLElement
  const bounds = trigger.getBoundingClientRect()
  const requestedX = event.type === 'contextmenu' ? event.clientX : bounds.right - 8
  const requestedY = event.type === 'contextmenu' ? event.clientY : bounds.top + 22
  frameMenu.value = {
    frameId,
    x: Math.max(8, Math.min(requestedX, window.innerWidth - 208)),
    y: Math.max(8, Math.min(requestedY, window.innerHeight - 228)),
  }
}

const addAdjacent = (duplicate: boolean, side: 'left' | 'right') => {
  if (!frameMenu.value) return
  const sourceId = frameMenu.value.frameId
  const index = project.value.frames.findIndex((frame) => frame.id === sourceId)
  if (index < 0) return
  addFrame(duplicate, side === 'left' ? index : index + 1, sourceId)
  frameMenu.value = null
}

const removeFrame = () => {
  if (!frameMenu.value) return
  deleteFrame(frameMenu.value.frameId)
  frameMenu.value = null
}

const closeFrameMenu = () => (frameMenu.value = null)
const onEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape') closeFrameMenu()
}

onMounted(() => {
  window.addEventListener('pointerdown', closeFrameMenu)
  window.addEventListener('keydown', onEscape)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', closeFrameMenu)
  window.removeEventListener('keydown', onEscape)
})
</script>

<template>
  <section class="timeline" aria-label="Animation timeline" @contextmenu.prevent>
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
        <label class="onion-toggle">
          <input v-model="onionSkin" type="checkbox" />
          <span>Onion silhouette</span>
        </label>
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
        <article
          v-for="(frame, index) in project.frames"
          :key="frame.id"
          class="frame-item"
          :class="{ active: frame.id === activeFrameId }"
          role="listitem"
          @contextmenu="openFrameMenu($event, frame.id)"
        >
          <button
            type="button"
            class="frame-cell"
            :aria-label="`Frame ${index + 1}, ${frame.duration} milliseconds`"
            @click="activeFrameId = frame.id"
          >
            <span class="frame-number">{{ String(index + 1).padStart(2, '0') }}</span>
            <span class="frame-preview"><PreviewCanvas :frame-id="frame.id" :size="48" /></span>
            <span class="frame-delay">{{ frame.duration }}ms</span>
          </button>
          <button
            type="button"
            class="frame-menu-trigger"
            :aria-label="`Frame ${index + 1} actions`"
            aria-haspopup="menu"
            :aria-expanded="frameMenu?.frameId === frame.id"
            title="Blank, copy, or delete frame"
            @click="openFrameMenu($event, frame.id)"
          >
            <Ellipsis :size="14" />
          </button>
        </article>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="frameMenu"
        class="panel-context-menu"
        :style="menuStyle"
        role="menu"
        aria-label="Frame actions"
        @pointerdown.stop
        @contextmenu.prevent
      >
        <button type="button" role="menuitem" @click="addAdjacent(false, 'left')">
          <Plus :size="13" /><span>Blank frame to left</span><kbd>←</kbd>
        </button>
        <button type="button" role="menuitem" @click="addAdjacent(false, 'right')">
          <Plus :size="13" /><span>Blank frame to right</span><kbd>→</kbd>
        </button>
        <span class="menu-separator" role="separator" />
        <button type="button" role="menuitem" @click="addAdjacent(true, 'left')">
          <Copy :size="13" /><span>Copy frame to left</span><kbd>←</kbd>
        </button>
        <button type="button" role="menuitem" @click="addAdjacent(true, 'right')">
          <Copy :size="13" /><span>Copy frame to right</span><kbd>→</kbd>
        </button>
        <span class="menu-separator" role="separator" />
        <button
          type="button"
          class="danger"
          role="menuitem"
          :disabled="project.frames.length === 1"
          @click="removeFrame"
        >
          <Trash2 :size="13" /><span>Delete frame</span><kbd>Del</kbd>
        </button>
      </div>
    </Teleport>
  </section>
</template>
