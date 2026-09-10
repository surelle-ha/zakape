<script setup lang="ts">
import { Eye, EyeOff, Layers3, PencilLine, Plus, Trash2 } from '@lucide/vue'

const {
  project,
  activeFrameId,
  activeLayerId,
  activeLayer,
  layerEditingId,
  addLayer,
  deleteLayer,
  toggleLayer,
  requestLayerRename,
  renameLayer,
  setLayerOpacity,
  updateTextLayer,
  rasterizeText,
} = useEditor()

const nameDraft = ref('')
let focusingRename = false

const startRename = async (layerId: string) => {
  const layer = project.value.layers.find((item) => item.id === layerId)
  if (!layer) return
  nameDraft.value = layer.name
  if (layerEditingId.value !== layerId) requestLayerRename(layerId)
  await nextTick()
  const input = document.querySelector<HTMLInputElement>(`[data-layer-name-input="${layerId}"]`)
  input?.select()
}

const commitRename = (layerId: string) => {
  renameLayer(layerId, nameDraft.value)
}

const cancelRename = () => {
  layerEditingId.value = null
  nameDraft.value = ''
}

const textDraft = ref('')
const textSizeDraft = ref(8)
const textAlignDraft = ref<'left' | 'center' | 'right'>('left')
const syncTextDraft = () => {
  const data =
    activeLayer.value?.kind === 'text' ? activeLayer.value.textByFrame?.[activeFrameId.value] : null
  textDraft.value = data?.content ?? ''
  textSizeDraft.value = data?.fontSize ?? 8
  textAlignDraft.value = data?.align ?? 'left'
}
const applyTextDraft = () => {
  if (activeLayer.value?.kind !== 'text') return
  updateTextLayer(activeLayer.value.id, {
    content: textDraft.value.slice(0, 2048),
    fontSize: Math.max(1, Math.min(256, Number(textSizeDraft.value) || 8)),
    lineHeight: Math.max(1, Math.round((Number(textSizeDraft.value) || 8) * 1.25)),
    align: textAlignDraft.value,
  })
}
watch([activeLayerId, activeFrameId], syncTextDraft, { immediate: true })

watch(layerEditingId, async (layerId) => {
  if (!layerId || focusingRename) return
  focusingRename = true
  await startRename(layerId)
  focusingRename = false
})
</script>

<template>
  <aside class="inspector layers-inspector" aria-label="Layers inspector">
    <header class="layers-heading">
      <div>
        <span class="section-kicker"><Layers3 :size="14" /> Layers</span>
        <small>{{ project.layers.length }} in stack</small>
      </div>
      <button
        v-tooltip="{
          text: 'New layer',
          detail: 'Add a fresh transparent layer above the current stack.',
          shortcut: 'Ctrl+Shift+N',
          placement: 'left',
        }"
        type="button"
        class="icon-button"
        aria-label="Add fresh layer"
        @click="addLayer"
      >
        <Plus :size="16" />
      </button>
    </header>

    <section class="layers-body">
      <div class="layer-list" role="list" aria-label="Project layers">
        <article
          v-for="layer in [...project.layers].reverse()"
          :key="layer.id"
          class="layer-row"
          :class="{ active: layer.id === activeLayerId, hidden: !layer.visible }"
          role="listitem"
        >
          <button
            v-tooltip="{
              text: layer.visible ? 'Hide layer' : 'Show layer',
              detail: 'Visibility affects only this layer and leaves its pixels intact.',
              placement: 'left',
            }"
            type="button"
            class="visibility-button"
            :aria-label="`${layer.visible ? 'Hide' : 'Show'} ${layer.name}`"
            :aria-pressed="layer.visible"
            @click="toggleLayer(layer.id)"
          >
            <Eye v-if="layer.visible" :size="15" />
            <EyeOff v-else :size="15" />
          </button>

          <div class="layer-select">
            <button
              type="button"
              class="layer-thumb-button"
              :aria-label="`Select ${layer.name}`"
              :aria-pressed="layer.id === activeLayerId"
              @click="activeLayerId = layer.id"
            >
              <span class="layer-thumb">
                <PreviewCanvas :frame-id="activeFrameId" :layer-id="layer.id" :size="38" />
              </span>
            </button>
            <span class="layer-meta">
              <input
                v-if="layerEditingId === layer.id"
                v-model="nameDraft"
                :data-layer-name-input="layer.id"
                type="text"
                maxlength="64"
                aria-label="Layer name"
                @click.stop
                @blur="commitRename(layer.id)"
                @keydown.enter.prevent="commitRename(layer.id)"
                @keydown.escape.prevent="cancelRename"
              />
              <button
                v-else
                type="button"
                class="layer-name-button"
                :aria-label="`Select ${layer.name}`"
                :aria-pressed="layer.id === activeLayerId"
                @click="activeLayerId = layer.id"
                @dblclick="startRename(layer.id)"
              >
                <strong>{{ layer.name }}</strong>
              </button>
              <small>{{ Math.round(layer.opacity * 100) }}% · Normal</small>
            </span>
          </div>

          <button
            v-tooltip="{
              text: 'Rename layer',
              detail: 'Give the selected layer a clear production name.',
              shortcut: 'F2',
              placement: 'left',
            }"
            type="button"
            class="layer-rename"
            :aria-label="`Rename ${layer.name}`"
            @click="startRename(layer.id)"
          >
            <PencilLine :size="13" />
          </button>

          <input
            :value="layer.opacity"
            class="opacity-slider"
            type="range"
            min="0"
            max="1"
            step="0.05"
            :aria-label="`${layer.name} opacity`"
            @change="setLayerOpacity(layer.id, Number(($event.target as HTMLInputElement).value))"
          />
        </article>
      </div>

      <button
        v-tooltip="{
          text: 'Delete layer',
          detail: 'Remove the selected layer. At least one layer must remain.',
          shortcut: 'Shift+Delete',
          placement: 'left',
        }"
        type="button"
        class="danger-row"
        :disabled="project.layers.length === 1"
        @click="deleteLayer()"
      >
        <Trash2 :size="14" /> Delete selected layer
      </button>
      <section
        v-if="activeLayer?.kind === 'text'"
        class="text-layer-editor"
        aria-label="Text layer editor"
      >
        <span class="section-kicker"><PencilLine :size="14" /> Live text</span>
        <textarea v-model="textDraft" rows="3" maxlength="2048" aria-label="Text content" />
        <div class="text-layer-controls">
          <label
            >Size <input v-model.number="textSizeDraft" type="number" min="1" max="256"
          /></label>
          <label
            >Align
            <select v-model="textAlignDraft">
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select></label
          >
        </div>
        <button type="button" class="secondary-button" @click="applyTextDraft">
          Apply text changes
        </button>
        <button type="button" class="secondary-button" @click="rasterizeText(activeLayer.id)">
          Rasterize text
        </button>
      </section>
    </section>
  </aside>
</template>
