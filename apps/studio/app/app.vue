<script setup lang="ts">
const splashVisible = ref(true)
const updater = useAppUpdater()
const {
  authenticationRequired,
  initialize: initializeAccount,
  ready: accountReady,
} = useGoogleAccount()
const splashDurationMs = 4_800
let splashTimer: number | null = null

onMounted(() => {
  void updater.initialize()
  void initializeAccount()
  if (new URLSearchParams(window.location.search).get('splash') === 'hold') return
  splashTimer = window.setTimeout(() => (splashVisible.value = false), splashDurationMs)
})

onBeforeUnmount(() => {
  if (splashTimer) window.clearTimeout(splashTimer)
  updater.dispose()
})
</script>

<template>
  <div class="app-frame" @contextmenu.prevent>
    <AppTitleBar :menus-enabled="!splashVisible && accountReady && !authenticationRequired" />
    <div class="app-content">
      <div
        class="authenticated-content"
        :class="{ 'authentication-obscured': !accountReady || authenticationRequired }"
        :inert="!accountReady || authenticationRequired"
        :aria-hidden="!accountReady || authenticationRequired"
      >
        <NuxtPage />
      </div>
      <AuthenticationPage v-if="accountReady && authenticationRequired" />
    </div>
    <AppStatusBar v-if="accountReady && !authenticationRequired" />
    <AppUpdateDialog />
    <AppSplash :visible="splashVisible" />
  </div>
</template>
