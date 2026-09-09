<script setup lang="ts">
import { GripVertical, LockKeyhole } from '@lucide/vue'
import type { ToolId, ToolboxPreference } from '~/types/editor'
import { toolDefinitions } from '~/utils/commands'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; applied: [] }>()
const { activeTool } = useEditor()
const { applied, persist, isRequired, defaults } = useToolboxSettings()
const draft = ref<ToolboxPreference>(defaults())
const saving = ref(false)
const error = ref('')
const dragged = ref<ToolId | null>(null)
const pointerDragged = ref<ToolId | null>(null)
const definition = (id: ToolId) => toolDefinitions.find((tool) => tool.id === id)!
const copyPreference = (value: ToolboxPreference): ToolboxPreference => ({
  version: 1,
  knownToolIds: [...value.knownToolIds],
  order: [...value.order],
  visibleToolIds: [...value.visibleToolIds],
})
const move = (id: ToolId, offset: number) => {
  const index = draft.value.order.indexOf(id)
  const target = Math.max(0, Math.min(draft.value.order.length - 1, index + offset))
  if (index === target) return
  const next = [...draft.value.order]
  next.splice(index, 1)
  next.splice(target, 0, id)
  draft.value = { ...draft.value, order: next }
}
const drop = (target: ToolId) => {
  if (!dragged.value || dragged.value === target) return
  const from = draft.value.order.indexOf(dragged.value)
  const to = draft.value.order.indexOf(target)
  const next = [...draft.value.order]
  const [item] = next.splice(from, 1)
  if (item) next.splice(to, 0, item)
  draft.value = { ...draft.value, order: next }
  dragged.value = null
}
const beginPointerDrag = (event: PointerEvent, id: ToolId) => {
  if (event.pointerType === 'mouse') return
  pointerDragged.value = id
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}
const movePointerDrag = (event: PointerEvent) => {
  if (!pointerDragged.value) return
  event.preventDefault()
  const target = document
    .elementFromPoint(event.clientX, event.clientY)
    ?.closest<HTMLElement>('[data-tool-id]')
  const targetId = target?.dataset.toolId as ToolId | undefined
  if (!targetId || targetId === pointerDragged.value) return
  dragged.value = pointerDragged.value
  drop(targetId)
  dragged.value = pointerDragged.value
}
const endPointerDrag = () => {
  pointerDragged.value = null
  dragged.value = null
}
const restore = () => (draft.value = defaults())
const close = () => {
  draft.value = copyPreference(applied.value)
  error.value = ''
  emit('close')
}
const apply = async () => {
  saving.value = true
  try {
    const next = await persist(draft.value)
    if (!next.visibleToolIds.includes(activeTool.value)) activeTool.value = 'pencil'
    emit('applied')
    emit('close')
  } catch {
    error.value = 'Zakape could not save the toolbox yet. Try again.'
  } finally {
    saving.value = false
  }
}
watch(
  () => props.open,
  (open) => {
    if (open) {
      draft.value = copyPreference(applied.value)
      error.value = ''
    }
  },
)
</script>

<template>
  <SettingsDialogShell
    :open="open"
    eyebrow="Tool rail"
    title="Toolbox Editor"
    description="Keep the tools you use close, and leave the rest available through shortcuts."
    :busy="saving"
    @close="close"
    @apply="apply"
    @restore="restore"
  >
    <div class="toolbox-editor-layout">
      <ol class="toolbox-order" aria-label="Toolbox order">
        <li
          v-for="id in draft.order"
          :key="id"
          :data-tool-id="id"
          :class="{ dragging: dragged === id || pointerDragged === id }"
          @dragover.prevent
          @drop="drop(id)"
        >
          <span
            class="drag-grip"
            role="button"
            tabindex="0"
            draggable="true"
            :aria-label="`Drag ${definition(id).label} to reorder`"
            @dragstart.stop="dragged = id"
            @dragend="dragged = null"
            @pointerdown="beginPointerDrag($event, id)"
            @pointermove="movePointerDrag"
            @pointerup="endPointerDrag"
            @pointercancel="endPointerDrag"
            @keydown.up.prevent="move(id, -1)"
            @keydown.down.prevent="move(id, 1)"
            ><GripVertical :size="15" aria-hidden="true"
          /></span>
          <span
            ><strong>{{ definition(id).label }}</strong
            ><small>{{ definition(id).shortcut }}</small></span
          >
          <label class="tool-visibility"
            ><input
              v-model="draft.visibleToolIds"
              type="checkbox"
              :value="id"
              :disabled="isRequired(id)"
            /><span>{{ draft.visibleToolIds.includes(id) ? 'Shown' : 'Hidden' }}</span></label
          >
          <LockKeyhole v-if="isRequired(id)" :size="13" aria-label="Required tool" />
        </li>
      </ol>
      <aside class="toolbox-miniature" aria-label="Tool rail preview">
        <span>Preview</span
        ><i
          v-for="id in draft.order.filter((toolId) => draft.visibleToolIds.includes(toolId))"
          :key="id"
          :title="definition(id).label"
          >{{ definition(id).shortcut }}</i
        >
      </aside>
    </div>
    <p v-if="error" class="settings-error" role="alert">{{ error }}</p>
  </SettingsDialogShell>
</template>
