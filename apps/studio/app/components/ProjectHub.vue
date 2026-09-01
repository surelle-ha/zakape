<script setup lang="ts">
import { ArrowRight, Clock3, FilePlus2, FolderOpen, HardDrive, Layers3 } from '@lucide/vue'
import type { WorkspaceProjectSummary } from '~/composables/useProjectRepository'

defineProps<{
  projects: WorkspaceProjectSummary[]
  workspaceDirectory: string
  loading?: boolean
}>()

const emit = defineEmits<{
  newProject: [size: number]
  openProject: [projectId: string]
  browse: []
}>()

const selectedSize = ref(32)
const sizes = [16, 32, 64]
const sprite = [
  '..m..m..',
  '...mm...',
  '..mmmm..',
  '.md..dm.',
  '.mmmmmm.',
  '..moom..',
  '..m..m..',
  '.mm..mm.',
]

const updatedLabel = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Saved project'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}
</script>

<template>
  <main class="project-hub" data-testid="project-hub">
    <section class="hub-hero">
      <div class="hub-copy">
        <span class="eyebrow">Project home</span>
        <h1>Make small worlds move.</h1>
        <p>
          Start a clean pixel canvas or reopen a sprite from Zakape’s dedicated working directory.
        </p>
      </div>
      <div class="hub-sprite-stage" aria-hidden="true">
        <span class="stage-label">FRAME 01 · 1×</span>
        <div class="hub-sprite">
          <template v-for="(row, y) in sprite" :key="y">
            <i v-for="(pixel, x) in row" :key="`${x}-${y}`" :class="[`pixel-${pixel}`]" />
          </template>
        </div>
        <span class="stage-cursor" />
      </div>
    </section>

    <section class="hub-actions" aria-label="Start a project">
      <article class="new-project-card">
        <header>
          <span class="hub-action-icon"><FilePlus2 :size="17" /></span>
          <div><strong>New sprite</strong><small>Square canvas · transparent</small></div>
        </header>
        <div class="size-options" role="group" aria-label="Canvas size">
          <button
            v-for="size in sizes"
            :key="size"
            type="button"
            :class="{ active: selectedSize === size }"
            :aria-pressed="selectedSize === size"
            @click="selectedSize = size"
          >
            {{ size }}<span>×{{ size }}</span>
          </button>
        </div>
        <button type="button" class="hub-primary" @click="emit('newProject', selectedSize)">
          Create sprite <ArrowRight :size="15" />
        </button>
      </article>

      <button type="button" class="open-project-card" @click="emit('browse')">
        <span class="hub-action-icon"><FolderOpen :size="18" /></span>
        <span><strong>Open a project</strong><small>Import a .zakape file</small></span>
        <ArrowRight :size="15" />
      </button>

      <div class="working-directory-card">
        <HardDrive :size="16" />
        <span
          ><small>Working directory</small><strong>{{ workspaceDirectory }}</strong></span
        >
      </div>
    </section>

    <section class="recent-projects" aria-labelledby="recent-heading">
      <header>
        <div>
          <span class="eyebrow">On this device</span>
          <h2 id="recent-heading">Recent projects</h2>
        </div>
        <span>{{ projects.length }} indexed</span>
      </header>

      <div v-if="loading" class="recent-empty" role="status" aria-live="polite">
        Indexing Documents/zakape…
      </div>
      <div v-else-if="projects.length" class="recent-grid">
        <button
          v-for="project in projects"
          :key="project.id"
          type="button"
          class="recent-card"
          @click="emit('openProject', project.id)"
        >
          <span class="recent-thumb" aria-hidden="true">
            <i /><i /><i /><i /><i /><i /><i /><i /><i />
          </span>
          <span class="recent-copy">
            <strong>{{ project.name }}</strong>
            <small
              >{{ project.width }}×{{ project.height }} · {{ project.frameCount }} frame{{
                project.frameCount === 1 ? '' : 's'
              }}</small
            >
          </span>
          <span class="recent-date"
            ><Clock3 :size="11" /> {{ updatedLabel(project.updatedAt) }}</span
          >
          <Layers3 :size="14" class="recent-arrow" />
        </button>
      </div>
      <div v-else class="recent-empty">
        <span class="empty-pixel" aria-hidden="true" />
        <strong>No saved sprites yet</strong>
        <p>Create a sprite and Zakape will keep its project file in Documents/zakape.</p>
      </div>
    </section>
  </main>
</template>
