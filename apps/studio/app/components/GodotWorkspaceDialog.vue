<script setup lang="ts">
import {
  AlertTriangle,
  Box,
  Check,
  ChevronRight,
  FileArchive,
  FileCode2,
  FileImage,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Gamepad2,
  Image,
  Layers3,
  LoaderCircle,
  Music2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Type,
  X,
} from '@lucide/vue'
import type { Component } from 'vue'
import type { SpriteProject } from '~/types/editor'
import type { GodotPublishKind, GodotResourceEntry, GodotResourceKind } from '~/utils/godot'
import {
  buildGodotSpriteFramesResource,
  godotBreadcrumbs,
  godotPublishPaths,
  joinGodotPath,
  safeGodotBaseName,
  validateGodotPublish,
  visibleGodotResources,
} from '~/utils/godot'
import { renderCurrentPngBytes, renderSpriteSheetPngBytes } from '~/utils/export'

const props = defineProps<{
  open: boolean
  project: SpriteProject
  activeFrameId: string
  canPublish: boolean
}>()

const emit = defineEmits<{
  close: []
  openProject: [project: SpriteProject, sourceLabel: string]
}>()

const {
  available,
  projects,
  activeProject,
  activeProjectPath,
  resources,
  resourcesTruncated,
  busy,
  error,
  notice,
  initialize,
  scanFolder,
  selectProject,
  removeProject,
  refreshResources,
  createDirectory,
  importResource,
  assetConflicts,
  writeAssets,
} = useGodotWorkspace()

const dialog = ref<HTMLElement | null>(null)
const searchInput = ref<HTMLInputElement | null>(null)
const currentDirectory = ref('')
const query = ref('')
const kind = ref<GodotResourceKind | 'all'>('all')
const selectedResourcePath = ref('')
const creatingFolder = ref(false)
const folderName = ref('')
const publishKind = ref<GodotPublishKind>('animation')
const baseName = ref(safeGodotBaseName(props.project.name))
const animationName = ref('default')
const loop = ref(true)
const includeSource = ref(true)
const conflicts = ref<string[]>([])
const replaceConfirmed = ref(false)
let previousFocus: HTMLElement | null = null

const categories: Array<{ id: GodotResourceKind | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'texture', label: 'Textures' },
  { id: 'scene', label: 'Scenes' },
  { id: 'resource', label: 'Resources' },
  { id: 'script', label: 'Scripts' },
  { id: 'source', label: 'Sources' },
]

const visibleResources = computed(() =>
  visibleGodotResources(resources.value, currentDirectory.value, query.value, kind.value),
)
const breadcrumbs = computed(() => godotBreadcrumbs(currentDirectory.value))
const selectedResource = computed(
  () => resources.value.find((resource) => resource.path === selectedResourcePath.value) ?? null,
)
const publishPaths = computed(() =>
  godotPublishPaths(publishKind.value, currentDirectory.value, baseName.value, includeSource.value),
)
const publishError = computed(() => {
  if (!props.canPublish) return 'Open or create a Zakape canvas before publishing.'
  if (!activeProject.value) return 'Connect and select a Godot project first.'
  if (activeProject.value.availability === 'missing') return 'Reconnect this missing Godot project.'
  return validateGodotPublish(
    props.project,
    publishKind.value,
    currentDirectory.value,
    baseName.value,
    animationName.value,
    activeProject.value.compatibility,
  )
})

const formatSize = (bytes: number) => {
  if (!bytes) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

const resourceIcon = (entry: GodotResourceEntry): Component => {
  if (entry.isDirectory) return Folder
  return (
    {
      texture: FileImage,
      scene: Box,
      resource: Layers3,
      script: FileCode2,
      audio: Music2,
      font: Type,
      source: FileArchive,
      data: FileText,
      other: FileText,
      folder: Folder,
    } as Record<GodotResourceKind, Component>
  )[entry.kind]
}

const projectVersionLabel = (project: (typeof projects.value)[number]) => {
  if (project.availability === 'missing') return 'Folder missing'
  if (project.godotVersion) return `Godot ${project.godotVersion}`
  if (project.compatibility === 'legacy') return 'Godot 3 / legacy'
  return 'Godot project'
}

const openEntry = async (entry: GodotResourceEntry) => {
  error.value = ''
  notice.value = ''
  if (entry.isDirectory) {
    currentDirectory.value = entry.path
    query.value = ''
    selectedResourcePath.value = ''
    conflicts.value = []
    replaceConfirmed.value = false
    return
  }
  selectedResourcePath.value = entry.path
}

const openSelectedResource = async () => {
  const selected = selectedResource.value
  if (!selected?.importable) return
  error.value = ''
  try {
    const imported = await importResource(selected.path)
    emit('openProject', imported, `Opened res://${selected.path}`)
    emit('close')
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  }
}

const submitFolder = async () => {
  const name = folderName.value.trim()
  const hasControlCharacter = [...name].some((character) => character.charCodeAt(0) < 32)
  if (
    !name ||
    name.length > 64 ||
    name.startsWith('.') ||
    /[/\\<>:"|?*]/.test(name) ||
    hasControlCharacter
  ) {
    error.value = 'Use a folder name without slashes or reserved filename characters.'
    return
  }
  try {
    await createDirectory(joinGodotPath(currentDirectory.value, name))
    folderName.value = ''
    creatingFolder.value = false
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  }
}

const publish = async () => {
  error.value = ''
  notice.value = ''
  if (publishError.value) {
    error.value = publishError.value
    return
  }
  try {
    const nextConflicts = await assetConflicts(publishPaths.value)
    conflicts.value = nextConflicts
    if (nextConflicts.length && !replaceConfirmed.value) return

    const encoder = new TextEncoder()
    const pngBytes =
      publishKind.value === 'animation'
        ? await renderSpriteSheetPngBytes(props.project)
        : await renderCurrentPngBytes(props.project, props.activeFrameId)
    const files: Array<{ relativePath: string; contents: number[] }> = [
      { relativePath: publishPaths.value[0]!, contents: Array.from(pngBytes) },
    ]
    if (publishKind.value === 'animation') {
      const resource = buildGodotSpriteFramesResource(
        props.project,
        publishPaths.value[0]!,
        animationName.value,
        loop.value,
      )
      files.push({
        relativePath: publishPaths.value[1]!,
        contents: Array.from(encoder.encode(resource)),
      })
    }
    if (includeSource.value) {
      files.push({
        relativePath: publishPaths.value.at(-1)!,
        contents: Array.from(encoder.encode(JSON.stringify(props.project, null, 2))),
      })
    }
    await writeAssets(files, replaceConfirmed.value)
    selectedResourcePath.value = publishPaths.value[0]!
    conflicts.value = []
    replaceConfirmed.value = false
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : String(caught)
  }
}

const handleDialogKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    emit('close')
    return
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
    event.preventDefault()
    searchInput.value?.focus()
    return
  }
  if (event.key !== 'Tab' || !dialog.value) return
  const focusable = Array.from(
    dialog.value.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled)',
    ),
  )
  if (!focusable.length) return
  const first = focusable[0]!
  const last = focusable.at(-1)!
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(activeProjectPath, () => {
  currentDirectory.value = ''
  query.value = ''
  selectedResourcePath.value = ''
  conflicts.value = []
  replaceConfirmed.value = false
})

watch([publishKind, baseName, includeSource, currentDirectory], () => {
  conflicts.value = []
  replaceConfirmed.value = false
})

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      await nextTick()
      previousFocus?.focus()
      return
    }
    previousFocus = document.activeElement as HTMLElement | null
    baseName.value = safeGodotBaseName(props.project.name)
    error.value = ''
    notice.value = ''
    await initialize()
    await nextTick()
    dialog.value?.focus()
  },
)
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop godot-backdrop" @mousedown.self="emit('close')">
      <section
        ref="dialog"
        class="godot-workspace"
        role="dialog"
        aria-modal="true"
        aria-labelledby="godot-workspace-title"
        tabindex="-1"
        data-testid="godot-workspace"
        @keydown="handleDialogKeydown"
      >
        <header class="godot-workspace-header">
          <span class="godot-workspace-mark"><Gamepad2 :size="19" aria-hidden="true" /></span>
          <div>
            <span class="eyebrow">Engine handoff</span>
            <h2 id="godot-workspace-title">Godot Bridge</h2>
          </div>
          <span class="godot-live-path">
            <i aria-hidden="true" />
            {{ activeProject ? `res://${currentDirectory}` : 'No project connected' }}
          </span>
          <button
            type="button"
            class="icon-button"
            aria-label="Close Godot Bridge"
            @click="emit('close')"
          >
            <X :size="18" aria-hidden="true" />
          </button>
        </header>

        <div v-if="!available" class="godot-unavailable">
          <span><Gamepad2 :size="27" aria-hidden="true" /></span>
          <div>
            <span class="eyebrow">Desktop workspace access</span>
            <h3>Connect projects from the Zakape desktop app.</h3>
            <p>
              The web and mobile builds keep filesystem access sandboxed. Use Zakape on desktop to
              scan Godot projects, browse res://, and publish assets directly into a game folder.
            </p>
          </div>
          <button type="button" class="button-secondary" @click="emit('close')">Close</button>
        </div>

        <div v-else class="godot-workspace-body">
          <aside class="godot-projects" aria-label="Connected Godot projects">
            <header>
              <span>Projects</span><small>{{ projects.length }}/16</small>
            </header>
            <div v-if="projects.length" class="godot-project-list">
              <div
                v-for="entry in projects"
                :key="entry.rootPath"
                :class="['godot-project-item', { active: entry.rootPath === activeProjectPath }]"
              >
                <button
                  type="button"
                  class="godot-project-select"
                  @click="selectProject(entry.rootPath)"
                >
                  <span class="godot-project-glyph"><Gamepad2 :size="15" /></span>
                  <span>
                    <strong>{{ entry.name }}</strong>
                    <small :class="{ missing: entry.availability === 'missing' }">
                      {{ projectVersionLabel(entry) }}
                    </small>
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="Disconnect project"
                  @click.stop="removeProject(entry.rootPath)"
                >
                  <Trash2 :size="13" />
                </button>
              </div>
            </div>
            <div v-else class="godot-project-empty">
              <FolderOpen :size="21" />
              <strong>No projects yet</strong>
              <p>Choose one project or scan a folder that contains several.</p>
            </div>
            <button
              type="button"
              class="godot-connect"
              :disabled="busy === 'scan' || projects.length >= 16"
              @click="scanFolder"
            >
              <LoaderCircle v-if="busy === 'scan'" class="spin" :size="15" />
              <Plus v-else :size="15" />
              {{ busy === 'scan' ? 'Scanning…' : 'Connect folder' }}
            </button>
          </aside>

          <section class="godot-explorer" aria-label="Godot resources">
            <header class="godot-explorer-tools">
              <label>
                <Search :size="14" aria-hidden="true" />
                <input
                  ref="searchInput"
                  v-model="query"
                  type="search"
                  placeholder="Search res://"
                  aria-label="Search Godot resources"
                />
                <kbd>Ctrl F</kbd>
              </label>
              <button
                type="button"
                aria-label="Refresh Godot resources"
                :disabled="!activeProject || busy === 'resources'"
                @click="refreshResources"
              >
                <RefreshCw :class="{ spin: busy === 'resources' }" :size="15" />
              </button>
              <button
                type="button"
                :aria-pressed="creatingFolder"
                :disabled="!activeProject"
                @click="creatingFolder = !creatingFolder"
              >
                <FolderPlus :size="15" /><span>New folder</span>
              </button>
            </header>

            <nav class="godot-breadcrumbs" aria-label="Resource path">
              <template v-for="(crumb, index) in breadcrumbs" :key="crumb.path">
                <ChevronRight v-if="index" :size="12" aria-hidden="true" />
                <button type="button" @click="currentDirectory = crumb.path">
                  {{ crumb.label }}
                </button>
              </template>
            </nav>

            <form v-if="creatingFolder" class="godot-folder-form" @submit.prevent="submitFolder">
              <FolderPlus :size="14" aria-hidden="true" />
              <input
                v-model="folderName"
                type="text"
                maxlength="64"
                placeholder="Folder name"
                aria-label="New Godot folder name"
                autofocus
              />
              <button type="submit" class="button-primary" :disabled="busy === 'create-folder'">
                Create
              </button>
              <button type="button" class="button-quiet" @click="creatingFolder = false">
                Cancel
              </button>
            </form>

            <div class="godot-kind-tabs" role="group" aria-label="Resource type filter">
              <button
                v-for="category in categories"
                :key="category.id"
                type="button"
                :class="{ active: kind === category.id }"
                :aria-pressed="kind === category.id"
                @click="kind = category.id"
              >
                {{ category.label }}
              </button>
            </div>

            <div class="godot-resource-table">
              <header><span>Name</span><span>Type</span><span>Size</span></header>
              <div v-if="busy === 'resources'" class="godot-resource-empty" role="status">
                <LoaderCircle class="spin" :size="18" /> Indexing res://…
              </div>
              <div v-else-if="!activeProject" class="godot-resource-empty">
                <FolderOpen :size="20" /> Connect a Godot project to inspect its resources.
              </div>
              <div v-else-if="!visibleResources.length" class="godot-resource-empty">
                <Search :size="20" /> No resources match this view.
              </div>
              <template v-else>
                <button
                  v-for="entry in visibleResources"
                  :key="entry.path"
                  type="button"
                  :class="['godot-resource-row', { selected: entry.path === selectedResourcePath }]"
                  @click="openEntry(entry)"
                  @dblclick="entry.isDirectory ? openEntry(entry) : openSelectedResource()"
                >
                  <span>
                    <span :class="['godot-resource-icon', entry.kind]">
                      <component :is="resourceIcon(entry)" :size="15" />
                    </span>
                    <span
                      ><strong>{{ entry.name }}</strong
                      ><small>{{ entry.path }}</small></span
                    >
                  </span>
                  <span>{{ entry.kind }}</span>
                  <span>{{ entry.isDirectory ? '—' : formatSize(entry.size) }}</span>
                  <ChevronRight v-if="entry.isDirectory" :size="13" />
                </button>
              </template>
            </div>

            <footer class="godot-selection-bar">
              <template v-if="selectedResource">
                <span>
                  <component :is="resourceIcon(selectedResource)" :size="15" />
                  <span
                    ><strong>{{ selectedResource.name }}</strong
                    ><small>res://{{ selectedResource.path }}</small></span
                  >
                </span>
                <button
                  type="button"
                  class="button-secondary"
                  :disabled="!selectedResource.importable || busy === 'import'"
                  @click="openSelectedResource"
                >
                  <LoaderCircle v-if="busy === 'import'" class="spin" :size="14" />
                  {{ selectedResource.importable ? 'Open in Zakape' : 'Preview unavailable' }}
                </button>
              </template>
              <span v-else class="godot-selection-hint">
                Select a resource for details. Double-click a folder to browse it.
              </span>
              <small v-if="resourcesTruncated" class="godot-index-warning">
                Showing the first 5,000 resources.
              </small>
            </footer>
          </section>

          <aside class="godot-publisher" aria-label="Publish to Godot">
            <header>
              <span class="eyebrow">Active canvas</span>
              <h3>Publish asset</h3>
              <p v-if="canPublish">{{ project.name }} · {{ project.width }}×{{ project.height }}</p>
              <p v-else>No Zakape canvas is open.</p>
            </header>

            <div class="godot-publish-kind" role="group" aria-label="Godot asset type">
              <button
                type="button"
                :class="{ active: publishKind === 'animation' }"
                :aria-pressed="publishKind === 'animation'"
                @click="publishKind = 'animation'"
              >
                <Layers3 :size="15" /><span
                  ><strong>Animation</strong><small>PNG + SpriteFrames</small></span
                >
              </button>
              <button
                type="button"
                :class="{ active: publishKind === 'frame' }"
                :aria-pressed="publishKind === 'frame'"
                @click="publishKind = 'frame'"
              >
                <Image :size="15" /><span
                  ><strong>Frame</strong><small>Current frame PNG</small></span
                >
              </button>
            </div>

            <label class="godot-field">
              <span>Asset name</span>
              <input
                v-model="baseName"
                type="text"
                maxlength="64"
                autocomplete="off"
                spellcheck="false"
              />
            </label>
            <label v-if="publishKind === 'animation'" class="godot-field">
              <span>Animation name</span>
              <input v-model="animationName" type="text" maxlength="64" autocomplete="off" />
            </label>

            <div class="godot-output-path">
              <span>Destination</span>
              <strong>res://{{ currentDirectory ? `${currentDirectory}/` : '' }}</strong>
              <small>Browse into a folder to change the destination.</small>
            </div>

            <label v-if="publishKind === 'animation'" class="godot-check">
              <input v-model="loop" type="checkbox" />
              <span
                ><strong>Loop animation</strong
                ><small>Stored in the SpriteFrames resource.</small></span
              >
            </label>
            <label class="godot-check">
              <input v-model="includeSource" type="checkbox" />
              <span
                ><strong>Keep editable source</strong
                ><small>Writes a .zakape file beside the asset.</small></span
              >
            </label>

            <div class="godot-file-plan" aria-label="Files to publish">
              <span>Files</span>
              <code v-for="path in publishPaths" :key="path">{{ path.split('/').at(-1) }}</code>
            </div>

            <div v-if="conflicts.length" class="godot-conflict" role="alert">
              <AlertTriangle :size="16" />
              <span>
                <strong
                  >{{ conflicts.length }} file{{ conflicts.length === 1 ? '' : 's' }} already
                  exist</strong
                >
                <small>{{ conflicts.join(', ') }}</small>
              </span>
              <label
                ><input v-model="replaceConfirmed" type="checkbox" /> Replace these files</label
              >
            </div>
            <p v-else-if="publishError" class="godot-publish-note">{{ publishError }}</p>
            <p
              v-else-if="activeProject?.compatibility === 'unknown' && publishKind === 'animation'"
              class="godot-publish-note warning"
            >
              This project has no config version. Zakape will write the Godot 4 resource format.
            </p>

            <button
              type="button"
              class="godot-publish-button"
              :disabled="
                Boolean(publishError) ||
                busy === 'publish' ||
                (conflicts.length > 0 && !replaceConfirmed)
              "
              @click="publish"
            >
              <LoaderCircle v-if="busy === 'publish'" class="spin" :size="15" />
              <Check v-else :size="15" />
              {{
                busy === 'publish'
                  ? 'Publishing…'
                  : conflicts.length
                    ? 'Replace and publish'
                    : 'Publish to Godot'
              }}
            </button>
          </aside>
        </div>

        <footer v-if="available" class="godot-statusbar" aria-live="polite">
          <span v-if="error" class="error"><AlertTriangle :size="13" />{{ error }}</span>
          <span v-else-if="notice" class="success"><Check :size="13" />{{ notice }}</span>
          <span v-else><i aria-hidden="true" /> Writes stay inside the selected res:// root.</span>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
