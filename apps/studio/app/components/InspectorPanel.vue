<script setup lang="ts">
import {
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Film,
  Layers3,
  LoaderCircle,
  Palette,
  Plus,
  ScanLine,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from '@lucide/vue'
import type { AssistantEditScope } from '~/types/editor'

const {
  project,
  activeFrameId,
  activeLayerId,
  activeLayer,
  primaryColor,
  dirtyRevision,
  addLayer,
  deleteLayer,
  toggleLayer,
  applyOperations,
} = useEditor()
const { connection, status, errorMessage, proposal, requestProposal, discardProposal } =
  useAiAssistant()
const tab = ref<'assist' | 'layers' | 'palette'>('assist')
const connectionOpen = ref(false)
const prompt = ref('')
const scope = ref<AssistantEditScope>('frame')
const playing = useState<boolean>('preview-playing', () => true)
const activeFrameIndex = computed(() =>
  Math.max(
    0,
    project.value.frames.findIndex((frame) => frame.id === activeFrameId.value),
  ),
)
const proposalOperationCount = computed(
  () => proposal.value?.frames.reduce((total, frame) => total + frame.operations.length, 0) ?? 0,
)
const proposalFrameCount = computed(
  () => proposal.value?.frames.filter((frame) => frame.operations.length > 0).length ?? 0,
)

const suggestions = ['Add a warm rim light', 'Clean silhouette jaggies', 'Push the idle pose']

const submitPrompt = async () => {
  if (!connection.value.model) {
    connectionOpen.value = true
    return
  }
  await requestProposal(
    prompt.value,
    project.value,
    activeFrameId.value,
    activeLayerId.value,
    scope.value,
  )
}

const applyProposal = () => {
  if (!proposal.value) return
  applyOperations(proposal.value.frames, proposal.value.layerId)
  prompt.value = ''
  discardProposal()
}

const selectScope = (nextScope: AssistantEditScope) => {
  if (scope.value === nextScope) return
  scope.value = nextScope
  discardProposal()
}

const updateOpacity = (layerId: string, event: Event) => {
  const layer = project.value.layers.find((item) => item.id === layerId)
  if (!layer) return
  layer.opacity = Number((event.target as HTMLInputElement).value)
  dirtyRevision.value += 1
}
</script>

<template>
  <aside class="inspector" aria-label="Project inspector">
    <section class="preview-card">
      <header>
        <div><span class="status-dot" /> Live preview</div>
        <button type="button" class="micro-button" @click="playing = !playing">
          {{ playing ? 'Pause' : 'Play' }}
        </button>
      </header>
      <div class="preview-stage">
        <PreviewCanvas :size="138" :animate="playing" />
      </div>
      <footer>
        <span>{{ project.width }} × {{ project.height }}</span>
        <span>{{ project.frames.length }} frame{{ project.frames.length === 1 ? '' : 's' }}</span>
        <span>{{ Math.round(1000 / (project.frames[0]?.duration ?? 120)) }} fps</span>
      </footer>
    </section>

    <div class="inspector-tabs" role="tablist" aria-label="Inspector sections">
      <button
        type="button"
        :class="{ active: tab === 'assist' }"
        role="tab"
        @click="tab = 'assist'"
      >
        <Sparkles :size="14" /> Assist
      </button>
      <button
        type="button"
        :class="{ active: tab === 'layers' }"
        role="tab"
        @click="tab = 'layers'"
      >
        <Layers3 :size="14" /> Layers
      </button>
      <button
        type="button"
        :class="{ active: tab === 'palette' }"
        role="tab"
        @click="tab = 'palette'"
      >
        <Palette :size="14" /> Color
      </button>
    </div>

    <section v-if="tab === 'assist'" class="inspector-section assistant-section">
      <div class="assistant-intro">
        <span class="assistant-mark"><Sparkles :size="17" /></span>
        <div>
          <strong>Ask for a bounded edit</strong>
          <p>Zakape previews model-suggested pixel operations before touching your frame.</p>
        </div>
      </div>

      <button type="button" class="connection-row" @click="connectionOpen = true">
        <span :class="['connection-indicator', { connected: status === 'connected' }]" />
        <span>
          <strong>{{ connection.model || 'No model connected' }}</strong>
          <small>{{
            connection.model
              ? connection.provider === 'ollama'
                ? 'Ollama · on this device'
                : connection.baseUrl
              : 'Ollama on-device or compatible API'
          }}</small>
        </span>
        <Settings2 :size="15" />
      </button>

      <fieldset class="assistant-scope">
        <legend>Edit scope</legend>
        <div class="scope-switch">
          <button
            type="button"
            :class="{ active: scope === 'frame' }"
            :aria-pressed="scope === 'frame'"
            :disabled="status === 'working'"
            data-testid="assistant-scope-frame"
            @click="selectScope('frame')"
          >
            <ScanLine :size="14" />
            <span
              ><strong>This frame</strong><small>Frame {{ activeFrameIndex + 1 }}</small></span
            >
          </button>
          <button
            type="button"
            :class="{ active: scope === 'sheet' }"
            :aria-pressed="scope === 'sheet'"
            :disabled="status === 'working'"
            data-testid="assistant-scope-sheet"
            @click="selectScope('sheet')"
          >
            <Film :size="14" />
            <span
              ><strong>Entire sheet</strong
              ><small
                >{{ project.frames.length }} frame{{
                  project.frames.length === 1 ? '' : 's'
                }}</small
              ></span
            >
          </button>
        </div>
        <div class="scope-strip" :class="{ sheet: scope === 'sheet' }" aria-hidden="true">
          <i
            v-for="frame in project.frames"
            :key="frame.id"
            :class="{ active: frame.id === activeFrameId, targeted: scope === 'sheet' }"
          />
        </div>
        <p>
          {{
            scope === 'sheet'
              ? `Coordinate one edit across all ${project.frames.length} frame${project.frames.length === 1 ? '' : 's'}. Applies as one undo step.`
              : 'Edit the current frame, using its neighbors only as visual reference.'
          }}
        </p>
      </fieldset>

      <div class="prompt-box">
        <textarea
          v-model="prompt"
          rows="4"
          :placeholder="
            scope === 'sheet'
              ? 'Describe how the animation should change…'
              : 'Describe a precise pixel-art edit…'
          "
          aria-label="Assistant prompt"
          @keydown.meta.enter.prevent="submitPrompt"
          @keydown.ctrl.enter.prevent="submitPrompt"
        />
        <div>
          <span
            >{{
              scope === 'sheet'
                ? `${project.frames.length} frame${project.frames.length === 1 ? '' : 's'}`
                : `Frame ${activeFrameIndex + 1}`
            }}
            · {{ activeLayer?.name }}</span
          >
          <button
            type="button"
            :disabled="status === 'working' || !prompt.trim()"
            @click="submitPrompt"
          >
            <LoaderCircle v-if="status === 'working'" class="spin" :size="14" />
            <Sparkles v-else :size="14" />
            {{ status === 'working' ? 'Thinking' : 'Propose' }}
          </button>
        </div>
      </div>

      <div class="suggestion-list">
        <button
          v-for="suggestion in suggestions"
          :key="suggestion"
          type="button"
          @click="prompt = suggestion"
        >
          {{ suggestion }} <ChevronRight :size="13" />
        </button>
      </div>

      <p v-if="errorMessage" class="inline-error">{{ errorMessage }}</p>

      <article v-if="proposal" class="proposal-card">
        <span class="eyebrow">Ready to review</span>
        <strong>{{ proposal.summary }}</strong>
        <p>
          {{ proposalOperationCount }} validated operation{{
            proposalOperationCount === 1 ? '' : 's'
          }}
          across {{ proposalFrameCount }} frame{{ proposalFrameCount === 1 ? '' : 's' }} on the
          selected layer.
        </p>
        <div>
          <button type="button" class="button-quiet" @click="discardProposal">
            <X :size="14" /> Discard
          </button>
          <button type="button" class="button-primary" @click="applyProposal">
            <Check :size="14" />
            {{
              proposal.scope === 'sheet'
                ? `Apply to ${proposalFrameCount} frame${proposalFrameCount === 1 ? '' : 's'}`
                : 'Apply edit'
            }}
          </button>
        </div>
      </article>
    </section>

    <section v-else-if="tab === 'layers'" class="inspector-section">
      <header class="section-heading">
        <div>
          <span class="eyebrow">Stack</span><strong>{{ project.layers.length }} layers</strong>
        </div>
        <button type="button" class="icon-button" aria-label="Add layer" @click="addLayer">
          <Plus :size="16" />
        </button>
      </header>
      <div class="layer-list">
        <button
          v-for="layer in [...project.layers].reverse()"
          :key="layer.id"
          type="button"
          class="layer-row"
          :class="{ active: layer.id === activeLayerId }"
          @click="activeLayerId = layer.id"
        >
          <span
            class="visibility-button"
            role="button"
            tabindex="0"
            :aria-label="layer.visible ? 'Hide layer' : 'Show layer'"
            @click.stop="toggleLayer(layer.id)"
            @keydown.enter.stop="toggleLayer(layer.id)"
          >
            <Eye v-if="layer.visible" :size="15" />
            <EyeOff v-else :size="15" />
          </span>
          <span class="layer-thumb"><PreviewCanvas :frame-id="activeFrameId" :size="38" /></span>
          <span class="layer-meta"
            ><strong>{{ layer.name }}</strong
            ><small>{{ Math.round(layer.opacity * 100) }}% · Normal</small></span
          >
          <input
            :value="layer.opacity"
            class="opacity-slider"
            type="range"
            min="0"
            max="1"
            step="0.05"
            aria-label="Layer opacity"
            @input="updateOpacity(layer.id, $event)"
            @click.stop
          />
        </button>
      </div>
      <button
        type="button"
        class="danger-row"
        :disabled="project.layers.length === 1"
        @click="deleteLayer()"
      >
        <Trash2 :size="14" /> Delete selected layer
      </button>
    </section>

    <section v-else class="inspector-section palette-section">
      <div class="current-color">
        <label>
          <span class="eyebrow">Primary color</span>
          <input v-model="primaryColor" type="text" maxlength="7" aria-label="Primary color hex" />
        </label>
        <input
          v-model="primaryColor"
          class="native-color"
          type="color"
          aria-label="Choose primary color"
        />
      </div>
      <div class="swatch-grid" aria-label="Project palette">
        <button
          v-for="color in project.palette"
          :key="color"
          type="button"
          class="swatch"
          :class="{ active: primaryColor.toLowerCase() === color.toLowerCase() }"
          :style="{ '--swatch': color }"
          :aria-label="`Use ${color}`"
          :title="color"
          @click="primaryColor = color"
        />
        <button type="button" class="swatch add-swatch" aria-label="Add color">
          <Plus :size="16" />
        </button>
      </div>
      <p class="panel-note">
        Tip: hold <kbd>Alt</kbd> on the canvas to sample a color without changing tools.
      </p>
    </section>

    <ModelConnectionDialog :open="connectionOpen" @close="connectionOpen = false" />
  </aside>
</template>
