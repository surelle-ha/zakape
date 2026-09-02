interface TooltipBinding {
  text: string
  detail?: string
  shortcut?: string
  placement?: 'top' | 'right' | 'bottom' | 'left'
}

type TooltipElement = HTMLElement & { __zakapeTooltip?: TooltipBinding }

export default defineNuxtPlugin((nuxtApp) => {
  const tooltip = document.createElement('div')
  tooltip.id = 'zakape-tooltip'
  tooltip.className = 'zakape-tooltip'
  tooltip.setAttribute('role', 'tooltip')
  tooltip.hidden = true
  document.body.append(tooltip)

  let showTimer: number | null = null
  let active: TooltipElement | null = null

  const hide = () => {
    if (showTimer) window.clearTimeout(showTimer)
    showTimer = null
    active = null
    tooltip.hidden = true
  }

  const position = (element: HTMLElement, placement: TooltipBinding['placement']) => {
    const anchor = element.getBoundingClientRect()
    const bounds = tooltip.getBoundingClientRect()
    const gap = 8
    let left = anchor.left + anchor.width / 2 - bounds.width / 2
    let top = anchor.top - bounds.height - gap
    if (placement === 'right') {
      left = anchor.right + gap
      top = anchor.top + anchor.height / 2 - bounds.height / 2
    } else if (placement === 'bottom') {
      top = anchor.bottom + gap
    } else if (placement === 'left') {
      left = anchor.left - bounds.width - gap
      top = anchor.top + anchor.height / 2 - bounds.height / 2
    }
    tooltip.style.left = `${Math.max(8, Math.min(left, window.innerWidth - bounds.width - 8))}px`
    tooltip.style.top = `${Math.max(8, Math.min(top, window.innerHeight - bounds.height - 8))}px`
    tooltip.dataset.placement = placement ?? 'top'
  }

  const show = (element: TooltipElement) => {
    const value = element.__zakapeTooltip
    if (!value?.text) return
    if (showTimer) window.clearTimeout(showTimer)
    active = element
    showTimer = window.setTimeout(
      () => {
        if (active !== element) return
        tooltip.replaceChildren()
        const heading = document.createElement('strong')
        heading.textContent = value.text
        tooltip.append(heading)
        if (value.shortcut) {
          const shortcut = document.createElement('kbd')
          shortcut.textContent = value.shortcut
          tooltip.append(shortcut)
        }
        if (value.detail) {
          const detail = document.createElement('span')
          detail.textContent = value.detail
          tooltip.append(detail)
        }
        tooltip.hidden = false
        requestAnimationFrame(() => position(element, value.placement))
      },
      element.matches(':focus-visible') ? 80 : 420,
    )
  }

  nuxtApp.vueApp.directive('tooltip', {
    mounted(element: TooltipElement, binding) {
      element.__zakapeTooltip = binding.value as TooltipBinding
      element.setAttribute('aria-describedby', tooltip.id)
      element.addEventListener('mouseenter', () => show(element))
      element.addEventListener('mouseleave', hide)
      element.addEventListener('focus', () => show(element))
      element.addEventListener('blur', hide)
      element.addEventListener('pointerdown', hide)
    },
    updated(element: TooltipElement, binding) {
      element.__zakapeTooltip = binding.value as TooltipBinding
    },
    beforeUnmount(element: TooltipElement) {
      if (active === element) hide()
    },
  })

  window.addEventListener('keydown', (event) => event.key === 'Escape' && hide())
})
