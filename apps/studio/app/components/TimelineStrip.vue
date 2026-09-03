<script setup lang="ts">
import {
  ArrowLeft,
  ArrowRight,
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

const {
  project,
  activeFrameId,
  onionSkin,
  addFrame,
  deleteFrame,
  moveFrame,
  activeFrame,
  dirtyRevision,
} = useEditor()
const playing = useState<boolean>('preview-playing', () => true)
const frameTrack = ref<HTMLElement | null>(null)
const frameMenu = ref<{ frameId: string; x: number; y: number } | null>(null)
const draggingFrameId = ref<string | null>(null)
const dropTarget = ref<{ frameId: string; side: 'before' | 'after' } | null>(null)

const menuStyle = computed(() => ({
  left: `${frameMenu.value?.x ?? 0}px`,
  top: `${frameMenu.value?.y ?? 0}px`,
}))
const menuFrameIndex = computed(() =>
  frameMenu.value
    ? project.value.frames.findIndex((frame) => frame.id === frameMenu.value?.frameId)
    : -1,
)

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
    y: Math.max(8, Math.min(requestedY, window.innerHeight - 284)),
  }
}

const clearDrag = () => {
  draggingFrameId.value = null
  dropTarget.value = null
}

const startFrameDrag = (event: DragEvent, frameId: string) => {
  if (!event.dataTransfer) {
    event.preventDefault()
    return
  }
  draggingFrameId.value = frameId
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', frameId)
}

const updateDropTarget = (event: DragEvent, frameId: string) => {
  if (!draggingFrameId.value) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
  const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect()
  dropTarget.value = {
    frameId,
    side: event.clientX < bounds.left + bounds.width / 2 ? 'before' : 'after',
  }
}

const dropFrame = (event: DragEvent, targetFrameId: string) => {
  event.preventDefault()
  const sourceFrameId = draggingFrameId.value ?? event.dataTransfer?.getData('text/plain')
  const sourceIndex = project.value.frames.findIndex((frame) => frame.id === sourceFrameId)
  const targetIndex = project.value.frames.findIndex((frame) => frame.id === targetFrameId)
  if (sourceIndex >= 0 && targetIndex >= 0) {
    const side = dropTarget.value?.frameId === targetFrameId ? dropTarget.value.side : 'before'
    let destinationIndex = targetIndex + (side === 'after' ? 1 : 0)
    if (sourceIndex < destinationIndex) destinationIndex -= 1
    moveFrame(sourceFrameId!, destinationIndex)
  }
  clearDrag()
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

const moveMenuFrame = (offset: -1 | 1) => {
  if (!frameMenu.value || menuFrameIndex.value < 0) return
  moveFrame(frameMenu.value.frameId, menuFrameIndex.value + offset)
  frameMenu.value = null
}

const closeFrameMenu = () => (frameMenu.value = null)
const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    closeFrameMenu()
    return
  }
  const target = event.target as HTMLElement | null
  if (
    !(event.ctrlKey || event.metaKey) ||
    !['ArrowLeft', 'ArrowRight'].includes(event.key) ||
    target?.matches('input, textarea, [contenteditable="true"]')
  ) {
    return
  }
  const index = project.value.frames.findIndex((frame) => frame.id === activeFrameId.value)
  if (index < 0) return
  event.preventDefault()
  moveFrame(activeFrameId.value, index + (event.key === 'ArrowLeft' ? -1 : 1))
}

onMounted(() => {
  window.addEventListener('pointerdown', closeFrameMenu)
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', closeFrameMenu)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <section class="timeline" aria-label="Animation timeline" @contextmenu.prevent>
    <header class="timeline-header">
      <div class="section-kicker"><Layers3 :size="14" /> Timeline</div>
      <div class="timeline-controls">
        <button
          v-tooltip="{
            text: 'Scroll frames left',
            detail: 'Move the timeline viewport without changing the active frame.',
          }"
          type="button"
          class="icon-button"
          aria-label="Previous frames"
          @click="scrollFrames(-1)"
        >
          <ChevronLeft :size="15" />
        </button>
        <button
          v-tooltip="{
            text: playing ? 'Pause animation' : 'Play animation',
            detail: 'Preview the timeline using each frame delay.',
            shortcut: 'K',
          }"
          type="button"
          class="play-button"
          :aria-label="playing ? 'Pause preview' : 'Play preview'"
          @click="playing = !playing"
        >
          <Pause v-if="playing" :size="14" fill="currentColor" />
          <Play v-else :size="14" fill="currentColor" />
        </button>
        <button
          v-tooltip="{
            text: 'Scroll frames right',
            detail: 'Move the timeline viewport without changing the active frame.',
          }"
          type="button"
          class="icon-button"
          aria-label="Next frames"
          @click="scrollFrames(1)"
        >
          <ChevronRight :size="15" />
        </button>
        <label class="duration-field">
          <span class="control-label">Delay</span>
          <input
            :value="activeFrame?.duration ?? 120"
            type="number"
            min="40"
            max="2000"
            step="10"
            @change="updateDuration"
          />
          <span class="control-label">ms</span>
        </label>
        <label
          v-tooltip="{
            text: 'Onion skin',
            detail: 'Show the previous frame as a muted drawing guide.',
            shortcut: 'O',
          }"
          class="onion-toggle"
        >
          <input v-model="onionSkin" type="checkbox" />
          <span class="control-label">Onion skin</span>
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
          :class="{
            active: frame.id === activeFrameId,
            dragging: draggingFrameId === frame.id,
            'drop-before': dropTarget?.frameId === frame.id && dropTarget.side === 'before',
            'drop-after': dropTarget?.frameId === frame.id && dropTarget.side === 'after',
          }"
          :data-frame-id="frame.id"
          role="listitem"
          @dragover="updateDropTarget($event, frame.id)"
          @drop="dropFrame($event, frame.id)"
          @contextmenu="openFrameMenu($event, frame.id)"
        >
          <button
            v-tooltip="{
              text: `Frame ${index + 1}`,
              detail: 'Select this frame, or drag it to change the playback sequence.',
            }"
            type="button"
            class="frame-cell"
            draggable="true"
            :aria-label="`Frame ${index + 1}, ${frame.duration} milliseconds`"
            @dragstart="startFrameDrag($event, frame.id)"
            @dragend="clearDrag"
            @click="activeFrameId = frame.id"
          >
            <span class="frame-number">{{ String(index + 1).padStart(2, '0') }}</span>
            <span class="frame-preview"><PreviewCanvas :frame-id="frame.id" :size="48" /></span>
            <span class="frame-delay">{{ frame.duration }}ms</span>
          </button>
          <button
            v-tooltip="{
              text: 'Frame actions',
              detail: 'Insert a blank or copied frame, move it, or delete it.',
            }"
            type="button"
            class="frame-menu-trigger"
            :aria-label="`Frame ${index + 1} actions`"
            aria-haspopup="menu"
            :aria-expanded="frameMenu?.frameId === frame.id"
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
          role="menuitem"
          :disabled="menuFrameIndex <= 0"
          @click="moveMenuFrame(-1)"
        >
          <ArrowLeft :size="13" /><span>Move frame left</span><kbd>Ctrl ←</kbd>
        </button>
        <button
          type="button"
          role="menuitem"
          :disabled="menuFrameIndex < 0 || menuFrameIndex >= project.frames.length - 1"
          @click="moveMenuFrame(1)"
        >
          <ArrowRight :size="13" /><span>Move frame right</span><kbd>Ctrl →</kbd>
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
