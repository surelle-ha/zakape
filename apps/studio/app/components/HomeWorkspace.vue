<script setup lang="ts">
import {
  ArrowRight,
  Clock3,
  Download,
  FilePlus2,
  Film,
  FolderOpen,
  HardDrive,
  History,
  Layers3,
  Palette,
  ShieldCheck,
  Sparkles,
} from '@lucide/vue'
import type { WorkspaceProjectSummary } from '~/composables/useProjectRepository'
import zakapeMark from '../../../../assets/brand/zakape-icon.png'
import changelogSource from '../../../../CHANGELOG.md?raw'

const props = defineProps<{
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
const totalFrames = computed(() =>
  props.projects.reduce((total, project) => total + project.frameCount, 0),
)
const latestUpdate = computed(() =>
  props.projects[0] ? updatedLabel(props.projects[0].updatedAt) : 'Ready for a first canvas',
)

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

function updatedLabel(value: string) {
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
  <section v-motion-enter="'surface'" class="home-workspace" aria-label="Home workspace">
    <header class="home-hero">
      <div class="home-hero-copy">
        <span class="eyebrow">Your local sprite desk</span>
        <h1>Make the next frame count.</h1>
        <p>
          Reopen a canvas, shape a new motion study, or start clean. Every project stays close to
          the tools that made it.
        </p>
        <div class="home-actions">
          <button type="button" class="home-new-action" @click="emit('new')">
            <FilePlus2 :size="16" /> New sprite
          </button>
          <button type="button" class="home-open-action" @click="emit('browse')">
            <FolderOpen :size="16" /> Open file
          </button>
        </div>
      </div>

      <div class="home-brand-canvas" aria-hidden="true">
        <span class="home-brand-label">Active workspace</span>
        <img :src="zakapeMark" width="148" height="148" fetchpriority="high" alt="" />
        <div class="home-brand-swatches"><i /><i /><i /><i /></div>
        <small>{{ workspaceDirectory }}</small>
      </div>
    </header>

    <section class="home-ledger" aria-label="Workspace summary">
      <article>
        <HardDrive :size="15" />
        <span
          ><strong>{{ projects.length }}</strong
          ><small>local projects</small></span
        >
      </article>
      <article>
        <Film :size="15" />
        <span
          ><strong>{{ totalFrames }}</strong
          ><small>animation frames</small></span
        >
      </article>
      <article>
        <Clock3 :size="15" />
        <span
          ><strong>{{ latestUpdate }}</strong
          ><small>latest workspace activity</small></span
        >
      </article>
      <article>
        <ShieldCheck :size="15" />
        <span><strong>On device</strong><small>private by default</small></span>
      </article>
    </section>

    <div class="home-columns">
      <section class="home-recents" aria-labelledby="recent-work-heading">
        <header class="home-section-heading">
          <div>
            <span class="eyebrow"><Clock3 :size="12" /> Canvas shelf</span>
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
            <ProjectThumbnail class="home-recent-art" :preview="project.preview" />
            <span class="home-recent-copy">
              <span class="home-recent-meta">{{ updatedLabel(project.updatedAt) }}</span>
              <strong>{{ project.name }}</strong>
              <small>
                {{ project.width }} × {{ project.height }} · {{ project.frameCount }} frame{{
                  project.frameCount === 1 ? '' : 's'
                }}
              </small>
            </span>
            <ArrowRight :size="14" />
          </button>
        </div>
        <div v-else class="home-empty">
          <span class="empty-pixel" aria-hidden="true" />
          <strong>Your canvas shelf is ready</strong>
          <p>Create a sprite or open a project file. Its first frame will appear here.</p>
          <button type="button" @click="emit('new')">Create a sprite</button>
        </div>
      </section>

      <aside class="home-sidebar">
        <section class="home-changelog" aria-labelledby="changelog-heading">
          <header class="home-section-heading">
            <div>
              <span class="eyebrow"><History :size="12" /> Build notes</span>
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
              <li v-for="item in release.items.slice(0, 4)" :key="item">{{ item }}</li>
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
            <p>Connect your model only when you want a reviewable pixel pass.</p>
          </div>
        </section>
      </aside>
    </div>

    <section class="home-workflow" aria-labelledby="home-workflow-heading">
      <header>
        <span class="eyebrow">A complete sprite loop</span>
        <h2 id="home-workflow-heading">From first pixel to playback</h2>
      </header>
      <div>
        <article>
          <span><Palette :size="16" /></span>
          <div>
            <strong>Draw with intent</strong>
            <p>Pixel tools, mirror strokes, dither, and palettes stay one shortcut away.</p>
          </div>
          <kbd>P</kbd>
        </article>
        <article>
          <span><Layers3 :size="16" /></span>
          <div>
            <strong>Build in layers</strong>
            <p>Keep silhouettes, color, and detail separate without breaking frame timing.</p>
          </div>
          <kbd>F2</kbd>
        </article>
        <article>
          <span><Film :size="16" /></span>
          <div>
            <strong>Read the motion</strong>
            <p>Sequence frames, use onion skin, then preview the loop at its real cadence.</p>
          </div>
          <kbd>O</kbd>
        </article>
        <article>
          <span><Download :size="16" /></span>
          <div>
            <strong>Ship clean output</strong>
            <p>Export a frame, sprite sheet, GIF, or portable project when it is ready.</p>
          </div>
          <kbd>⇧E</kbd>
        </article>
      </div>
    </section>
  </section>
</template>
