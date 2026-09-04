<script setup lang="ts">
import { Check, FolderInput, Inbox } from '@lucide/vue'
import type { WorkspaceFolder } from '~/composables/useProjectRepository'

const props = defineProps<{
  projectId: string
  projectName: string
  folderId?: string | null
  folders: WorkspaceFolder[]
}>()

const emit = defineEmits<{ assign: [projectId: string, folderId: string | null] }>()
const root = ref<HTMLElement | null>(null)
const open = ref(false)
const folderLabel = computed(
  () => props.folders.find((folder) => folder.id === props.folderId)?.name ?? 'Unfiled',
)

const choose = (folderId: string | null) => {
  emit('assign', props.projectId, folderId)
  open.value = false
}

const closeOutside = (event: PointerEvent) => {
  if (open.value && root.value && !root.value.contains(event.target as Node)) open.value = false
}

const closeOnEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape') open.value = false
}

onMounted(() => {
  window.addEventListener('pointerdown', closeOutside, true)
  window.addEventListener('keydown', closeOnEscape)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', closeOutside, true)
  window.removeEventListener('keydown', closeOnEscape)
})
</script>

<template>
  <div ref="root" class="project-folder-picker" @click.stop>
    <button
      type="button"
      :aria-label="`Move ${projectName} to folder. Current folder: ${folderLabel}`"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="open = !open"
    >
      <FolderInput :size="12" /><span>{{ folderLabel }}</span>
    </button>
    <div v-if="open" class="project-folder-menu" role="menu" aria-label="Move project to folder">
      <button type="button" role="menuitemradio" :aria-checked="!folderId" @click="choose(null)">
        <Inbox :size="13" /><span>Unfiled</span><Check v-if="!folderId" :size="12" />
      </button>
      <button
        v-for="folder in folders"
        :key="folder.id"
        type="button"
        role="menuitemradio"
        :aria-checked="folderId === folder.id"
        @click="choose(folder.id)"
      >
        <span class="folder-menu-indent" :class="{ child: folder.parentId }" />
        <span>{{ folder.name }}</span
        ><Check v-if="folderId === folder.id" :size="12" />
      </button>
    </div>
  </div>
</template>
