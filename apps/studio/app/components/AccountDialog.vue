<script setup lang="ts">
import {
  Brush,
  CalendarClock,
  Film,
  FolderOpen,
  Layers3,
  LoaderCircle,
  LogIn,
  LogOut,
  ShieldCheck,
  UserRound,
  X,
} from '@lucide/vue'
import type { WorkspaceProjectSummary } from '~/composables/useProjectRepository'

const props = defineProps<{
  open: boolean
  projects: WorkspaceProjectSummary[]
  workspaceDirectory: string
}>()

const emit = defineEmits<{ close: [] }>()
const { account, configuration, status, errorMessage, signIn, signOut } = useGoogleAccount()
const drawer = ref<HTMLElement | null>(null)
const totalFrames = computed(() =>
  props.projects.reduce((total, project) => total + project.frameCount, 0),
)
const totalCanvasPixels = computed(() =>
  props.projects.reduce((total, project) => total + project.width * project.height, 0),
)
const latestProject = computed(() => props.projects[0] ?? null)
const latestActivity = computed(() => {
  if (!latestProject.value) return 'No saved work yet'
  const date = new Date(latestProject.value.updatedAt)
  if (Number.isNaN(date.getTime())) return 'Saved locally'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
})
const compactPixelCount = computed(() =>
  new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(
    totalCanvasPixels.value,
  ),
)

const connectGoogle = async () => {
  await signIn()
}

const disconnect = async () => {
  await signOut()
  emit('close')
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    await nextTick()
    drawer.value?.focus()
  },
)
</script>

<template>
  <Teleport to="body">
    <Transition name="drawer-fade">
      <div v-if="open" class="profile-drawer-layer" @click.self="emit('close')">
        <section
          ref="drawer"
          v-motion-enter="'drawer'"
          class="profile-drawer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="profile-drawer-title"
          tabindex="-1"
        >
          <header class="profile-drawer-header">
            <div>
              <span class="eyebrow"><UserRound :size="12" /> Studio profile</span>
              <h2 id="profile-drawer-title">Account & artwork</h2>
            </div>
            <button type="button" aria-label="Close profile drawer" @click="emit('close')">
              <X :size="18" />
            </button>
          </header>

          <div class="profile-identity">
            <img v-if="account?.picture" :src="account.picture" width="58" height="58" alt="" />
            <span v-else class="profile-avatar"><UserRound :size="25" /></span>
            <div>
              <span>{{ account ? 'Google account' : 'Local workspace' }}</span>
              <strong>{{ account?.name || 'Guest artist' }}</strong>
              <small>{{ account?.email || 'No email connected' }}</small>
            </div>
            <span class="profile-connection"><i /> {{ account ? 'Connected' : 'Guest' }}</span>
          </div>

          <section class="profile-section" aria-labelledby="artwork-stats-heading">
            <header>
              <span><Brush :size="14" /> Artwork stats</span>
              <small>On this device</small>
            </header>
            <h3 id="artwork-stats-heading" class="sr-only">Artwork statistics</h3>
            <div class="profile-stat-grid">
              <article>
                <strong>{{ projects.length }}</strong
                ><span>projects</span>
              </article>
              <article>
                <strong>{{ totalFrames }}</strong
                ><span>frames</span>
              </article>
              <article>
                <strong>{{ compactPixelCount }}</strong
                ><span>canvas pixels</span>
              </article>
              <article>
                <strong>{{
                  projects.length ? Math.round(totalFrames / projects.length) : 0
                }}</strong
                ><span>frames / project</span>
              </article>
            </div>
          </section>

          <section class="profile-section profile-details" aria-label="Workspace details">
            <div>
              <span><FolderOpen :size="14" /> Workspace</span>
              <strong>{{ workspaceDirectory }}</strong>
            </div>
            <div>
              <span><CalendarClock :size="14" /> Latest activity</span>
              <strong>{{ latestActivity }}</strong>
            </div>
            <div>
              <span><Film :size="14" /> Latest sprite</span>
              <strong>{{ latestProject?.name || 'None yet' }}</strong>
            </div>
            <div>
              <span><Layers3 :size="14" /> Storage</span>
              <strong>Local files</strong>
            </div>
          </section>

          <div class="profile-privacy-note">
            <ShieldCheck :size="16" />
            <p>
              Account identity stays separate from your artwork. Signing in never uploads files.
            </p>
          </div>

          <p v-if="errorMessage" class="account-message error" role="alert">{{ errorMessage }}</p>

          <footer class="profile-actions">
            <button
              v-if="!account && configuration?.available"
              type="button"
              class="account-google-action"
              :disabled="status === 'loading'"
              @click="connectGoogle"
            >
              <LoaderCircle v-if="status === 'loading'" class="spin" :size="15" />
              <LogIn v-else :size="15" /> Connect Google
            </button>
            <button v-if="account" type="button" class="account-danger-action" @click="disconnect">
              <LogOut :size="15" /> Sign out
            </button>
            <small v-else>Guest access is active.</small>
          </footer>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
