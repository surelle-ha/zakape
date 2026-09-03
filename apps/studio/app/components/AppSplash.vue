<script setup lang="ts">
import { animate, stagger } from 'animejs'
import zakapeBase from '../../../../assets/brand/zakape-base.png'

defineProps<{ visible: boolean }>()

const spriteElement = ref<HTMLImageElement | null>(null)
const copyElement = ref<HTMLElement | null>(null)
const progressElement = ref<HTMLElement | null>(null)
const statusElement = ref<HTMLElement | null>(null)
const animations: ReturnType<typeof animate>[] = []

onMounted(async () => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  await nextTick()

  if (spriteElement.value) {
    animations.push(
      animate(spriteElement.value, {
        opacity: { from: 0 },
        scale: { from: 0.72 },
        rotate: { from: '-3deg' },
        duration: 430,
        ease: 'outBack',
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
        <img
          ref="spriteElement"
          class="splash-sprite"
          :src="zakapeBase"
          width="72"
          height="72"
          fetchpriority="high"
          alt=""
        />
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
