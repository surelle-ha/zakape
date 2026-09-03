<script setup lang="ts">
import {
  ArrowRight,
  Check,
  Clock3,
  FilePlus2,
  FolderOpen,
  HardDrive,
  LayoutTemplate,
  Plus,
  Trash2,
  X,
} from '@lucide/vue'
import type { LauncherView } from '~/composables/useWorkspace'
import type { WorkspaceProjectSummary } from '~/composables/useProjectRepository'
import type { CanvasBackground, ColorMode } from '~/types/editor'
import { normalizePalette, palettePresets } from '~/utils/palettes'

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
      palette: string[]
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
const selectedPaletteId = ref(palettePresets[0]!.id)
const customPalette = ref(normalizePalette(palettePresets[0]!.colors))
const customColor = ref('#8B5CF6')
const customColorOpen = ref(false)
const formError = ref('')
const nameInput = ref<HTMLInputElement | null>(null)
const previewStyle = computed(() => ({
  aspectRatio: `${Math.max(1, width.value)} / ${Math.max(1, height.value)}`,
}))
const selectedPalette = computed(() =>
  selectedPaletteId.value === 'custom'
    ? normalizePalette(customPalette.value)
    : [...(palettePresets.find((preset) => preset.id === selectedPaletteId.value)?.colors ?? [])],
)

const selectPalette = (paletteId: string) => {
  selectedPaletteId.value = paletteId
  customColorOpen.value = false
}

const addCustomColor = () => {
  const [normalized] = normalizePalette([customColor.value])
  if (!normalized || normalizePalette(customPalette.value).includes(normalized)) return
  customPalette.value = [...customPalette.value, normalized]
}

const removeCustomColor = (color: string) => {
  if (customPalette.value.length === 1) return
  customPalette.value = customPalette.value.filter((entry) => entry !== color)
}

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
  if (!selectedPalette.value.length) {
    formError.value = 'Choose at least one palette color.'
    return
  }
  formError.value = ''
  emit('createProject', {
    name,
    width: canvasWidth,
    height: canvasHeight,
    colorMode: colorMode.value,
    background: background.value,
    palette: selectedPalette.value,
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
      if (!window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
        nameInput.value?.select()
      }
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

            <fieldset class="launcher-choice-group palette-choice-group">
              <legend>Starting palette</legend>
              <div class="palette-preset-grid" role="radiogroup" aria-label="Starting palette">
                <button
                  v-for="preset in palettePresets"
                  :key="preset.id"
                  type="button"
                  class="palette-preset"
                  :class="{ selected: selectedPaletteId === preset.id }"
                  role="radio"
                  :aria-checked="selectedPaletteId === preset.id"
                  @click="selectPalette(preset.id)"
                >
                  <span class="palette-preset-heading">
                    <strong>{{ preset.name }}</strong>
                    <Check v-if="selectedPaletteId === preset.id" :size="12" />
                  </span>
                  <span class="palette-preset-swatches" aria-hidden="true">
                    <i
                      v-for="color in preset.colors"
                      :key="color"
                      :style="{ backgroundColor: color }"
                    />
                  </span>
                  <small>{{ preset.note }}</small>
                </button>
                <button
                  type="button"
                  class="palette-preset custom-palette-option"
                  :class="{ selected: selectedPaletteId === 'custom' }"
                  role="radio"
                  :aria-checked="selectedPaletteId === 'custom'"
                  @click="selectPalette('custom')"
                >
                  <span class="palette-preset-heading">
                    <strong>Custom</strong>
                    <Check v-if="selectedPaletteId === 'custom'" :size="12" />
                  </span>
                  <span class="palette-preset-swatches" aria-hidden="true">
                    <i
                      v-for="color in customPalette"
                      :key="color"
                      :style="{ backgroundColor: color }"
                    />
                  </span>
                  <small>Build a reusable color set for this sprite.</small>
                </button>
              </div>

              <div v-if="selectedPaletteId === 'custom'" class="custom-palette-editor">
                <div class="custom-palette-colors" aria-label="Custom palette colors">
                  <span v-for="color in customPalette" :key="color">
                    <i :style="{ backgroundColor: color }" />
                    <button
                      type="button"
                      :aria-label="`Remove ${color}`"
                      :disabled="customPalette.length === 1"
                      @click="removeCustomColor(color)"
                    >
                      <Trash2 :size="9" />
                    </button>
                  </span>
                </div>
                <div class="palette-color-control">
                  <ColorPicker
                    v-model="customColor"
                    label="Custom palette color"
                    swatch-class="primary"
                    :palette="customPalette"
                    :open="customColorOpen"
                    @toggle="customColorOpen = !customColorOpen"
                    @close="customColorOpen = false"
                  />
                  <span>{{ customColor.toUpperCase() }}</span>
                  <button type="button" class="add-palette-color" @click="addCustomColor">
                    <Plus :size="12" /> Add color
                  </button>
                </div>
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
              · {{ background }} background · {{ selectedPalette.length }} colors · 1 frame
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
