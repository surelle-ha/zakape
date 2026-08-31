<script setup lang="ts">
import {
  Check,
  ChevronDown,
  Download,
  FileUp,
  Grid3X3,
  Minus,
  Plus,
  Redo2,
  Save,
  Sparkles,
  Undo2,
} from '@lucide/vue'
import type { SpriteProject, ToolId } from '~/types/editor'

const {
  project,
  activeTool,
  activeLayer,
  brushSize,
  zoom,
  showGrid,
  dirtyRevision,
  lastAction,
  canUndo,
  canRedo,
  undo,
  redo,
  replaceProject,
  renameProject,
} = useEditor()
const { persistenceState, loadLatest, saveProject } = useProjectRepository()
const exportOpen = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const editingName = ref(false)
const nameDraft = ref(project.value.name)
const initialized = ref(false)
let autosaveTimer: number | null = null
let temporaryTool: ToolId | null = null

const saveNow = async () => {
  await saveProject(project.value)
  window.setTimeout(() => {
    if (persistenceState.value === 'saved') persistenceState.value = 'idle'
  }, 1800)
}

const commitName = () => {
  renameProject(nameDraft.value)
  nameDraft.value = project.value.name
  editingName.value = false
}

const cancelName = () => {
  editingName.value = false
  nameDraft.value = project.value.name
}

const openProjectFile = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const parsed = JSON.parse(await file.text()) as SpriteProject
    if (
      parsed.version !== 1 ||
      !Number.isInteger(parsed.width) ||
      !Number.isInteger(parsed.height) ||
      !Array.isArray(parsed.frames) ||
      !Array.isArray(parsed.layers)
    ) {
      throw new Error('Not a supported Zakape project.')
    }
    replaceProject(parsed, `Opened ${file.name}`)
    nameDraft.value = parsed.name
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'The project could not be opened.')
  } finally {
    ;(event.target as HTMLInputElement).value = ''
  }
}

const keydown = (event: KeyboardEvent) => {
  const target = event.target as HTMLElement | null
  if (target?.matches('input, textarea, [contenteditable="true"]')) return
  const key = event.key.toLowerCase()
  if ((event.ctrlKey || event.metaKey) && key === 'z') {
    event.preventDefault()
    if (event.shiftKey) redo()
    else undo()
    return
  }
  if ((event.ctrlKey || event.metaKey) && key === 'y') {
    event.preventDefault()
    redo()
    return
  }
  const shortcuts: Partial<Record<string, ToolId>> = {
    p: 'pencil',
    e: 'eraser',
    f: 'fill',
    i: 'picker',
    l: 'line',
    r: 'rectangle',
    h: 'hand',
  }
  if (shortcuts[key]) activeTool.value = shortcuts[key]!
  if (event.code === 'Space' && !temporaryTool) {
    event.preventDefault()
    temporaryTool = activeTool.value
    activeTool.value = 'hand'
  }
  if (key === '[') brushSize.value = Math.max(1, brushSize.value - 1)
  if (key === ']') brushSize.value = Math.min(4, brushSize.value + 1)
  if (key === '=' || key === '+') zoom.value = Math.min(24, zoom.value + 1)
  if (key === '-') zoom.value = Math.max(4, zoom.value - 1)
}

const keyup = (event: KeyboardEvent) => {
  if (event.code === 'Space' && temporaryTool) {
    activeTool.value = temporaryTool
    temporaryTool = null
  }
}

watch(dirtyRevision, () => {
  if (!initialized.value) return
  if (autosaveTimer) window.clearTimeout(autosaveTimer)
  autosaveTimer = window.setTimeout(saveNow, 700)
})

onMounted(async () => {
  const latest = await loadLatest()
  if (latest) {
    replaceProject(latest, 'Restored local project')
    nameDraft.value = latest.name
  }
  initialized.value = true
  window.addEventListener('keydown', keydown)
  window.addEventListener('keyup', keyup)
})

onBeforeUnmount(() => {
  if (autosaveTimer) window.clearTimeout(autosaveTimer)
  window.removeEventListener('keydown', keydown)
  window.removeEventListener('keyup', keyup)
})
</script>

<template>
  <main class="studio-shell" data-testid="app-shell" @click="exportOpen = false">
    <header class="app-bar">
      <div class="brand-lockup">
        <span class="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
        <span><strong>ZAKAPE</strong><small>PIXEL WORKBENCH</small></span>
      </div>

      <div class="project-heading">
        <input
          v-if="editingName"
          v-model="nameDraft"
          class="project-name-input"
          maxlength="64"
          aria-label="Project name"
          autofocus
          @blur="commitName"
          @keydown.enter.prevent="commitName"
          @keydown.escape.prevent="cancelName"
        />
        <button
          v-else
          type="button"
          class="project-name"
          title="Rename project"
          @dblclick="editingName = true"
        >
          {{ project.name }}
        </button>
        <span class="project-dimensions">{{ project.width }}×{{ project.height }}</span>
      </div>

      <div class="save-state" aria-live="polite">
        <span :class="['save-state-dot', persistenceState]" />
        {{
          persistenceState === 'loading'
            ? 'Restoring'
            : persistenceState === 'saved'
              ? 'Saved locally'
              : persistenceState === 'error'
                ? 'Save issue'
                : lastAction
        }}
      </div>

      <div class="app-actions">
        <button
          type="button"
          class="icon-button"
          :disabled="!canUndo"
          aria-label="Undo"
          title="Undo · Ctrl Z"
          @click="undo"
        >
          <Undo2 :size="16" />
        </button>
        <button
          type="button"
          class="icon-button"
          :disabled="!canRedo"
          aria-label="Redo"
          title="Redo · Ctrl Shift Z"
          @click="redo"
        >
          <Redo2 :size="16" />
        </button>
        <span class="action-divider" />
        <button
          type="button"
          class="icon-button"
          :class="{ active: showGrid }"
          :aria-pressed="showGrid"
          aria-label="Toggle grid"
          title="Toggle grid"
          @click="showGrid = !showGrid"
        >
          <Grid3X3 :size="16" />
        </button>
        <button
          type="button"
          class="icon-button"
          aria-label="Open project"
          title="Open .zakape project"
          @click="fileInput?.click()"
        >
          <FileUp :size="16" />
        </button>
        <button
          type="button"
          class="icon-button"
          aria-label="Save project locally"
          title="Save project"
          @click="saveNow"
        >
          <Check v-if="persistenceState === 'saved'" :size="16" />
          <Save v-else :size="16" />
        </button>
        <div class="export-anchor" @click.stop>
          <button
            type="button"
            class="export-button"
            aria-haspopup="menu"
            :aria-expanded="exportOpen"
            @click="exportOpen = !exportOpen"
          >
            <Download :size="15" /> Export <ChevronDown :size="13" />
          </button>
          <ExportMenu v-if="exportOpen" @close="exportOpen = false" />
        </div>
      </div>
      <input
        ref="fileInput"
        class="sr-only"
        type="file"
        accept=".zakape,application/json"
        @change="openProjectFile"
      />
    </header>

    <div class="workspace-grid">
      <ToolRail />

      <section class="canvas-workspace" aria-label="Canvas workspace">
        <header class="canvas-toolbar">
          <div class="tool-context">
            <span class="tool-chip"
              ><Sparkles v-if="activeTool === 'picker'" :size="13" />{{ activeTool }}</span
            >
            <label v-if="activeTool === 'pencil' || activeTool === 'eraser'" class="brush-control">
              <span>Size</span>
              <button
                v-for="size in 4"
                :key="size"
                type="button"
                :class="{ active: brushSize === size }"
                :aria-label="`${size} pixel brush`"
                @click="brushSize = size"
              >
                {{ size }}
              </button>
            </label>
            <span class="context-hint">Alt samples color · Space pans · right-click erases</span>
          </div>
          <div class="zoom-control">
            <button type="button" aria-label="Zoom out" @click="zoom = Math.max(4, zoom - 1)">
              <Minus :size="14" />
            </button>
            <input v-model.number="zoom" type="range" min="4" max="24" aria-label="Canvas zoom" />
            <button type="button" aria-label="Zoom in" @click="zoom = Math.min(24, zoom + 1)">
              <Plus :size="14" />
            </button>
            <span>{{ Math.round((zoom * 100) / 14) }}%</span>
          </div>
        </header>
        <div class="canvas-scroll">
          <PixelCanvas />
        </div>
        <footer class="canvas-status">
          <span><i class="accent-dot" /> Active cel: {{ activeLayer?.name }}</span>
          <span>RGBA · sRGB</span>
        </footer>
      </section>

      <InspectorPanel />
    </div>

    <TimelineStrip />
  </main>
</template>
