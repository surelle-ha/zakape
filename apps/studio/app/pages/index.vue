<script setup lang="ts">
import {
  Check,
  ChevronDown,
  Download,
  Eye,
  FileUp,
  Grid2X2,
  Grid3X3,
  Keyboard,
  Layers2,
  Layers3,
  Maximize2,
  Minus,
  Plus,
  Redo2,
  Save,
  Sparkles,
  Undo2,
  X,
} from '@lucide/vue'
import type { CanvasBackground, ColorMode, SpriteProject, ToolId } from '~/types/editor'
import { cloneProject, createBlankProject } from '~/utils/project'
import { importProjectFile } from '~/utils/import'
import { toolDefinitions } from '~/utils/commands'

const {
  documents,
  activeDocumentId,
  isPlaceholder,
  project,
  activeFrameId,
  activeLayerId,
  activeTool,
  activeSelection,
  primaryColor,
  brushSize,
  zoom,
  showGrid,
  showTransparency,
  onionSkin,
  dirtyRevision,
  lastAction,
  canUndo,
  canRedo,
  undo,
  redo,
  replaceProject,
  selectDrawingColor,
  activateDocument,
  closeDocument,
  swapColors,
  resetColors,
  clearSelection,
  deleteSelectionPixels,
  addFrame,
  deleteFrame,
  addLayer,
  deleteLayer,
  requestLayerRename,
  renameProject,
} = useEditor()
const { discardProposal } = useAiAssistant()
const {
  persistenceState,
  recentProjects,
  workspaceFolders,
  workspaceDirectory,
  refreshProjects,
  loadProject,
  saveProject,
  loadPreference,
  savePreference,
  assignProjectToFolder,
} = useProjectRepository()
const {
  screen,
  launcherOpen,
  launcherView,
  assistantOpen,
  modelConnectionOpen,
  shortcutGuideOpen,
  walkthroughOpen,
  godotOpen,
  showHome,
  showEditor,
  showGodotBridge,
  requestNew,
  toggleAssistant,
  showShortcutGuide,
  showWalkthrough,
} = useWorkspace()
const { closeRequest, requestProjectClose, requestApplicationClose, cancelClose } =
  useCloseConfirmation()
const appWindow = useAppWindow()
const { dialogOpen: accountDialogOpen } = useGoogleAccount()
const exportOpen = ref(false)
const inspectorOpen = ref(false)
const timelineOpen = useState<boolean>('timeline-open', () => true)
const fileInput = ref<HTMLInputElement | null>(null)
const canvasScroll = ref<HTMLElement | null>(null)
const editingName = ref(false)
const nameDraft = ref(project.value.name)
const initialized = ref(false)
const closeBusy = ref(false)
const closeError = ref('')
const playing = useState<boolean>('preview-playing', () => true)
const livePreviewOpen = useState<boolean>('live-preview-open', () => true)
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
  return 'Left primary · Right secondary · Alt samples · Space pans'
})
const activeToolLabel = computed(
  () => toolDefinitions.find((tool) => tool.id === activeTool.value)?.label ?? activeTool.value,
)

const usePaletteColor = (color: string) => {
  primaryColor.value = color
  selectDrawingColor('primary')
}

const fitCanvas = async () => {
  await nextTick()
  const host = canvasScroll.value
  if (!host) return
  const compact = window.matchMedia('(max-width: 640px)').matches
  const horizontalPadding = compact ? 72 : 124
  const verticalPadding = compact ? 72 : 124
  const availableWidth = Math.max(1, host.clientWidth - horizontalPadding)
  const availableHeight = Math.max(1, host.clientHeight - verticalPadding)
  const fittedZoom = Math.floor(
    Math.min(availableWidth / project.value.width, availableHeight / project.value.height),
  )
  zoom.value = Math.max(4, Math.min(24, fittedZoom))
}

const fitCompactCanvas = async () => {
  if (!window.matchMedia('(max-width: 1023px)').matches) return
  await fitCanvas()
}

const toggleInspector = () => {
  inspectorOpen.value = !inspectorOpen.value
  if (inspectorOpen.value) assistantOpen.value = false
}

const openAssistant = () => {
  inspectorOpen.value = false
  toggleAssistant()
}

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
    const parsed = await importProjectFile(file)
    replaceProject(parsed, `Opened ${file.name}`)
    nameDraft.value = parsed.name
    showEditor()
    await saveProject(parsed)
    await offerWalkthrough()
    await fitCompactCanvas()
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
  checkerSize: number
  palette: string[]
  folderId: string | null
}) => {
  const nextProject = createBlankProject(
    spec.width,
    spec.height,
    spec.name,
    spec.colorMode,
    spec.background,
    spec.palette,
    spec.checkerSize,
  )
  replaceProject(nextProject, `Created ${spec.width}×${spec.height} sprite`)
  nameDraft.value = nextProject.name
  showEditor()
  await saveProject(nextProject)
  await assignProjectToFolder(nextProject.id, spec.folderId)
  await offerWalkthrough()
  await fitCompactCanvas()
}

const openRecentProject = async (projectId: string) => {
  if (documents.value.some((document) => document.id === projectId)) {
    await switchDocument(projectId)
    showEditor()
    await fitCompactCanvas()
    return
  }
  const savedProject = await loadProject(projectId)
  if (!savedProject) return
  replaceProject(savedProject, `Opened ${savedProject.name}`)
  nameDraft.value = savedProject.name
  showEditor()
  await offerWalkthrough()
  await fitCompactCanvas()
}

const openGodotProject = async (nextProject: SpriteProject, sourceLabel: string) => {
  replaceProject(nextProject, sourceLabel)
  nameDraft.value = nextProject.name
  showEditor()
  await saveProject(nextProject)
  await offerWalkthrough()
  await fitCompactCanvas()
}

async function offerWalkthrough() {
  const completed = await loadPreference<boolean>('editor-walkthrough-complete')
  if (!completed) showWalkthrough()
}

const completeWalkthrough = async () => {
  walkthroughOpen.value = false
  await savePreference('editor-walkthrough-complete', true)
}

const switchDocument = async (documentId: string) => {
  if (documentId === activeDocumentId.value) {
    showEditor()
    await fitCompactCanvas()
    return
  }
  if (autosaveTimer) window.clearTimeout(autosaveTimer)
  if (!isPlaceholder.value) await saveProject(cloneProject(project.value))
  discardProposal()
  if (!activateDocument(documentId)) return
  nameDraft.value = project.value.name
  editingName.value = false
  inspectorOpen.value = false
  showEditor()
  await fitCompactCanvas()
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
    await appWindow.exitConfirmed()
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
    event.preventDefault()
    return
  }
  if (event.key === 'Escape') {
    if (modelConnectionOpen.value) return
    if (accountDialogOpen.value) accountDialogOpen.value = false
    else if (godotOpen.value) godotOpen.value = false
    else if (shortcutGuideOpen.value) shortcutGuideOpen.value = false
    else if (walkthroughOpen.value) void completeWalkthrough()
    else if (inspectorOpen.value) inspectorOpen.value = false
    else if (assistantOpen.value) assistantOpen.value = false
    else if (exportOpen.value) exportOpen.value = false
    else clearSelection()
    return
  }
  if (
    accountDialogOpen.value ||
    shortcutGuideOpen.value ||
    walkthroughOpen.value ||
    closeRequest.value
  )
    return
  if (['f5', 'f6', 'f11', 'f12'].includes(key) || (event.altKey && key.startsWith('arrow'))) {
    event.preventDefault()
    return
  }
  if (commandKey && event.shiftKey && key === 'n') {
    event.preventDefault()
    addLayer()
    return
  }
  if (commandKey && event.shiftKey && key === 'e') {
    event.preventDefault()
    exportOpen.value = !exportOpen.value
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
  if (commandKey && key === 'd') {
    event.preventDefault()
    addFrame(true)
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
  if (commandKey && key === '0') {
    event.preventDefault()
    zoom.value = 14
    return
  }
  if (commandKey) {
    event.preventDefault()
    return
  }
  if (event.key === 'F2') {
    event.preventDefault()
    requestLayerRename(activeLayerId.value)
    return
  }
  if (event.key === 'Insert') {
    event.preventDefault()
    addFrame(false)
    return
  }
  if (event.key === 'Delete') {
    event.preventDefault()
    if (event.shiftKey) deleteLayer(activeLayerId.value)
    else if (activeSelection.value) deleteSelectionPixels()
    else deleteFrame(activeFrameId.value)
    return
  }
  if (key === '?' || (event.code === 'Slash' && event.shiftKey)) {
    event.preventDefault()
    showShortcutGuide()
    return
  }
  if (key === 'a') {
    event.preventDefault()
    toggleAssistant()
    return
  }
  if (key === 'k') {
    event.preventDefault()
    playing.value = !playing.value
    return
  }
  if (key === 'o') {
    event.preventDefault()
    onionSkin.value = !onionSkin.value
    return
  }
  if (key === 'v') {
    event.preventDefault()
    livePreviewOpen.value = !livePreviewOpen.value
    return
  }
  if (key === 'g') {
    event.preventDefault()
    if (event.shiftKey) showTransparency.value = !showTransparency.value
    else showGrid.value = !showGrid.value
    return
  }
  if (key === ',' || key === '.') {
    event.preventDefault()
    const frameIndex = project.value.frames.findIndex((frame) => frame.id === activeFrameId.value)
    const offset = key === ',' ? -1 : 1
    const nextFrame =
      project.value.frames[
        (frameIndex + offset + project.value.frames.length) % project.value.frames.length
      ]
    if (nextFrame) activeFrameId.value = nextFrame.id
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
    c: 'circle',
    s: 'select-rect',
    q: 'select-lasso',
    h: 'hand',
  }
  if (shortcuts[key]) {
    event.preventDefault()
    activeTool.value = shortcuts[key]!
  }
  if (key === 'x') {
    event.preventDefault()
    swapColors()
  }
  if (key === 'd') {
    event.preventDefault()
    resetColors()
  }
  if (event.code === 'Space' && !temporaryTool) {
    event.preventDefault()
    temporaryTool = activeTool.value
    activeTool.value = 'hand'
  }
  if (key === '[') {
    event.preventDefault()
    brushSize.value = Math.max(1, brushSize.value - 1)
  }
  if (key === ']') {
    event.preventDefault()
    brushSize.value = Math.min(4, brushSize.value + 1)
  }
  if (key === '=' || key === '+') {
    event.preventDefault()
    zoom.value = Math.min(24, zoom.value + 1)
  }
  if (key === '-') {
    event.preventDefault()
    zoom.value = Math.max(4, zoom.value - 1)
  }
}

const onCanvasWheel = async (event: WheelEvent) => {
  event.preventDefault()
  const host = event.currentTarget as HTMLElement
  const canvasElement = host.querySelector<HTMLCanvasElement>('.pixel-canvas')
  if (!canvasElement) return
  const canvasBounds = canvasElement.getBoundingClientRect()
  const oldZoom = zoom.value
  const nextZoom = Math.max(4, Math.min(24, oldZoom + (event.deltaY < 0 ? 1 : -1)))
  if (nextZoom === oldZoom) return
  const focusPixelX = Math.max(
    0,
    Math.min(project.value.width, (event.clientX - canvasBounds.left) / oldZoom),
  )
  const focusPixelY = Math.max(
    0,
    Math.min(project.value.height, (event.clientY - canvasBounds.top) / oldZoom),
  )
  zoom.value = nextZoom
  await nextTick()
  const nextCanvasBounds = canvasElement.getBoundingClientRect()
  host.scrollLeft += nextCanvasBounds.left + focusPixelX * nextZoom - event.clientX
  host.scrollTop += nextCanvasBounds.top + focusPixelY * nextZoom - event.clientY
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
  const documentId = activeDocumentId.value
  autosaveTimer = window.setTimeout(() => {
    const document = documents.value.find((item) => item.id === documentId)
    if (!document || document.placeholder) return
    void saveProject(cloneProject(document.project))
  }, 700)
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
      :class="{ 'home-active': screen === 'home', 'timeline-collapsed': !timelineOpen }"
      :inert="launcherOpen || godotOpen || accountDialogOpen || Boolean(closeRequest)"
      data-testid="app-shell"
      @click="exportOpen = false"
      @contextmenu.prevent
    >
      <DocumentTabs
        :home-active="screen === 'home'"
        @home="showHome"
        @activate="switchDocument"
        @close="closeSpriteDocument"
        @new="requestNew"
      />

      <HomeWorkspace
        v-if="screen === 'home'"
        :projects="recentProjects"
        :folders="workspaceFolders"
        :workspace-directory="workspaceDirectory"
        :loading="persistenceState === 'loading'"
        @new="requestNew"
        @browse="fileInput?.click()"
        @godot="showGodotBridge"
        @open-project="openRecentProject"
      />

      <header v-if="screen === 'editor'" class="app-bar">
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
            v-tooltip="{
              text: 'Rename project',
              detail: 'Change the document name used for tabs, saves, and exports.',
            }"
            type="button"
            class="project-name"
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
            v-tooltip="{
              text: 'Undo',
              detail: 'Undo the last editable action in this document.',
              shortcut: 'Ctrl+Z',
            }"
            type="button"
            class="icon-button"
            :disabled="!canUndo"
            aria-label="Undo"
            @click="undo"
          >
            <Undo2 :size="16" />
          </button>
          <button
            v-tooltip="{
              text: 'Redo',
              detail: 'Restore the most recently undone action.',
              shortcut: 'Ctrl+Shift+Z',
            }"
            type="button"
            class="icon-button"
            :disabled="!canRedo"
            aria-label="Redo"
            @click="redo"
          >
            <Redo2 :size="16" />
          </button>
          <span class="action-divider" />
          <button
            v-tooltip="{
              text: 'Open project file',
              detail: 'Open a Zakape or compatible sprite project.',
              shortcut: 'Ctrl+O',
            }"
            type="button"
            class="icon-button phone-optional"
            aria-label="Open project"
            @click="fileInput?.click()"
          >
            <FileUp :size="16" />
          </button>
          <button
            v-tooltip="{
              text: 'Save project',
              detail: 'Write the active sprite to the local workspace now.',
              shortcut: 'Ctrl+S',
            }"
            type="button"
            class="icon-button phone-optional"
            aria-label="Save project locally"
            @click="saveNow"
          >
            <Check v-if="persistenceState === 'saved'" :size="16" />
            <Save v-else :size="16" />
          </button>
          <button
            v-tooltip="{
              text: 'Keyboard shortcuts',
              detail: 'View every drawing and editor command.',
              shortcut: '?',
            }"
            type="button"
            class="icon-button phone-optional keyboard-shortcut-launch"
            aria-label="Keyboard shortcuts"
            @click="showShortcutGuide"
          >
            <Keyboard :size="16" />
          </button>
          <button
            v-tooltip="{
              text: 'Layers',
              detail: 'Open or hide the active document layer stack.',
            }"
            type="button"
            class="mobile-layer-launch"
            :class="{ active: inspectorOpen }"
            :aria-pressed="inspectorOpen"
            aria-label="Toggle layers panel"
            @click.stop="toggleInspector"
          >
            <Layers3 :size="16" /><span>Layers</span>
          </button>
          <button
            v-tooltip="{
              text: 'AI art assistant',
              detail: 'Open the optional drawer for reviewable model-assisted edits.',
              shortcut: 'A',
            }"
            type="button"
            class="assistant-launch"
            :class="{ active: assistantOpen }"
            :aria-pressed="assistantOpen"
            @click="openAssistant"
          >
            <Sparkles :size="15" /> <span>Assist</span>
          </button>
          <div class="export-anchor" @click.stop>
            <button
              v-tooltip="{
                text: 'Export',
                detail: 'Create a PNG frame, sprite sheet, animation, or portable project.',
                shortcut: 'Ctrl+Shift+E',
              }"
              type="button"
              class="export-button"
              aria-haspopup="menu"
              :aria-expanded="exportOpen"
              @click="exportOpen = !exportOpen"
            >
              <Download :size="15" /> <span>Export</span>
              <ChevronDown class="export-chevron" :size="13" />
            </button>
            <ExportMenu v-if="exportOpen" @close="exportOpen = false" />
          </div>
        </div>
      </header>

      <div v-if="screen === 'editor'" class="workspace-grid">
        <ToolRail />

        <section class="canvas-workspace" aria-label="Canvas workspace">
          <header class="canvas-toolbar">
            <div class="tool-context">
              <span class="tool-chip"
                ><Sparkles v-if="activeTool === 'picker'" :size="13" />{{ activeToolLabel }}</span
              >
              <label
                v-if="['pencil', 'mirror', 'dither', 'eraser'].includes(activeTool)"
                class="brush-control"
              >
                <span class="brush-label">Size</span>
                <button
                  v-for="size in 4"
                  :key="size"
                  type="button"
                  :data-size="size"
                  :class="{ active: brushSize === size }"
                  :aria-label="`${size} pixel brush`"
                  @click="brushSize = size"
                >
                  <span class="brush-dot" aria-hidden="true" />
                </button>
              </label>
              <span class="context-hint">{{ toolHint }}</span>
            </div>
            <div class="zoom-control">
              <button
                v-tooltip="{
                  text: 'Fit canvas',
                  detail: 'Fit the complete sprite inside the available work area.',
                }"
                type="button"
                aria-label="Fit canvas to workspace"
                @click="fitCanvas"
              >
                <Maximize2 :size="14" />
              </button>
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
                v-tooltip="{
                  text: 'Onion skin',
                  detail: 'Show the previous frame as a muted drawing guide.',
                  shortcut: 'O',
                }"
                type="button"
                :class="{ active: onionSkin }"
                :aria-pressed="onionSkin"
                aria-label="Toggle onion skin"
                @click="onionSkin = !onionSkin"
              >
                <Layers2 :size="14" />
              </button>
              <button
                v-tooltip="{
                  text: 'Live view',
                  detail: 'Show or hide the animation preview beside the canvas.',
                  shortcut: 'V',
                }"
                type="button"
                :class="{ active: livePreviewOpen }"
                :aria-pressed="livePreviewOpen"
                aria-label="Toggle live view"
                @click="livePreviewOpen = !livePreviewOpen"
              >
                <Eye :size="14" />
              </button>
              <button
                v-tooltip="{
                  text: 'Pixel grid',
                  detail: 'Show or hide individual pixel boundaries.',
                  shortcut: 'G',
                }"
                type="button"
                :class="{ active: showGrid }"
                :aria-pressed="showGrid"
                aria-label="Toggle pixel grid"
                @click="showGrid = !showGrid"
              >
                <Grid3X3 :size="14" />
              </button>
              <button
                v-tooltip="{
                  text: 'Transparency checkerboard',
                  detail: 'Show or hide the transparent canvas background.',
                  shortcut: 'Shift+G',
                }"
                type="button"
                :class="{ active: showTransparency }"
                :aria-pressed="showTransparency"
                aria-label="Toggle transparency checkerboard"
                @click="showTransparency = !showTransparency"
              >
                <Grid2X2 :size="14" />
              </button>
            </div>
          </header>
          <div
            ref="canvasScroll"
            class="canvas-scroll"
            :style="{ '--workspace-grid-size': `${zoom}px` }"
            @wheel="onCanvasWheel"
          >
            <PixelCanvas />
          </div>
          <footer class="canvas-status">
            <div class="canvas-palette" role="list" aria-label="Project color palette">
              <span v-for="color in project.palette" :key="color" role="listitem">
                <button
                  v-tooltip="{
                    text: color.toUpperCase(),
                    detail: 'Use as the primary drawing color.',
                  }"
                  type="button"
                  :class="{ active: color.toLowerCase() === primaryColor.toLowerCase() }"
                  :style="{ '--palette-color': color }"
                  :aria-label="`Use ${color.toUpperCase()} as primary color`"
                  @click="usePaletteColor(color)"
                />
              </span>
            </div>
            <span>{{ project.colorMode.toUpperCase() }} · sRGB</span>
          </footer>
          <LivePreviewPanel v-if="livePreviewOpen" />
        </section>

        <button
          v-if="inspectorOpen"
          type="button"
          class="mobile-panel-scrim"
          aria-label="Close layers panel"
          @click="inspectorOpen = false"
        />
        <div class="inspector-host" :class="{ open: inspectorOpen }">
          <header class="mobile-inspector-heading">
            <span><Layers3 :size="16" /> Layers</span>
            <button type="button" aria-label="Close layers panel" @click="inspectorOpen = false">
              <X :size="17" />
            </button>
          </header>
          <InspectorPanel />
        </div>
      </div>

      <TimelineStrip
        v-if="screen === 'editor'"
        :collapsed="!timelineOpen"
        @toggle="timelineOpen = !timelineOpen"
      />
    </main>

    <ProjectLauncher
      v-if="launcherOpen"
      :projects="recentProjects"
      :folders="workspaceFolders"
      :workspace-directory="workspaceDirectory"
      :view="launcherView"
      :loading="persistenceState === 'loading'"
      :can-close="true"
      @create-project="createProject"
      @open-project="openRecentProject"
      @browse="fileInput?.click()"
      @close="showHome"
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

    <GodotWorkspaceDialog
      :open="godotOpen"
      :project="project"
      :active-frame-id="activeFrameId"
      :can-publish="!isPlaceholder"
      @close="godotOpen = false"
      @open-project="openGodotProject"
    />

    <AssistantDrawer :open="assistantOpen" @close="assistantOpen = false" />
    <AccountDialog
      :open="accountDialogOpen"
      :projects="recentProjects"
      :workspace-directory="workspaceDirectory"
      @close="accountDialogOpen = false"
    />
    <ShortcutGuide :open="shortcutGuideOpen" @close="shortcutGuideOpen = false" />
    <EditorWalkthrough :open="walkthroughOpen" @complete="completeWalkthrough" />

    <input
      ref="fileInput"
      class="sr-only"
      type="file"
      name="project-file"
      aria-label="Open sprite project"
      accept=".zakape,.ase,.aseprite,application/json"
      @change="openProjectFile"
    />
  </div>
</template>
