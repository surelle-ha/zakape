import { animate } from 'motion/mini'
import type { DirectiveBinding } from 'vue'

type MotionPreset = 'drawer' | 'surface'

const presets: Record<MotionPreset, { from: string; duration: number }> = {
  drawer: { from: 'translate3d(18px, 0, 0)', duration: 0.18 },
  surface: { from: 'translate3d(0, 8px, 0) scale(0.992)', duration: 0.22 },
}

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const resolvePreset = (binding: DirectiveBinding<MotionPreset>) =>
  presets[binding.value] ?? presets.surface

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive<HTMLElement, MotionPreset>('motion-enter', {
    beforeMount(element, binding) {
      if (reduceMotion()) return
      const preset = resolvePreset(binding)
      element.style.opacity = '0'
      element.style.transform = preset.from
    },
    mounted(element, binding) {
      if (reduceMotion()) return
      const preset = resolvePreset(binding)
      element.dataset.motionEngine = 'motion'
      element.style.willChange = 'opacity, transform'
      const playback = animate(
        element,
        {
          opacity: [0, 1],
          transform: [preset.from, 'translate3d(0, 0, 0) scale(1)'],
        },
        {
          duration: preset.duration,
          ease: [0.22, 1, 0.36, 1],
        },
      )
      void playback.finished.finally(() => {
        element.style.removeProperty('opacity')
        element.style.removeProperty('transform')
        element.style.removeProperty('will-change')
      })
    },
  })
})
