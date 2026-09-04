<script setup lang="ts">
import { Check, Folder, FolderPlus, Inbox, Layers3, Plus, X } from '@lucide/vue'
import type { WorkspaceFolder, WorkspaceProjectSummary } from '~/composables/useProjectRepository'

const props = defineProps<{
  folders: WorkspaceFolder[]
  projects: WorkspaceProjectSummary[]
}>()

const { activeLibraryFolder, createWorkspaceFolder } = useProjectRepository()
const creatingFor = ref<string | null | undefined>(undefined)
const folderName = ref('')
const folderInput = ref<HTMLInputElement | null>(null)
const formError = ref('')
const submitting = ref(false)

interface FolderRow extends WorkspaceFolder {
  depth: number
}

const folderRows = computed<FolderRow[]>(() => {
  const rows: FolderRow[] = []
  const visited = new Set<string>()
  const append = (parentId: string | null, depth: number) => {
    props.folders
      .filter((folder) => folder.parentId === parentId && !visited.has(folder.id))
      .sort((left, right) => left.name.localeCompare(right.name))
      .forEach((folder) => {
        visited.add(folder.id)
        rows.push({ ...folder, depth })
        append(folder.id, Math.min(depth + 1, 4))
      })
  }
  append(null, 0)
  props.folders
    .filter((folder) => !visited.has(folder.id))
    .forEach((folder) => rows.push({ ...folder, depth: 0 }))
  return rows
})

const descendants = (folderId: string) => {
  const ids = new Set([folderId])
  let changed = true
  while (changed) {
    changed = false
    props.folders.forEach((folder) => {
      if (folder.parentId && ids.has(folder.parentId) && !ids.has(folder.id)) {
        ids.add(folder.id)
        changed = true
      }
    })
  }
  return ids
}

const projectCount = (folderId: string) => {
  const ids = descendants(folderId)
  return props.projects.filter((project) => project.folderId && ids.has(project.folderId)).length
}

const beginCreate = async (parentId: string | null) => {
  if (submitting.value) return
  creatingFor.value = parentId
  folderName.value = ''
  formError.value = ''
  await nextTick()
  folderInput.value?.focus()
}

const cancelCreate = () => {
  if (submitting.value) return
  creatingFor.value = undefined
  folderName.value = ''
  formError.value = ''
}

const submitFolder = async () => {
  if (submitting.value) return
  submitting.value = true
  const submittedName = folderName.value
  try {
    const folder = await createWorkspaceFolder(submittedName, creatingFor.value ?? null)
    if (!folder) {
      formError.value = submittedName.trim()
        ? 'A folder with that name already exists here.'
        : 'Enter a folder name.'
      return
    }
    creatingFor.value = undefined
    folderName.value = ''
    formError.value = ''
  } finally {
    submitting.value = false
  }
}

const creatingParent = computed(() =>
  creatingFor.value ? props.folders.find((folder) => folder.id === creatingFor.value) : null,
)
</script>

<template>
  <aside class="project-folder-rail" aria-label="Project folders">
    <header>
      <span><Layers3 :size="13" /> Suites</span>
      <button
        v-tooltip="{
          text: 'New suite',
          detail: 'Group related sprites and variants in a folder.',
        }"
        type="button"
        aria-label="Create project folder"
        :disabled="submitting"
        @click="beginCreate(null)"
      >
        <FolderPlus :size="14" />
      </button>
    </header>

    <nav aria-label="Sprite suites">
      <button
        type="button"
        :class="{ active: activeLibraryFolder === 'all' }"
        @click="activeLibraryFolder = 'all'"
      >
        <Layers3 :size="14" /><span>All projects</span><small>{{ projects.length }}</small>
      </button>
      <button
        type="button"
        :class="{ active: activeLibraryFolder === 'unfiled' }"
        @click="activeLibraryFolder = 'unfiled'"
      >
        <Inbox :size="14" /><span>Unfiled</span
        ><small>{{ projects.filter((project) => !project.folderId).length }}</small>
      </button>

      <div
        v-for="folder in folderRows"
        :key="folder.id"
        class="project-folder-row"
        :style="{ '--folder-depth': folder.depth }"
      >
        <button
          type="button"
          :class="{ active: activeLibraryFolder === folder.id }"
          @click="activeLibraryFolder = folder.id"
        >
          <Folder :size="14" />
          <span>{{ folder.name }}</span>
          <small>{{ projectCount(folder.id) }}</small>
        </button>
        <button
          v-tooltip="{
            text: 'New subfolder',
            detail: `Create a nested sprite set inside ${folder.name}.`,
          }"
          type="button"
          :aria-label="`Create subfolder in ${folder.name}`"
          :disabled="submitting"
          @click="beginCreate(folder.id)"
        >
          <Plus :size="12" />
        </button>
      </div>
    </nav>

    <form
      v-if="creatingFor !== undefined"
      class="project-folder-form"
      :aria-busy="submitting"
      @submit.prevent="submitFolder"
    >
      <label>
        <span>{{ creatingParent ? `Inside ${creatingParent.name}` : 'New suite' }}</span>
        <input
          ref="folderInput"
          v-model="folderName"
          type="text"
          maxlength="48"
          autocomplete="off"
          :disabled="submitting"
          placeholder="Character variants"
          aria-label="Folder name"
          @keydown.escape.prevent="cancelCreate"
        />
      </label>
      <div>
        <button type="submit" :disabled="submitting"><Check :size="13" /> Create</button>
        <button
          type="button"
          aria-label="Cancel folder creation"
          :disabled="submitting"
          @click="cancelCreate"
        >
          <X :size="13" />
        </button>
      </div>
      <small v-if="formError" role="alert">{{ formError }}</small>
    </form>
  </aside>
</template>
