<script setup lang="ts">
import { CircleUserRound, HardDriveDownload, RefreshCw } from '@lucide/vue'

const { currentVersion, dialogOpen, status, statusLabel } = useAppUpdater()
</script>

<template>
  <footer class="app-statusbar" aria-label="Application status">
    <div>
      <span class="statusbar-item"><CircleUserRound :size="10" /> Guest</span>
      <span
        class="statusbar-item backup-status"
        title="Projects are backed up in the local workspace"
      >
        <i /> <HardDriveDownload :size="10" /> Local backup
      </span>
    </div>
    <div>
      <button
        v-if="status !== 'idle'"
        type="button"
        class="statusbar-update"
        :class="{ active: status === 'available' || status === 'ready' }"
        :aria-label="statusLabel"
        @click="dialogOpen = true"
      >
        <RefreshCw :class="{ spin: status === 'checking' || status === 'downloading' }" :size="9" />
        {{ statusLabel }}
      </button>
      <span class="statusbar-version">v{{ currentVersion }}</span>
    </div>
  </footer>
</template>
