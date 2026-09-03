<script setup lang="ts">
import {
  ArrowRight,
  Clock3,
  FilePlus2,
  FolderOpen,
  HardDrive,
  LayoutTemplate,
  X,
} from '@lucide/vue'
import type { LauncherView } from '~/composables/useWorkspace'
import type { WorkspaceProjectSummary } from '~/composables/useProjectRepository'
import type { CanvasBackground, ColorMode } from '~/types/editor'

const props = defineProps<{
  projects: WorkspaceProjectSummary[]
  workspaceDirectory: string
  view: LauncherView
  loading?: boolean
  canClose?: boolean
}>()

const emit = defineEmits<{
  createProject: [
    spec: {
      name: string
      width: number
      height: number
      colorMode: ColorMode
      background: CanvasBackground
    },
  ]
  openProject: [projectId: string]
  browse: []
  close: []
  updateView: [view: LauncherView]
}>()

const projectName = ref('Untitled sprite')
const width = ref(32)
const height = ref(32)
const colorMode = ref<ColorMode>('rgba')
const background = ref<CanvasBackground>('transparent')
const formError = ref('')
const nameInput = ref<HTMLInputElement | null>(null)
const previewStyle = computed(() => ({
  aspectRatio: `${Math.max(1, width.value)} / ${Math.max(1, height.value)}`,
}))

const submit = () => {
  const name = projectName.value.trim()
  const canvasWidth = Math.round(Number(width.value))
  const canvasHeight = Math.round(Number(height.value))
  if (!name) {
    formError.value = 'Enter a project name.'
    nameInput.value?.focus()
    return
  }
  if (
    !Number.isInteger(canvasWidth) ||
    !Number.isInteger(canvasHeight) ||
    canvasWidth < 1 ||
    canvasHeight < 1 ||
    canvasWidth > 1024 ||
    canvasHeight > 1024
  ) {
    formError.value = 'Width and height must be between 1 and 1,024 pixels.'
    return
  }
  if (canvasWidth * canvasHeight > 1_048_576) {
    formError.value = 'The canvas can contain at most 1,048,576 pixels.'
    return
  }
  formError.value = ''
  emit('createProject', {
    name,
    width: canvasWidth,
    height: canvasHeight,
    colorMode: colorMode.value,
    background: background.value,
  })
}

const updatedLabel = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Saved project'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

watch(
  () => props.view,
  async (view) => {
    formError.value = ''
    if (view === 'new') {
      await nextTick()
      nameInput.value?.select()
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="project-launcher-backdrop" data-testid="project-launcher">
    <section
      v-motion-enter="'surface'"
      class="project-launcher"
      role="dialog"
      aria-modal="true"
      aria-labelledby="launcher-heading"
    >
      <aside class="launcher-rail">
        <div class="launcher-brand">
          <span class="brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <div><strong>ZAKAPE</strong><small>Sprite workspace</small></div>
        </div>

        <nav aria-label="Project launcher">
          <button
            type="button"
            :class="{ active: view === 'recent' }"
            @click="emit('updateView', 'recent')"
          >
            <LayoutTemplate :size="16" /> Recent projects
          </button>
          <button
            type="button"
            :class="{ active: view === 'new' }"
            @click="emit('updateView', 'new')"
          >
            <FilePlus2 :size="16" /> New sprite
          </button>
          <button type="button" @click="emit('browse')">
            <FolderOpen :size="16" /> Open project file
          </button>
        </nav>

        <div class="launcher-directory">
          <HardDrive :size="14" />
          <span
            ><small>Working directory</small><strong>{{ workspaceDirectory }}</strong></span
          >
        </div>
      </aside>

      <div class="launcher-content">
        <header class="launcher-heading-row">
          <div>
            <span class="eyebrow">{{ view === 'new' ? 'New document' : 'Project home' }}</span>
            <h1 id="launcher-heading">
              {{ view === 'new' ? 'Create a sprite' : 'Continue your work' }}
            </h1>
          </div>
          <button
            v-if="canClose"
            type="button"
            class="launcher-close"
            aria-label="Close project launcher"
            @click="emit('close')"
          >
            <X :size="17" />
          </button>
        </header>

        <form
          v-if="view === 'new'"
          class="new-document-form compact-document-form"
          @submit.prevent="submit"
        >
          <div class="document-spec">
            <div class="document-preview" aria-hidden="true">
              <span :class="`background-${background}`" :style="previewStyle"
                ><i /><i /><i /><i /><i
              /></span>
              <small>{{ width || 0 }} × {{ height || 0 }} px</small>
            </div>

            <label class="launcher-field name-field">
              <span>Project name</span>
              <input
                ref="nameInput"
                v-model="projectName"
                type="text"
                name="new-project-name"
                maxlength="64"
                autocomplete="off"
                placeholder="Player idle…"
              />
            </label>

            <div class="dimension-fields">
              <label class="launcher-field">
                <span>Width</span>
                <div>
                  <input
                    v-model.number="width"
                    name="canvas-width"
                    type="number"
                    min="1"
                    max="1024"
                    inputmode="numeric"
                    autocomplete="off"
                  /><small>px</small>
                </div>
              </label>
              <span aria-hidden="true">×</span>
              <label class="launcher-field">
                <span>Height</span>
                <div>
                  <input
                    v-model.number="height"
                    name="canvas-height"
                    type="number"
                    min="1"
                    max="1024"
                    inputmode="numeric"
                    autocomplete="off"
                  /><small>px</small>
                </div>
              </label>
            </div>

            <fieldset class="launcher-choice-group">
              <legend>Color mode</legend>
              <div class="launcher-segments">
                <label v-for="mode in ['rgba', 'grayscale', 'indexed'] as const" :key="mode">
                  <input v-model="colorMode" type="radio" name="color-mode" :value="mode" />
                  <span>{{
                    mode === 'rgba' ? 'RGBA' : mode === 'grayscale' ? 'Greyscale' : 'Indexed'
                  }}</span>
                </label>
              </div>
            </fieldset>

            <fieldset class="launcher-choice-group">
              <legend>Background</legend>
              <div class="launcher-segments background-segments">
                <label v-for="option in ['transparent', 'black', 'white'] as const" :key="option">
                  <input
                    v-model="background"
                    type="radio"
                    name="canvas-background"
                    :value="option"
                  />
                  <span><i :class="`background-chip ${option}`" />{{ option }}</span>
                </label>
              </div>
            </fieldset>

            <p v-if="formError" class="launcher-error" role="alert">{{ formError }}</p>
            <p v-else class="document-note">
              {{
                colorMode === 'rgba'
                  ? 'Full color'
                  : colorMode === 'grayscale'
                    ? 'Greyscale'
                    : 'Palette indexed'
              }}
              · {{ background }} background · 1 frame
            </p>

            <button type="submit" class="launcher-create">
              Create sprite <ArrowRight :size="15" />
            </button>
          </div>
        </form>

        <div v-else class="launcher-recents">
          <button type="button" class="launcher-open-card" @click="emit('browse')">
            <span class="launcher-action-icon"><FolderOpen :size="18" /></span>
            <span
              ><strong>Open a project file</strong
              ><small>Zakape JSON or compatible desktop sprite file</small></span
            >
            <ArrowRight :size="15" />
          </button>

          <div class="recent-heading-row">
            <span>On this device</span><small>{{ projects.length }} indexed</small>
          </div>
          <div v-if="loading" class="launcher-empty" role="status" aria-live="polite">
            Indexing Documents/zakape…
          </div>
          <div v-else-if="projects.length" class="launcher-recent-grid">
            <button
              v-for="project in projects"
              :key="project.id"
              type="button"
              class="launcher-recent-card"
              @click="emit('openProject', project.id)"
            >
              <ProjectThumbnail class="recent-thumb" :preview="project.preview" />
              <span class="recent-copy">
                <strong>{{ project.name }}</strong>
                <small
                  >{{ project.width }} × {{ project.height }} · {{ project.frameCount }} frame{{
                    project.frameCount === 1 ? '' : 's'
                  }}</small
                >
              </span>
              <span class="recent-date"
                ><Clock3 :size="11" /> {{ updatedLabel(project.updatedAt) }}</span
              >
            </button>
          </div>
          <div v-else class="launcher-empty">
            <span class="empty-pixel" aria-hidden="true" />
            <strong>No saved sprites yet</strong>
            <p>Create a sprite or open a project file to begin.</p>
            <button type="button" @click="emit('updateView', 'new')">
              Create your first sprite
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
