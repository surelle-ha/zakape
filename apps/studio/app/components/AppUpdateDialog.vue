<script setup lang="ts">
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  RefreshCw,
  Rocket,
  ShieldCheck,
  X,
} from '@lucide/vue'

const {
  availableVersion,
  checkForUpdates,
  currentVersion,
  dialogOpen,
  errorMessage,
  installUpdate,
  progress,
  relaunchApp,
  releaseNotes,
  status,
} = useAppUpdater()
const closeButton = ref<HTMLButtonElement | null>(null)

const heading = computed(() => {
  if (status.value === 'checking') return 'Looking for updates'
  if (status.value === 'available') return `Zakape ${availableVersion.value}`
  if (status.value === 'downloading') return 'Installing update'
  if (status.value === 'ready') return 'Ready to relaunch'
  if (status.value === 'current') return 'You are up to date'
  if (status.value === 'error') return 'Update unavailable'
  return 'Desktop updates'
})

const close = () => {
  if (status.value === 'downloading') return
  dialogOpen.value = false
}

watch(dialogOpen, async (open) => {
  if (!open) return
  await nextTick()
  closeButton.value?.focus()
})
</script>

<template>
  <Teleport to="body">
    <div v-if="dialogOpen" class="update-backdrop" @click.self="close">
      <section
        class="update-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-heading"
        @keydown.esc="close"
      >
        <header>
          <span class="update-emblem" aria-hidden="true"><ShieldCheck :size="19" /></span>
          <div>
            <span class="eyebrow">Signed desktop updater</span>
            <h2 id="update-heading">{{ heading }}</h2>
          </div>
          <button
            ref="closeButton"
            type="button"
            aria-label="Close update dialog"
            :disabled="status === 'downloading'"
            @click="close"
          >
            <X :size="15" />
          </button>
        </header>

        <div class="update-copy" aria-live="polite">
          <template v-if="status === 'checking'">
            <RefreshCw class="update-state-icon spin" :size="22" />
            <p>Checking the latest signed release on GitHub.</p>
          </template>
          <template v-else-if="status === 'available'">
            <Download class="update-state-icon available" :size="22" />
            <p>
              Version {{ availableVersion }} is ready to download. The package signature will be
              verified before installation.
            </p>
            <pre v-if="releaseNotes">{{ releaseNotes }}</pre>
          </template>
          <template v-else-if="status === 'downloading'">
            <Download class="update-state-icon available" :size="22" />
            <p>Keep Zakape open while the verified package is downloaded and installed.</p>
            <div
              class="update-progress"
              role="progressbar"
              aria-label="Update installation"
              :aria-valuenow="progress"
              aria-valuemin="0"
              aria-valuemax="100"
            >
              <i :style="{ width: `${progress}%` }" />
            </div>
            <small>{{ progress }}%</small>
          </template>
          <template v-else-if="status === 'ready'">
            <Rocket class="update-state-icon available" :size="22" />
            <p>The update is installed. Relaunch Zakape to start the new version.</p>
          </template>
          <template v-else-if="status === 'current'">
            <CheckCircle2 class="update-state-icon current" :size="22" />
            <p>Zakape {{ currentVersion }} is the latest published version.</p>
          </template>
          <template v-else>
            <AlertTriangle class="update-state-icon error" :size="22" />
            <p>{{ errorMessage }}</p>
          </template>
        </div>

        <footer>
          <span>Current version {{ currentVersion }}</span>
          <button
            v-if="status === 'available'"
            type="button"
            class="button-primary"
            @click="installUpdate"
          >
            <Download :size="13" /> Download and install
          </button>
          <button
            v-else-if="status === 'ready'"
            type="button"
            class="button-primary"
            @click="relaunchApp"
          >
            <Rocket :size="13" /> Relaunch Zakape
          </button>
          <button
            v-else-if="status === 'error'"
            type="button"
            class="button-primary"
            @click="checkForUpdates(true)"
          >
            <RefreshCw :size="13" /> Try again
          </button>
          <button
            v-else-if="status === 'current' || status === 'unsupported'"
            type="button"
            class="button-secondary"
            @click="close"
          >
            Close
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
