<script setup lang="ts">
import { FilePlus2, Plus, X } from '@lucide/vue'

const emit = defineEmits<{
  activate: [documentId: string]
  close: [documentId: string]
  new: []
}>()

const { documents, activeDocumentId } = useEditor()
const visibleDocuments = computed(() => documents.value.filter((document) => !document.placeholder))
const contextMenu = ref<{ documentId: string; x: number; y: number } | null>(null)

const openContextMenu = (event: MouseEvent, documentId: string) => {
  event.preventDefault()
  event.stopPropagation()
  contextMenu.value = {
    documentId,
    x: Math.max(8, Math.min(event.clientX, window.innerWidth - 208)),
    y: Math.max(8, Math.min(event.clientY, window.innerHeight - 96)),
  }
}

const closeContextMenu = () => (contextMenu.value = null)
const closeFromMenu = () => {
  if (!contextMenu.value) return
  emit('close', contextMenu.value.documentId)
  closeContextMenu()
}
const createFromMenu = () => {
  emit('new')
  closeContextMenu()
}

onMounted(() => window.addEventListener('pointerdown', closeContextMenu))
onBeforeUnmount(() => window.removeEventListener('pointerdown', closeContextMenu))
</script>

<template>
  <div class="document-tabs" aria-label="Open sprite documents">
    <div class="document-tab-list" role="tablist">
      <span v-if="!visibleDocuments.length" class="document-empty-tab">No document open</span>
      <div
        v-for="document in visibleDocuments"
        :key="document.id"
        class="document-tab"
        :class="{ active: document.id === activeDocumentId }"
        @contextmenu="openContextMenu($event, document.id)"
      >
        <button
          type="button"
          role="tab"
          :aria-selected="document.id === activeDocumentId"
          :tabindex="document.id === activeDocumentId ? 0 : -1"
          :title="document.project.name"
          @click="emit('activate', document.id)"
        >
          <span class="document-pixel" aria-hidden="true" />
          <span>{{ document.project.name }}</span>
        </button>
        <button
          type="button"
          class="document-close"
          :aria-label="`Close ${document.project.name}`"
          @click="emit('close', document.id)"
        >
          <X :size="12" />
        </button>
      </div>
    </div>
    <button
      type="button"
      class="document-new"
      aria-label="Create another sprite"
      @click="emit('new')"
    >
      <Plus :size="14" />
    </button>
    <Teleport to="body">
      <div
        v-if="contextMenu"
        class="panel-context-menu document-context-menu"
        :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
        role="menu"
        aria-label="Document actions"
        @pointerdown.stop
        @contextmenu.prevent
      >
        <button type="button" role="menuitem" @click="createFromMenu">
          <FilePlus2 :size="13" /><span>New sprite</span><kbd>Ctrl N</kbd>
        </button>
        <button type="button" role="menuitem" @click="closeFromMenu">
          <X :size="13" /><span>Close document</span><kbd>Ctrl W</kbd>
        </button>
      </div>
    </Teleport>
  </div>
</template>
