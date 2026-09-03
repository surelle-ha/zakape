<script setup lang="ts">
const splashVisible = ref(true)
const updater = useAppUpdater()
const splashDurationMs = 4_800
let splashTimer: number | null = null

onMounted(() => {
  void updater.initialize()
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
    <AppTitleBar :menus-enabled="!splashVisible" />
    <div class="app-content"><NuxtPage /></div>
    <AppStatusBar />
    <AppUpdateDialog />
    <AppSplash :visible="splashVisible" />
  </div>
</template>
