<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'

type ScrollAnimation = { cancel: () => void }

const labels = ref<string[]>([])
const activeIndex = ref(0)

const goToSection = (index: number) => {
  const section = document.querySelectorAll<HTMLElement>('[data-scroll-section]')[index]
  section?.scrollIntoView({ behavior: 'smooth' })
}

let cleanup: (() => void) | undefined

onMounted(async () => {
  const sections = Array.from(document.querySelectorAll<HTMLElement>('[data-scroll-section]'))
  if (sections.length < 2) return

  labels.value = sections.map(
    (section, index) => section.dataset.scrollLabel || `Chapter ${index + 1}`,
  )
  const desktopPointer = window.matchMedia('(min-width: 1024px) and (pointer: fine)')
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const { animate } = await import('animejs')
  let animation: ScrollAnimation | undefined
  let lockedUntil = 0

  const topOffset = () => document.querySelector<HTMLElement>('.site-nav')?.offsetHeight ?? 0
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

  const scrollToSection = (index: number) => {
    const section = sections[index]
    if (!section) return
    const target = Math.max(0, section.offsetTop - topOffset())
    activeIndex.value = index
    animation?.cancel()

    if (reducedMotion.matches) {
      window.scrollTo(0, target)
      return
    }

    const tracker = { y: window.scrollY }
    document.documentElement.classList.add('site-section-moving')
    animation = animate(tracker, {
      y: target,
      duration: 920,
      ease: 'inOutQuart',
      onUpdate: () => window.scrollTo(0, tracker.y),
      onComplete: () => {
        window.scrollTo(0, target)
        lockedUntil = performance.now() + 180
        document.documentElement.classList.remove('site-section-moving')
      },
    })
  }

  const onWheel = (event: WheelEvent) => {
    if (!desktopPointer.matches || event.ctrlKey || Math.abs(event.deltaY) < 4) return
    if (
      performance.now() < lockedUntil ||
      document.documentElement.classList.contains('site-section-moving')
    ) {
      event.preventDefault()
      return
    }

    const index = nearestIndex()
    const section = sections[index]!
    const direction = event.deltaY > 0 ? 1 : -1
    const viewTop = window.scrollY + topOffset()
    const viewBottom = window.scrollY + window.innerHeight
    const atBoundary =
      direction > 0
        ? viewBottom >= section.offsetTop + section.offsetHeight - 4
        : viewTop <= section.offsetTop + 4

    if (!atBoundary || !sections[index + direction]) return
    event.preventDefault()
    scrollToSection(index + direction)
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
    animation?.cancel()
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
      @click="goToSection(index)"
    >
      <span>{{ String(index + 1).padStart(2, '0') }}</span>
      <i />
      <small>{{ label }}</small>
    </button>
    <ChevronDown :size="12" aria-hidden="true" />
  </nav>
</template>
