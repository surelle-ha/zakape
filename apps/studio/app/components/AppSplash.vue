<script setup lang="ts">
defineProps<{ visible: boolean }>()

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
</script>

<template>
  <Transition name="splash-fade">
    <section
      v-if="visible"
      class="app-splash"
      data-testid="app-splash"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label="Opening Zakape"
    >
      <div class="splash-field" aria-hidden="true" />
      <div class="splash-lockup">
        <div class="splash-sprite" aria-hidden="true">
          <template v-for="(row, y) in sprite" :key="y">
            <i v-for="(pixel, x) in row" :key="`${x}-${y}`" :class="[`pixel-${pixel}`]" />
          </template>
        </div>
        <div>
          <span>PIXEL WORKBENCH</span>
          <strong>ZAKAPE</strong>
          <p>Drawing a clean first frame.</p>
        </div>
        <div class="splash-progress" aria-hidden="true"><i /></div>
        <small>Preparing Documents/zakape</small>
      </div>
    </section>
  </Transition>
</template>
