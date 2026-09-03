<script setup lang="ts">
import { Eye, EyeOff, Layers3, PencilLine, Plus, Trash2 } from '@lucide/vue'

const {
  project,
  activeFrameId,
  activeLayerId,
  layerEditingId,
  addLayer,
  deleteLayer,
  toggleLayer,
  requestLayerRename,
  renameLayer,
  setLayerOpacity,
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
    </section>
  </aside>
</template>
