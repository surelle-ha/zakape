<script setup lang="ts">
let cleanup: (() => void) | undefined

onMounted(async () => {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const { animate, inView } = await import('motion')
  const elements = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'))
  const stops: Array<() => void> = []
  const played = new WeakSet<Element>()
  for (const element of elements) {
    const stop = inView(
      element,
      () => {
        if (played.has(element)) return
        played.add(element)
        const delay = Number(element.dataset.revealDelay || 0)
        animate(
          element,
          {
            opacity: [0.72, 1],
            transform: ['translateY(18px)', 'translateY(0px)'],
          },
          { duration: 0.46, delay: Math.min(delay, 0.08), ease: [0.16, 1, 0.3, 1] },
        )
      },
      { amount: 0.16, margin: '0px 0px -8% 0px' },
    )
    stops.push(stop)
  }

  cleanup = () => {
    stops.forEach((stop) => stop())
  }
})

onBeforeUnmount(() => cleanup?.())
</script>

<template>
  <span class="sr-only" aria-hidden="true" />
</template>
