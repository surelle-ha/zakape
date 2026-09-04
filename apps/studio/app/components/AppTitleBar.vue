<script setup lang="ts">
import {
  Check,
  CircleHelp,
  FolderOpen,
  Grid3X3,
  Info,
  Keyboard,
  RefreshCw,
  RotateCcw,
  Save,
  Undo2,
} from '@lucide/vue'
import zakapeMark from '../../../../assets/brand/zakape-icon.png'

const props = withDefaults(defineProps<{ menusEnabled?: boolean }>(), {
  menusEnabled: true,
})

const { screen, requestNew, requestOpen, showHome, showShortcutGuide, showWalkthrough } =
  useWorkspace()
const { project, canRedo, canUndo, onionSkin, redo, showGrid, undo } = useEditor()
const { saveProject, workspaceDirectory } = useProjectRepository()
const { checkForUpdates, currentVersion, status: updateStatus } = useAppUpdater()
const win = useAppWindow()
const menuRoot = ref<HTMLElement | null>(null)
const openMenu = ref<'file' | 'edit' | 'view' | 'help' | null>(null)
const aboutOpen = ref(false)
const aboutTrigger = ref<HTMLButtonElement | null>(null)
const aboutClose = ref<HTMLButtonElement | null>(null)

const documentTitle = computed(() => (screen.value === 'editor' ? project.value.name : 'Projects'))
const updateMenuLabel = computed(() =>
  updateStatus.value === 'checking' ? 'Checking for updates…' : 'Check for updates',
)

const closeMenus = () => {
  openMenu.value = null
}

const run = (action: () => void | Promise<void>) => {
  closeMenus()
  void action()
}

const save = async () => {
  if (screen.value === 'editor') await saveProject(project.value)
}

const openAbout = async () => {
  aboutOpen.value = true
  await nextTick()
  aboutClose.value?.focus()
}

const closeAbout = async () => {
  aboutOpen.value = false
  await nextTick()
  aboutTrigger.value?.focus()
}

const onPointerDown = (event: PointerEvent) => {
  if (openMenu.value && menuRoot.value && !menuRoot.value.contains(event.target as Node))
    closeMenus()
}

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    if (aboutOpen.value) {
      void closeAbout()
      return
    }
    closeMenus()
    return
  }
  if (!props.menusEnabled) return
  if (!(event.ctrlKey || event.metaKey)) return
  const key = event.key.toLowerCase()
  if (key === 'n') {
    event.preventDefault()
    requestNew()
  } else if (key === 'o') {
    event.preventDefault()
    requestOpen()
  } else if (key === 's') {
    event.preventDefault()
    void save()
  }
}

const onTitleDoubleClick = (event: MouseEvent) => {
  if ((event.target as HTMLElement).closest('button, [role="menu"]')) return
  void win.toggleMaximize()
}

onMounted(() => {
  window.addEventListener('pointerdown', onPointerDown, true)
  window.addEventListener('keydown', onKeydown)
  void win.refreshMaximized()
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', onPointerDown, true)
  window.removeEventListener('keydown', onKeydown)
})

watch(
  () => props.menusEnabled,
  (enabled) => {
    if (!enabled) closeMenus()
  },
)
</script>

<template>
  <header
    class="app-titlebar"
    data-tauri-drag-region
    data-testid="app-titlebar"
    @dblclick="onTitleDoubleClick"
  >
    <div class="title-identity" data-tauri-drag-region>
      <img class="title-mark" :src="zakapeMark" alt="" aria-hidden="true" />
      <strong data-tauri-drag-region>ZAKAPE STUDIO</strong>
      <span data-tauri-drag-region>{{ documentTitle }}</span>
    </div>

    <nav v-if="menusEnabled" ref="menuRoot" class="title-menus" aria-label="Application menus">
      <div>
        <button
          type="button"
          :aria-expanded="openMenu === 'file'"
          aria-haspopup="menu"
          @click="openMenu = openMenu === 'file' ? null : 'file'"
          @mouseenter="openMenu && (openMenu = 'file')"
        >
          File
        </button>
        <div v-if="openMenu === 'file'" class="title-menu" role="menu">
          <button type="button" role="menuitem" @click="run(showHome)">
            <FolderOpen :size="13" /> Projects
          </button>
          <button type="button" role="menuitem" @click="run(() => requestNew())">
            <RotateCcw :size="13" /> New sprite <kbd>Ctrl N</kbd>
          </button>
          <button type="button" role="menuitem" @click="run(requestOpen)">
            <FolderOpen :size="13" /> Open project <kbd>Ctrl O</kbd>
          </button>
          <span class="menu-separator" role="separator" />
          <button type="button" role="menuitem" :disabled="screen !== 'editor'" @click="run(save)">
            <Save :size="13" /> Save project <kbd>Ctrl S</kbd>
          </button>
        </div>
      </div>

      <div>
        <button
          type="button"
          :aria-expanded="openMenu === 'edit'"
          aria-haspopup="menu"
          @click="openMenu = openMenu === 'edit' ? null : 'edit'"
          @mouseenter="openMenu && (openMenu = 'edit')"
        >
          Edit
        </button>
        <div v-if="openMenu === 'edit'" class="title-menu" role="menu">
          <button type="button" role="menuitem" :disabled="!canUndo" @click="run(undo)">
            <Undo2 :size="13" /> Undo <kbd>Ctrl Z</kbd>
          </button>
          <button type="button" role="menuitem" :disabled="!canRedo" @click="run(redo)">
            <RotateCcw :size="13" /> Redo <kbd>Ctrl Y</kbd>
          </button>
        </div>
      </div>

      <div>
        <button
          type="button"
          :aria-expanded="openMenu === 'view'"
          aria-haspopup="menu"
          @click="openMenu = openMenu === 'view' ? null : 'view'"
          @mouseenter="openMenu && (openMenu = 'view')"
        >
          View
        </button>
        <div v-if="openMenu === 'view'" class="title-menu" role="menu">
          <button
            type="button"
            role="menuitemcheckbox"
            :aria-checked="showGrid"
            @click="showGrid = !showGrid"
          >
            <Check v-if="showGrid" :size="13" /> <span v-else class="menu-icon-space" /> Pixel grid
          </button>
          <button
            type="button"
            role="menuitemcheckbox"
            :aria-checked="onionSkin"
            @click="onionSkin = !onionSkin"
          >
            <Check v-if="onionSkin" :size="13" /> <span v-else class="menu-icon-space" /> Onion skin
          </button>
          <span class="menu-separator" role="separator" />
          <button type="button" role="menuitem" @click="run(() => win.toggleMaximize())">
            <Grid3X3 :size="13" /> Toggle maximize
          </button>
        </div>
      </div>

      <div>
        <button
          ref="aboutTrigger"
          type="button"
          :aria-expanded="openMenu === 'help'"
          aria-haspopup="menu"
          @click="openMenu = openMenu === 'help' ? null : 'help'"
          @mouseenter="openMenu && (openMenu = 'help')"
        >
          Help
        </button>
        <div v-if="openMenu === 'help'" class="title-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            :disabled="screen !== 'editor'"
            @click="run(showWalkthrough)"
          >
            <CircleHelp :size="13" /> Quick tour
          </button>
          <button
            type="button"
            role="menuitem"
            :disabled="screen !== 'editor'"
            @click="run(showShortcutGuide)"
          >
            <Keyboard :size="13" /> Keyboard shortcuts <kbd>?</kbd>
          </button>
          <span class="menu-separator" role="separator" />
          <button
            type="button"
            role="menuitem"
            :disabled="updateStatus === 'checking' || updateStatus === 'downloading'"
            @click="run(() => checkForUpdates(true))"
          >
            <RefreshCw :class="{ spin: updateStatus === 'checking' }" :size="13" />
            {{ updateMenuLabel }}
          </button>
          <button type="button" role="menuitem" @click="run(openAbout)">
            <Info :size="13" /> About Zakape
          </button>
        </div>
      </div>
    </nav>

    <div class="title-drag-space" data-tauri-drag-region />
    <WindowControls />
  </header>

  <Teleport to="body">
    <div v-if="aboutOpen" class="about-backdrop" @click.self="closeAbout">
      <section
        class="about-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-heading"
        @keydown.tab.prevent="aboutClose?.focus()"
      >
        <span class="brand-mark about-mark" aria-hidden="true"><i /><i /><i /><i /></span>
        <span class="eyebrow">Pixel workbench</span>
        <h2 id="about-heading">Zakape</h2>
        <p>Open-source sprite drawing, animation, and reviewable model-assisted edits.</p>
        <span class="about-author">Created by <strong>surelle-ha</strong></span>
        <small>{{ workspaceDirectory }} · v{{ currentVersion }}</small>
        <button ref="aboutClose" type="button" class="button-primary" @click="closeAbout">
          Close
        </button>
      </section>
    </div>
  </Teleport>
</template>
