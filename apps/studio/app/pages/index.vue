<script setup lang="ts">
import {
  Check,
  ChevronDown,
  Download,
  FileUp,
  Grid2X2,
  Grid3X3,
  Minus,
  Plus,
  Redo2,
  Save,
  Sparkles,
  Undo2,
} from '@lucide/vue'
import type { CanvasBackground, ColorMode, ToolId } from '~/types/editor'
import { cloneProject, createBlankProject, parseSpriteProject } from '~/utils/project'

const {
  documents,
  activeDocumentId,
  isPlaceholder,
  project,
  activeTool,
  activeLayer,
  brushSize,
  zoom,
  showGrid,
  showTransparency,
  dirtyRevision,
  lastAction,
  canUndo,
  canRedo,
  undo,
  redo,
  replaceProject,
  activateDocument,
  closeDocument,
  swapColors,
  resetColors,
  renameProject,
} = useEditor()
const { discardProposal } = useAiAssistant()
const {
  persistenceState,
  recentProjects,
  workspaceDirectory,
  refreshProjects,
  loadProject,
  saveProject,
} = useProjectRepository()
const { launcherOpen, launcherView, showHome, showEditor, requestNew } = useWorkspace()
const { closeRequest, requestProjectClose, requestApplicationClose, cancelClose } =
  useCloseConfirmation()
const appWindow = useAppWindow()
const exportOpen = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const editingName = ref(false)
const nameDraft = ref(project.value.name)
const initialized = ref(false)
const closeBusy = ref(false)
const closeError = ref('')
const closingDocument = computed(() => {
  const request = closeRequest.value
  if (request?.kind !== 'project') return null
  return documents.value.find((document) => document.id === request.documentId) ?? null
})
const openProjectCount = computed(
  () => documents.value.filter((document) => !document.placeholder).length,
)
let autosaveTimer: number | null = null
let temporaryTool: ToolId | null = null
let unlistenWindowClose: (() => void) | null = null
const toolHint = computed(() => {
  if (activeTool.value === 'mirror') return 'Vertical mirror · Ctrl horizontal · Shift both axes'
  if (activeTool.value === 'dither') return 'Alternates primary and secondary colors'
  return 'Alt samples color · Space pans · Ctrl scroll zooms'
})

const saveNow = async () => {
  if (isPlaceholder.value) return
  await saveProject(cloneProject(project.value))
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
    if (file.size > 32 * 1024 * 1024) {
      throw new Error("That project exceeds Zakape's 32 MB project limit.")
    }
    const parsed = parseSpriteProject(JSON.parse(await file.text()))
    replaceProject(parsed, `Opened ${file.name}`)
    nameDraft.value = parsed.name
    showEditor()
    await saveProject(parsed)
  } catch (error) {
    window.alert(error instanceof Error ? error.message : 'The project could not be opened.')
  } finally {
    ;(event.target as HTMLInputElement).value = ''
  }
}

const createProject = async (spec: {
  name: string
  width: number
  height: number
  colorMode: ColorMode
  background: CanvasBackground
}) => {
  const nextProject = createBlankProject(
    spec.width,
    spec.height,
    spec.name,
    spec.colorMode,
    spec.background,
  )
  replaceProject(nextProject, `Created ${spec.width}×${spec.height} sprite`)
  nameDraft.value = nextProject.name
  showEditor()
  await saveProject(nextProject)
}

const openRecentProject = async (projectId: string) => {
  if (documents.value.some((document) => document.id === projectId)) {
    await switchDocument(projectId)
    showEditor()
    return
  }
  const savedProject = await loadProject(projectId)
  if (!savedProject) return
  replaceProject(savedProject, `Opened ${savedProject.name}`)
  nameDraft.value = savedProject.name
  showEditor()
}

const switchDocument = async (documentId: string) => {
  if (documentId === activeDocumentId.value) return
  if (autosaveTimer) window.clearTimeout(autosaveTimer)
  if (!isPlaceholder.value) await saveProject(cloneProject(project.value))
  discardProposal()
  if (!activateDocument(documentId)) return
  nameDraft.value = project.value.name
  editingName.value = false
}

const performCloseSpriteDocument = async (documentId: string) => {
  const document = documents.value.find((item) => item.id === documentId)
  if (document && !document.placeholder) {
    const saved = await saveProject(cloneProject(document.project))
    if (!saved) throw new Error('Zakape could not save this project. Keep it open and try again.')
  }
  const launcherNeeded = closeDocument(documentId)
  discardProposal()
  nameDraft.value = project.value.name
  editingName.value = false
  if (launcherNeeded) showHome()
}

const closeSpriteDocument = (documentId: string) => requestProjectClose(documentId)

const confirmClose = async () => {
  const request = closeRequest.value
  if (!request || closeBusy.value) return
  closeBusy.value = true
  closeError.value = ''
  try {
    if (request.kind === 'project') {
      await performCloseSpriteDocument(request.documentId)
      cancelClose()
      return
    }

    if (autosaveTimer) {
      window.clearTimeout(autosaveTimer)
      autosaveTimer = null
    }
    for (const document of documents.value.filter((item) => !item.placeholder)) {
      const saved = await saveProject(cloneProject(document.project))
      if (!saved) {
        throw new Error(
          `Zakape could not save “${document.project.name}”. Keep working and try again.`,
        )
      }
    }
    cancelClose()
    await nextTick()
    await appWindow.closeApproved()
  } catch (error) {
    closeError.value = error instanceof Error ? error.message : 'Zakape could not complete closing.'
  } finally {
    closeBusy.value = false
  }
}

const keydown = (event: KeyboardEvent) => {
  const target = event.target
  const editingText =
    target instanceof HTMLElement && target.matches('input, textarea, [contenteditable="true"]')
  const key = event.key.toLowerCase()
  const commandKey = event.ctrlKey || event.metaKey
  if (editingText) {
    if (!commandKey || ['a', 'c', 'v', 'x', 'y', 'z'].includes(key)) return
    if (['n', 'o', 's'].includes(key)) return
    event.preventDefault()
    return
  }
  if (['f5', 'f6', 'f11', 'f12'].includes(key) || (event.altKey && key.startsWith('arrow'))) {
    event.preventDefault()
    return
  }
  if (commandKey && key === 'z') {
    event.preventDefault()
    if (event.shiftKey) redo()
    else undo()
    return
  }
  if (commandKey && key === 'y') {
    event.preventDefault()
    redo()
    return
  }
  if (commandKey && event.key === 'Tab') {
    const openDocuments = documents.value.filter((document) => !document.placeholder)
    if (openDocuments.length > 1) {
      event.preventDefault()
      const index = openDocuments.findIndex((document) => document.id === activeDocumentId.value)
      const offset = event.shiftKey ? -1 : 1
      const next = openDocuments[(index + offset + openDocuments.length) % openDocuments.length]
      if (next) void switchDocument(next.id)
    }
    return
  }
  if (commandKey && key === 'w') {
    event.preventDefault()
    if (!isPlaceholder.value) void closeSpriteDocument(activeDocumentId.value)
    return
  }
  if (commandKey && ['n', 'o', 's'].includes(key)) return
  if (commandKey && (key === '=' || key === '+')) {
    event.preventDefault()
    zoom.value = Math.min(24, zoom.value + 1)
    return
  }
  if (commandKey && key === '-') {
    event.preventDefault()
    zoom.value = Math.max(4, zoom.value - 1)
    return
  }
  if (commandKey) {
    event.preventDefault()
    return
  }
  const shortcuts: Partial<Record<string, ToolId>> = {
    p: 'pencil',
    m: 'mirror',
    t: 'dither',
    e: 'eraser',
    f: 'fill',
    i: 'picker',
    l: 'line',
    r: 'rectangle',
    h: 'hand',
  }
  if (shortcuts[key]) activeTool.value = shortcuts[key]!
  if (key === 'x') swapColors()
  if (key === 'd') resetColors()
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

const onCanvasWheel = async (event: WheelEvent) => {
  if (!event.ctrlKey && !event.metaKey) return
  event.preventDefault()
  const host = event.currentTarget as HTMLElement
  const bounds = host.getBoundingClientRect()
  const focusX = event.clientX - bounds.left
  const focusY = event.clientY - bounds.top
  const oldZoom = zoom.value
  const nextZoom = Math.max(4, Math.min(24, oldZoom + (event.deltaY < 0 ? 1 : -1)))
  if (nextZoom === oldZoom) return
  const contentX = host.scrollLeft + focusX
  const contentY = host.scrollTop + focusY
  zoom.value = nextZoom
  await nextTick()
  const scale = nextZoom / oldZoom
  host.scrollLeft = contentX * scale - focusX
  host.scrollTop = contentY * scale - focusY
}

const keyup = (event: KeyboardEvent) => {
  if (event.code === 'Space' && temporaryTool) {
    activeTool.value = temporaryTool
    temporaryTool = null
  }
}

watch(dirtyRevision, () => {
  if (!initialized.value || isPlaceholder.value) return
  if (autosaveTimer) window.clearTimeout(autosaveTimer)
  const snapshot = cloneProject(project.value)
  autosaveTimer = window.setTimeout(() => void saveProject(snapshot), 700)
})

watch(launcherOpen, (open) => {
  if (open) void refreshProjects()
})

watch(closeRequest, () => {
  closeError.value = ''
})

onMounted(async () => {
  unlistenWindowClose = await appWindow.onCloseRequested(requestApplicationClose)
  await refreshProjects()
  initialized.value = true
  window.addEventListener('keydown', keydown, true)
  window.addEventListener('keyup', keyup)
})

onBeforeUnmount(() => {
  if (autosaveTimer) window.clearTimeout(autosaveTimer)
  unlistenWindowClose?.()
  window.removeEventListener('keydown', keydown, true)
  window.removeEventListener('keyup', keyup)
})
</script>

<template>
  <div class="studio-page">
    <main
      class="studio-shell"
      data-testid="app-shell"
      @click="exportOpen = false"
      @contextmenu.prevent
    >
      <DocumentTabs @activate="switchDocument" @close="closeSpriteDocument" @new="requestNew" />

      <header class="app-bar">
        <div class="project-heading">
          <input
            v-if="editingName"
            v-model="nameDraft"
            class="project-name-input"
            name="project-name"
            autocomplete="off"
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
            @click="editingName = true"
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
      </header>

      <div class="workspace-grid">
        <ToolRail />

        <section class="canvas-workspace" aria-label="Canvas workspace">
          <header class="canvas-toolbar">
            <div class="tool-context">
              <span class="tool-chip"
                ><Sparkles v-if="activeTool === 'picker'" :size="13" />{{ activeTool }}</span
              >
              <label
                v-if="['pencil', 'mirror', 'dither', 'eraser'].includes(activeTool)"
                class="brush-control"
              >
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
              <span class="context-hint">{{ toolHint }}</span>
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
              <span class="zoom-divider" />
              <button
                type="button"
                :class="{ active: showGrid }"
                :aria-pressed="showGrid"
                aria-label="Toggle pixel grid"
                title="Pixel grid"
                @click="showGrid = !showGrid"
              >
                <Grid3X3 :size="14" />
              </button>
              <button
                type="button"
                :class="{ active: showTransparency }"
                :aria-pressed="showTransparency"
                aria-label="Toggle transparency checkerboard"
                title="Transparency checkerboard"
                @click="showTransparency = !showTransparency"
              >
                <Grid2X2 :size="14" />
              </button>
            </div>
          </header>
          <div
            class="canvas-scroll"
            :style="{ '--workspace-grid-size': `${zoom}px` }"
            @wheel="onCanvasWheel"
          >
            <PixelCanvas />
          </div>
          <footer class="canvas-status">
            <span><i class="accent-dot" /> Active cel: {{ activeLayer?.name }}</span>
            <span>{{ project.colorMode.toUpperCase() }} · sRGB</span>
          </footer>
        </section>

        <InspectorPanel />
      </div>

      <TimelineStrip />
    </main>

    <ProjectLauncher
      v-if="launcherOpen"
      :projects="recentProjects"
      :workspace-directory="workspaceDirectory"
      :view="launcherView"
      :loading="persistenceState === 'loading'"
      :can-close="!isPlaceholder"
      @create-project="createProject"
      @open-project="openRecentProject"
      @browse="fileInput?.click()"
      @close="showEditor"
      @update-view="launcherView = $event"
    />

    <CloseConfirmationDialog
      v-if="closeRequest"
      :kind="closeRequest.kind === 'project' ? 'project' : 'application'"
      :project-name="closingDocument?.project.name"
      :project-count="openProjectCount"
      :busy="closeBusy"
      :error="closeError"
      @cancel="cancelClose"
      @confirm="confirmClose"
    />

    <input
      ref="fileInput"
      class="sr-only"
      type="file"
      name="project-file"
      aria-label="Open Zakape project"
      accept=".zakape,application/json"
      @change="openProjectFile"
    />
  </div>
</template>
