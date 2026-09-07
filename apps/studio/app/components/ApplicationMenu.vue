<script setup lang="ts">
import {
  Check,
  ChevronDown,
  CircleHelp,
  Cloud,
  Eye,
  FolderOpen,
  Gamepad2,
  Grid2X2,
  Grid3X3,
  Info,
  Keyboard,
  Layers2,
  Menu,
  RefreshCw,
  RotateCcw,
  Save,
  Undo2,
} from '@lucide/vue'
import type { Ref } from 'vue'

type GroupId = 'file' | 'edit' | 'view' | 'help'
type Command = {
  id: string
  label: string
  icon: typeof Check
  shortcut?: string
  separatorBefore?: boolean
  checked?: () => boolean
  disabled?: () => boolean
  desktopOnly?: boolean
  run: () => unknown
}
const props = defineProps<{ variant: 'desktop' | 'touch' }>()
const {
  screen,
  requestNew,
  requestOpen,
  showHome,
  showGodotBridge,
  showShortcutGuide,
  showWalkthrough,
} = useWorkspace()
const { project, canRedo, canUndo, onionSkin, redo, showGrid, showTransparency, undo } = useEditor()
const { saveProject, workspaceDirectory } = useProjectRepository()
const { checkForUpdates, currentVersion, status: updateStatus } = useAppUpdater()
const { dialogOpen: accountDialogOpen } = useGoogleAccount()
const win = useAppWindow()
const livePreviewOpen = useState<boolean>('live-preview-open', () => true)
const root = ref<HTMLElement | null>(null)
const openMenu = ref<GroupId | null>(null)
const touchOpen = ref(false)
const aboutOpen = ref(false)
const aboutTrigger = ref<HTMLButtonElement | null>(null)
const aboutClose = ref<HTMLButtonElement | null>(null)
const editorUnavailable = () => screen.value !== 'editor'
const closeMenus = () => {
  openMenu.value = null
  touchOpen.value = false
}
const save = async () => {
  if (!editorUnavailable()) await saveProject(project.value)
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
const toggle = (value: Ref<boolean>) => (value.value = !value.value)
const groups = computed<{ id: GroupId; label: string; commands: Command[] }[]>(() => [
  {
    id: 'file',
    label: 'File',
    commands: [
      { id: 'projects', label: 'Projects', icon: FolderOpen, run: showHome },
      { id: 'new', label: 'New sprite', icon: RotateCcw, shortcut: 'Ctrl N', run: requestNew },
      { id: 'open', label: 'Open project', icon: FolderOpen, shortcut: 'Ctrl O', run: requestOpen },
      { id: 'godot', label: 'Godot Bridge', icon: Gamepad2, run: showGodotBridge },
      {
        id: 'save',
        label: 'Save project',
        icon: Save,
        shortcut: 'Ctrl S',
        separatorBefore: true,
        disabled: editorUnavailable,
        run: save,
      },
    ],
  },
  {
    id: 'edit',
    label: 'Edit',
    commands: [
      {
        id: 'undo',
        label: 'Undo',
        icon: Undo2,
        shortcut: 'Ctrl Z',
        disabled: () => !canUndo.value,
        run: undo,
      },
      {
        id: 'redo',
        label: 'Redo',
        icon: RotateCcw,
        shortcut: 'Ctrl Y',
        disabled: () => !canRedo.value,
        run: redo,
      },
    ],
  },
  {
    id: 'view',
    label: 'View',
    commands: [
      {
        id: 'onion-skin',
        label: 'Onion skin',
        icon: Layers2,
        shortcut: 'O',
        checked: () => onionSkin.value,
        disabled: editorUnavailable,
        run: () => toggle(onionSkin),
      },
      {
        id: 'live-view',
        label: 'Live view',
        icon: Eye,
        shortcut: 'V',
        checked: () => livePreviewOpen.value,
        disabled: editorUnavailable,
        run: () => toggle(livePreviewOpen),
      },
      {
        id: 'pixel-grid',
        label: 'Pixel grid',
        icon: Grid3X3,
        shortcut: 'G',
        checked: () => showGrid.value,
        disabled: editorUnavailable,
        run: () => toggle(showGrid),
      },
      {
        id: 'transparency',
        label: 'Transparency checkerboard',
        icon: Grid2X2,
        shortcut: 'Shift G',
        checked: () => showTransparency.value,
        disabled: editorUnavailable,
        run: () => toggle(showTransparency),
      },
      {
        id: 'maximize',
        label: 'Toggle maximize',
        icon: Grid3X3,
        separatorBefore: true,
        desktopOnly: true,
        run: () => win.toggleMaximize(),
      },
    ],
  },
  {
    id: 'help',
    label: 'Help',
    commands: [
      {
        id: 'tour',
        label: 'Quick tour',
        icon: CircleHelp,
        disabled: editorUnavailable,
        run: showWalkthrough,
      },
      {
        id: 'shortcuts',
        label: 'Keyboard shortcuts',
        icon: Keyboard,
        shortcut: '?',
        desktopOnly: true,
        disabled: editorUnavailable,
        run: showShortcutGuide,
      },
      {
        id: 'account',
        label: 'Account',
        icon: Cloud,
        separatorBefore: true,
        run: () => (accountDialogOpen.value = true),
      },
      {
        id: 'updates',
        label: updateStatus.value === 'checking' ? 'Checking for updates…' : 'Check for updates',
        icon: RefreshCw,
        disabled: () => updateStatus.value === 'checking' || updateStatus.value === 'downloading',
        run: () => checkForUpdates(true),
      },
      { id: 'about', label: 'About Zakape', icon: Info, run: openAbout },
    ],
  },
])
const visibleCommands = (commands: Command[]) =>
  commands.filter((command) => props.variant === 'desktop' || !command.desktopOnly)
const execute = (command: Command) => {
  if (!command.disabled?.()) {
    closeMenus()
    void command.run()
  }
}
const toggleGroup = (id: GroupId) => (openMenu.value = openMenu.value === id ? null : id)
const toggleTouchMenu = () => {
  touchOpen.value = !touchOpen.value
  openMenu.value = null
}
const onPointerDown = (event: PointerEvent) => {
  if (
    (touchOpen.value || openMenu.value) &&
    root.value &&
    !root.value.contains(event.target as Node)
  )
    closeMenus()
}
const onKeydown = (event: KeyboardEvent) => {
  if (event.key !== 'Escape') return
  if (aboutOpen.value) void closeAbout()
  else closeMenus()
}
onMounted(() => {
  window.addEventListener('pointerdown', onPointerDown, true)
  window.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', onPointerDown, true)
  window.removeEventListener('keydown', onKeydown)
})
watch(screen, closeMenus)
</script>

<template>
  <nav v-if="variant === 'desktop'" ref="root" class="title-menus" aria-label="Application menus">
    <div v-for="group in groups" :key="group.id">
      <button
        type="button"
        :aria-expanded="openMenu === group.id"
        aria-haspopup="menu"
        @click="toggleGroup(group.id)"
        @mouseenter="openMenu && (openMenu = group.id)"
      >
        {{ group.label }}
      </button>
      <div v-if="openMenu === group.id" class="title-menu" role="menu">
        <template v-for="command in visibleCommands(group.commands)" :key="command.id">
          <span v-if="command.separatorBefore" class="menu-separator" role="separator" />
          <button
            :ref="command.id === 'about' ? 'aboutTrigger' : undefined"
            type="button"
            :role="command.checked ? 'menuitemcheckbox' : 'menuitem'"
            :aria-checked="command.checked ? command.checked() : undefined"
            :disabled="command.disabled?.()"
            @click="execute(command)"
          >
            <Check v-if="command.checked?.()" :size="13" /><component
              :is="command.icon"
              v-else
              :size="13"
            /><span>{{ command.label }}</span
            ><kbd v-if="command.shortcut">{{ command.shortcut }}</kbd>
          </button>
        </template>
      </div>
    </div>
  </nav>
  <div v-else ref="root" class="touch-application-menu">
    <button
      type="button"
      class="touch-menu-trigger"
      aria-haspopup="menu"
      :aria-expanded="touchOpen"
      aria-label="Application menu"
      @click="toggleTouchMenu"
    >
      <Menu :size="14" /><span>Menu</span>
    </button>
    <div v-if="touchOpen" class="touch-menu-panel" role="menu" aria-label="Application menu">
      <div v-for="group in groups" :key="group.id" class="touch-menu-group">
        <button
          type="button"
          class="touch-menu-category"
          :aria-expanded="openMenu === group.id"
          @click="toggleGroup(group.id)"
        >
          <span>{{ group.label }}</span
          ><ChevronDown :size="15" />
        </button>
        <div v-if="openMenu === group.id" class="touch-menu-children">
          <template v-for="command in visibleCommands(group.commands)" :key="command.id">
            <span v-if="command.separatorBefore" class="menu-separator" role="separator" />
            <button
              :ref="command.id === 'about' ? 'aboutTrigger' : undefined"
              type="button"
              :role="command.checked ? 'menuitemcheckbox' : 'menuitem'"
              :aria-checked="command.checked ? command.checked() : undefined"
              :disabled="command.disabled?.()"
              @click="execute(command)"
            >
              <Check v-if="command.checked?.()" :size="15" /><component
                :is="command.icon"
                v-else
                :size="15"
              /><span>{{ command.label }}</span>
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
  <Teleport to="body"
    ><div v-if="aboutOpen" class="about-backdrop" @click.self="closeAbout">
      <section
        class="about-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-heading"
        @keydown.tab.prevent="aboutClose?.focus()"
      >
        <span class="brand-mark about-mark" aria-hidden="true"><i /><i /><i /><i /></span
        ><span class="eyebrow">Pixel workbench</span>
        <h2 id="about-heading">Zakape</h2>
        <p>Open-source sprite drawing, animation, and reviewable model-assisted edits.</p>
        <span class="about-author">Created by <strong>surelle-ha</strong></span
        ><small>{{ workspaceDirectory }} · v{{ currentVersion }}</small
        ><button ref="aboutClose" type="button" class="button-primary" @click="closeAbout">
          Close
        </button>
      </section>
    </div></Teleport
  >
</template>
