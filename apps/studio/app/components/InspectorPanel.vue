<script setup lang="ts">
import {
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Layers3,
  LoaderCircle,
  Palette,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from '@lucide/vue'

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
const playing = useState<boolean>('preview-playing', () => true)

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
    activeLayer.value?.name ?? 'Layer',
  )
}

const applyProposal = () => {
  if (!proposal.value) return
  applyOperations(proposal.value.operations)
  prompt.value = ''
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
        <span>{{ project.frames.length }} frames</span>
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
            connection.model ? connection.baseUrl : 'Local or hosted · your credentials'
          }}</small>
        </span>
        <Settings2 :size="15" />
      </button>

      <div class="prompt-box">
        <textarea
          v-model="prompt"
          rows="4"
          placeholder="Describe a small art edit…"
          aria-label="Assistant prompt"
          @keydown.meta.enter.prevent="submitPrompt"
          @keydown.ctrl.enter.prevent="submitPrompt"
        />
        <div>
          <span>Active layer · {{ activeLayer?.name }}</span>
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
          {{ proposal.operations.length }} validated operation{{
            proposal.operations.length === 1 ? '' : 's'
          }}
          on the active layer.
        </p>
        <div>
          <button type="button" class="button-quiet" @click="discardProposal">
            <X :size="14" /> Discard
          </button>
          <button type="button" class="button-primary" @click="applyProposal">
            <Check :size="14" /> Apply edit
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
