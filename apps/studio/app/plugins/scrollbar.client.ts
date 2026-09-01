export default defineNuxtPlugin(() => {
  const hideAfterMs = 900
  const timers = new WeakMap<Element, number>()

  document.addEventListener(
    'scroll',
    (event) => {
      const element = event.target instanceof Element ? event.target : document.documentElement
      element.classList.add('is-scrolling')
      const pending = timers.get(element)
      if (pending !== undefined) window.clearTimeout(pending)
      timers.set(
        element,
        window.setTimeout(() => {
          element.classList.remove('is-scrolling')
          timers.delete(element)
        }, hideAfterMs),
      )
    },
    { capture: true, passive: true },
  )
})
