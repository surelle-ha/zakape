export const DEFAULT_CANVAS_ZOOM = 14
export const MIN_CANVAS_ZOOM = 0.125

/** Adjusts the display scale without imposing an editor-level maximum. */
export const adjustCanvasZoom = (current: number, steps: number) => {
  const safeCurrent = Number.isFinite(current) && current > 0 ? current : DEFAULT_CANVAS_ZOOM
  const next = safeCurrent + steps
  return Math.max(MIN_CANVAS_ZOOM, Number(next.toPrecision(12)))
}

export const pinchCanvasZoom = (initial: number, distanceRatio: number) => {
  const safeRatio = Number.isFinite(distanceRatio) && distanceRatio > 0 ? distanceRatio : 1
  const safeInitial = Number.isFinite(initial) && initial > 0 ? initial : DEFAULT_CANVAS_ZOOM
  return Math.max(MIN_CANVAS_ZOOM, Number((safeInitial * safeRatio).toPrecision(12)))
}
