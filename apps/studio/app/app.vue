<script setup lang="ts">
const splashVisible = ref(true)
let splashTimer: number | null = null

onMounted(() => {
  if (new URLSearchParams(window.location.search).get('splash') === 'hold') return
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  splashTimer = window.setTimeout(() => (splashVisible.value = false), reducedMotion ? 350 : 1100)
})

onBeforeUnmount(() => {
  if (splashTimer) window.clearTimeout(splashTimer)
})
</script>

<template>
  <div class="app-frame" @contextmenu.prevent>
    <AppTitleBar :menus-enabled="!splashVisible" />
    <div class="app-content"><NuxtPage /></div>
    <AppSplash :visible="splashVisible" />
  </div>
</template>
