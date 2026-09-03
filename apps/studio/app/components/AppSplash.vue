<script setup lang="ts">
import { animate, stagger } from 'animejs'

defineProps<{ visible: boolean }>()

const spriteElement = ref<HTMLElement | null>(null)
const copyElement = ref<HTMLElement | null>(null)
const progressElement = ref<HTMLElement | null>(null)
const statusElement = ref<HTMLElement | null>(null)
const animations: ReturnType<typeof animate>[] = []

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

onMounted(async () => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  await nextTick()

  const pixels = spriteElement.value?.querySelectorAll<HTMLElement>('.pixel-m, .pixel-d, .pixel-o')
  if (pixels?.length) {
    animations.push(
      animate(pixels, {
        opacity: { from: 0 },
        scale: { from: 0.45 },
        delay: stagger(16, { grid: [8, 8], from: 'center' }),
        duration: 210,
        ease: 'outQuad',
      }),
    )
  }

  const details = [copyElement.value, progressElement.value, statusElement.value].filter(
    (element): element is HTMLElement => Boolean(element),
  )
  animations.push(
    animate(details, {
      opacity: { from: 0 },
      translateY: { from: '6px' },
      delay: stagger(55, { start: 90 }),
      duration: 280,
      ease: 'outCubic',
    }),
  )
})

onBeforeUnmount(() => animations.forEach((animation) => animation.revert()))
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
        <div ref="spriteElement" class="splash-sprite" aria-hidden="true">
          <template v-for="(row, y) in sprite" :key="y">
            <i v-for="(pixel, x) in row" :key="`${x}-${y}`" :class="[`pixel-${pixel}`]" />
          </template>
        </div>
        <div ref="copyElement">
          <span>PIXEL WORKBENCH</span>
          <strong>ZAKAPE</strong>
          <p>Drawing a clean first frame.</p>
        </div>
        <div ref="progressElement" class="splash-progress" aria-hidden="true"><i /></div>
        <small ref="statusElement">Preparing Documents/zakape</small>
      </div>
    </section>
  </Transition>
</template>
