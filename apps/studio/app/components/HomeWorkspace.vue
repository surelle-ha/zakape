<script setup lang="ts">
import {
  ArrowRight,
  Clock3,
  FilePlus2,
  FolderOpen,
  HardDrive,
  History,
  ShieldCheck,
  Sparkles,
} from '@lucide/vue'
import type { WorkspaceProjectSummary } from '~/composables/useProjectRepository'
import changelogSource from '../../../../CHANGELOG.md?raw'

defineProps<{
  projects: WorkspaceProjectSummary[]
  workspaceDirectory: string
  loading?: boolean
}>()

const emit = defineEmits<{
  new: []
  browse: []
  openProject: [projectId: string]
}>()

const { currentVersion } = useAppUpdater()

const releaseNotes = changelogSource
  .split(/^## /m)
  .slice(1, 3)
  .map((section) => {
    const [heading = '', ...lines] = section.split('\n')
    const headingMatch = heading.match(/\[?(\d+\.\d+\.\d+).*?\((\d{4}-\d{2}-\d{2})\)/)
    const date = headingMatch?.[2] ? new Date(headingMatch[2] + 'T00:00:00') : null
    return {
      version: headingMatch?.[1] ?? 'Unknown',
      date:
        date && !Number.isNaN(date.getTime())
          ? new Intl.DateTimeFormat(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            }).format(date)
          : 'Release notes',
      items: lines
        .filter((line) => /^\s*[*-]\s+/.test(line))
        .map((line) => {
          const item = line
            .trim()
            .replace(/^\s*[*-]\s+/, '')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/\s+\([a-f0-9]{7,}\)$/, '')
            .replace(/^\*\*([^*]+):\*\*\s*/, '$1: ')
          return item.charAt(0).toUpperCase() + item.slice(1)
        }),
    }
  })

const updatedLabel = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Saved locally'
  const elapsed = Date.now() - date.getTime()
  const days = Math.floor(elapsed / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return days + ' days ago'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date)
}
</script>

<template>
  <section class="home-workspace" aria-label="Home workspace">
    <header class="home-hero">
      <div class="home-hero-copy">
        <span class="eyebrow">Local sprite studio</span>
        <h1>Pick up the next frame.</h1>
        <p>Recent work, release notes, and your local workspace—one tab away from every sprite.</p>
      </div>
      <div class="home-actions">
        <button type="button" class="home-new-action" @click="emit('new')">
          <FilePlus2 :size="16" /> New sprite
        </button>
        <button type="button" class="home-open-action" @click="emit('browse')">
          <FolderOpen :size="16" /> Open file
        </button>
      </div>
      <div class="home-pixel-ribbon" aria-hidden="true">
        <i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
      </div>
    </header>

    <div class="home-columns">
      <section class="home-recents" aria-labelledby="recent-work-heading">
        <header class="home-section-heading">
          <div>
            <span class="eyebrow"><Clock3 :size="12" /> On this device</span>
            <h2 id="recent-work-heading">Recent work</h2>
          </div>
          <span>{{ projects.length }} indexed</span>
        </header>

        <div v-if="loading" class="home-empty" role="status">Indexing your workspace…</div>
        <div v-else-if="projects.length" class="home-recent-list">
          <button
            v-for="project in projects.slice(0, 8)"
            :key="project.id"
            type="button"
            class="home-recent-item"
            @click="emit('openProject', project.id)"
          >
            <span class="home-recent-art" aria-hidden="true">
              <i /><i /><i /><i /><i /><i /><i /><i /><i />
            </span>
            <span class="home-recent-copy">
              <strong>{{ project.name }}</strong>
              <small>
                {{ project.width }} × {{ project.height }} · {{ project.frameCount }} frame{{
                  project.frameCount === 1 ? '' : 's'
                }}
              </small>
            </span>
            <span class="home-recent-time">{{ updatedLabel(project.updatedAt) }}</span>
            <ArrowRight :size="14" />
          </button>
        </div>
        <div v-else class="home-empty">
          <span class="empty-pixel" aria-hidden="true" />
          <strong>Your next sprite starts here</strong>
          <p>Create a canvas or open a project file. Work stays on this device.</p>
          <button type="button" @click="emit('new')">Create a sprite</button>
        </div>
      </section>

      <aside class="home-sidebar">
        <section class="home-changelog" aria-labelledby="changelog-heading">
          <header class="home-section-heading">
            <div>
              <span class="eyebrow"><History :size="12" /> What changed</span>
              <h2 id="changelog-heading">Changelog</h2>
            </div>
            <span>v{{ currentVersion }}</span>
          </header>
          <article v-for="release in releaseNotes" :key="release.version" class="release-note">
            <header>
              <strong>v{{ release.version }}</strong
              ><time>{{ release.date }}</time>
            </header>
            <ul>
              <li v-for="item in release.items" :key="item">{{ item }}</li>
            </ul>
          </article>
        </section>

        <section class="home-workspace-card" aria-label="Workspace details">
          <span class="home-workspace-icon"><HardDrive :size="16" /></span>
          <div>
            <span class="eyebrow">Working directory</span>
            <strong>{{ workspaceDirectory }}</strong>
            <small><ShieldCheck :size="11" /> Local-first saves</small>
          </div>
        </section>

        <section class="home-assistant-note">
          <Sparkles :size="15" />
          <div>
            <strong>Assistant stays optional</strong>
            <p>Connect a local model only when you want a reviewable art pass.</p>
          </div>
        </section>
      </aside>
    </div>
  </section>
</template>
