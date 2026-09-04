<script setup lang="ts">
import { CircleUserRound, RefreshCw } from '@lucide/vue'

const { checkForUpdates, currentVersion, dialogOpen, status, statusLabel, supported } =
  useAppUpdater()
const { account, dialogOpen: accountDialogOpen } = useGoogleAccount()

const openUpdateStatus = () => {
  if (status.value === 'idle' || status.value === 'current' || status.value === 'error') {
    void checkForUpdates(true)
    return
  }
  dialogOpen.value = true
}
</script>

<template>
  <footer class="app-statusbar" aria-label="Application status">
    <div>
      <button
        type="button"
        class="statusbar-account"
        :aria-label="
          account ? `Account: ${account.name}` : 'Guest account. Optional desktop sign-in.'
        "
        @click="accountDialogOpen = true"
      >
        <CircleUserRound :size="10" />
        {{ account?.name || 'Guest' }}
      </button>
    </div>
    <div>
      <button
        v-if="supported || status !== 'idle'"
        type="button"
        class="statusbar-update"
        :class="{ active: status === 'available' || status === 'ready' }"
        :aria-label="statusLabel"
        @click="openUpdateStatus"
      >
        <RefreshCw :class="{ spin: status === 'checking' || status === 'downloading' }" :size="9" />
        {{ statusLabel }}
      </button>
      <span class="statusbar-version">v{{ currentVersion }}</span>
    </div>
  </footer>
</template>
