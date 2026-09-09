<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'

const labels = ref<string[]>([])
const activeIndex = ref(0)

const sectionTarget = ref<(index: number) => void>(() => undefined)

let cleanup: (() => void) | undefined

onMounted(() => {
  const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-scroll-section]'))
  if (sections.length < 2) return

  labels.value = sections.map(
    (section, index) => section.dataset.scrollLabel || `Chapter ${index + 1}`,
  )
  const desktopPointer = window.matchMedia('(min-width: 1024px) and (pointer: fine)')
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let unlockTimer = 0
  let lockedUntil = 0

  const nearestIndex = () => {
    const viewportCenter = window.scrollY + window.innerHeight / 2
    return sections.reduce((nearest, section, index) => {
      const sectionCenter = section.offsetTop + section.offsetHeight / 2
      const nearestCenter = sections[nearest]!.offsetTop + sections[nearest]!.offsetHeight / 2
      return Math.abs(sectionCenter - viewportCenter) < Math.abs(nearestCenter - viewportCenter)
        ? index
        : nearest
    }, 0)
  }

  const updateActive = () => {
    activeIndex.value = nearestIndex()
  }

  const scheduleUnlock = () => {
    window.clearTimeout(unlockTimer)
    unlockTimer = window.setTimeout(
      () => {
        const remaining = lockedUntil - performance.now()
        if (remaining > 0) {
          scheduleUnlock()
          return
        }
        document.documentElement.classList.remove('site-section-moving')
      },
      Math.max(16, lockedUntil - performance.now()),
    )
  }

  const scrollToSection = (index: number) => {
    const section = sections[index]
    if (!section) return
    const target = Math.max(0, section.offsetTop)
    activeIndex.value = index
    document.documentElement.classList.add('site-section-moving')
    window.scrollTo({ top: target, behavior: reducedMotion.matches ? 'auto' : 'smooth' })
    lockedUntil = performance.now() + (reducedMotion.matches ? 120 : 850)
    scheduleUnlock()
  }
  sectionTarget.value = scrollToSection

  const onWheel = (event: WheelEvent) => {
    if (!desktopPointer.matches || event.ctrlKey || Math.abs(event.deltaY) < 4) return

    if (document.documentElement.classList.contains('site-section-moving')) {
      event.preventDefault()
      // Keep trackpad momentum from advancing through a second chapter after
      // the first transition has completed.
      lockedUntil = Math.max(lockedUntil, performance.now() + 180)
      scheduleUnlock()
      return
    }

    const direction = event.deltaY > 0 ? 1 : -1
    const target = nearestIndex() + direction
    if (!sections[target]) return

    event.preventDefault()
    scrollToSection(target)
  }

  const editable = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName))

  const onKeydown = (event: KeyboardEvent) => {
    if (
      !desktopPointer.matches ||
      editable(event.target) ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey
    )
      return
    const index = nearestIndex()
    let target: number | undefined

    if (['ArrowDown', 'PageDown'].includes(event.key)) target = index + 1
    else if (['ArrowUp', 'PageUp'].includes(event.key)) target = index - 1
    else if (event.key === 'Home') target = 0
    else if (event.key === 'End') target = sections.length - 1

    if (target === undefined || !sections[target]) return
    event.preventDefault()
    scrollToSection(target)
  }

  let frame = 0
  const onScroll = () => {
    cancelAnimationFrame(frame)
    frame = requestAnimationFrame(updateActive)
  }

  window.addEventListener('wheel', onWheel, { passive: false })
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('scroll', onScroll, { passive: true })
  updateActive()

  cleanup = () => {
    window.clearTimeout(unlockTimer)
    cancelAnimationFrame(frame)
    window.removeEventListener('wheel', onWheel)
    window.removeEventListener('keydown', onKeydown)
    window.removeEventListener('scroll', onScroll)
    document.documentElement.classList.remove('site-section-moving')
  }
})

onBeforeUnmount(() => cleanup?.())
</script>

<template>
  <nav v-if="labels.length" class="chapter-rail" aria-label="Page chapters">
    <button
      v-for="(label, index) in labels"
      :key="label"
      type="button"
      :class="{ active: activeIndex === index }"
      :aria-label="`Go to ${label}`"
      :aria-current="activeIndex === index ? 'step' : undefined"
      @click="sectionTarget(index)"
    >
      <span>{{ String(index + 1).padStart(2, '0') }}</span>
      <i />
      <small>{{ label }}</small>
    </button>
    <ChevronDown :size="12" aria-hidden="true" />
  </nav>
</template>
