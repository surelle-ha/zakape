import type { ArtOperation, FrameArtEdit, Pixel, SpriteProject, ToolId } from '~/types/editor'
import { cloneProject, createDemoProject, emptyPixels, makeId, normalizeHex } from '~/utils/project'

const HISTORY_LIMIT = 60

export const useEditor = () => {
  const project = useState<SpriteProject>('editor-project', createDemoProject)
  const activeFrameId = useState<string>('active-frame', () => project.value.frames[0]!.id)
  const activeLayerId = useState<string>('active-layer', () => project.value.layers.at(-1)!.id)
  const activeTool = useState<ToolId>('active-tool', () => 'pencil')
  const primaryColor = useState<string>('primary-color', () => '#ff875f')
  const brushSize = useState<number>('brush-size', () => 1)
  const zoom = useState<number>('canvas-zoom', () => 14)
  const showGrid = useState<boolean>('show-grid', () => true)
  const onionSkin = useState<boolean>('onion-skin', () => true)
  const history = useState<SpriteProject[]>('editor-history', () => [])
  const future = useState<SpriteProject[]>('editor-future', () => [])
  const dirtyRevision = useState<number>('dirty-revision', () => 0)
  const lastAction = useState<string>('last-action', () => 'Project ready')

  const activeFrame = computed(() =>
    project.value.frames.find((frame) => frame.id === activeFrameId.value),
  )
  const activeLayer = computed(() =>
    project.value.layers.find((layer) => layer.id === activeLayerId.value),
  )
  const activePixels = computed(
    () =>
      activeLayer.value?.cels[activeFrameId.value] ??
      emptyPixels(project.value.width, project.value.height),
  )
  const canUndo = computed(() => history.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  const touch = (action: string) => {
    project.value.updatedAt = new Date().toISOString()
    dirtyRevision.value += 1
    lastAction.value = action
  }

  const checkpoint = (action: string) => {
    history.value.push(cloneProject(project.value))
    if (history.value.length > HISTORY_LIMIT) history.value.shift()
    future.value = []
    lastAction.value = action
  }

  const replaceProject = (next: SpriteProject, action = 'Project opened') => {
    project.value = cloneProject(next)
    activeFrameId.value = project.value.frames[0]!.id
    activeLayerId.value = project.value.layers.at(-1)!.id
    history.value = []
    future.value = []
    touch(action)
  }

  const beginStroke = () =>
    checkpoint(activeTool.value === 'eraser' ? 'Erase stroke' : 'Paint stroke')

  const paintPixel = (x: number, y: number, color: Pixel = primaryColor.value) => {
    const pixels = activeLayer.value?.cels[activeFrameId.value]
    if (!pixels) return
    const radius = Math.floor((brushSize.value - 1) / 2)
    for (let offsetY = -radius; offsetY < brushSize.value - radius; offsetY += 1) {
      for (let offsetX = -radius; offsetX < brushSize.value - radius; offsetX += 1) {
        const targetX = x + offsetX
        const targetY = y + offsetY
        if (
          targetX >= 0 &&
          targetY >= 0 &&
          targetX < project.value.width &&
          targetY < project.value.height
        ) {
          pixels[targetY * project.value.width + targetX] = color
        }
      }
    }
    dirtyRevision.value += 1
  }

  const endStroke = () => touch(activeTool.value === 'eraser' ? 'Erased pixels' : 'Painted pixels')

  const pickColor = (x: number, y: number) => {
    for (const layer of [...project.value.layers].reverse()) {
      if (!layer.visible) continue
      const pixel = layer.cels[activeFrameId.value]?.[y * project.value.width + x]
      if (pixel) {
        primaryColor.value = pixel
        lastAction.value = `Picked ${pixel}`
        return
      }
    }
  }

  const floodFill = (x: number, y: number, color: Pixel) => {
    const pixels = activeLayer.value?.cels[activeFrameId.value]
    if (!pixels) return
    const target = pixels[y * project.value.width + x]
    if (target === color) return
    checkpoint('Fill area')
    const queue: Array<[number, number]> = [[x, y]]
    const visited = new Set<string>()
    while (queue.length) {
      const [currentX, currentY] = queue.shift()!
      const key = `${currentX}:${currentY}`
      if (visited.has(key)) continue
      visited.add(key)
      if (
        currentX < 0 ||
        currentY < 0 ||
        currentX >= project.value.width ||
        currentY >= project.value.height ||
        pixels[currentY * project.value.width + currentX] !== target
      ) {
        continue
      }
      pixels[currentY * project.value.width + currentX] = color
      queue.push(
        [currentX + 1, currentY],
        [currentX - 1, currentY],
        [currentX, currentY + 1],
        [currentX, currentY - 1],
      )
    }
    touch('Filled area')
  }

  const drawLine = (fromX: number, fromY: number, toX: number, toY: number) => {
    checkpoint('Draw line')
    let x = fromX
    let y = fromY
    const deltaX = Math.abs(toX - fromX)
    const deltaY = -Math.abs(toY - fromY)
    const stepX = fromX < toX ? 1 : -1
    const stepY = fromY < toY ? 1 : -1
    let error = deltaX + deltaY
    while (true) {
      paintPixel(x, y)
      if (x === toX && y === toY) break
      const doubleError = 2 * error
      if (doubleError >= deltaY) {
        error += deltaY
        x += stepX
      }
      if (doubleError <= deltaX) {
        error += deltaX
        y += stepY
      }
    }
    touch('Drew line')
  }

  const drawRectangle = (fromX: number, fromY: number, toX: number, toY: number) => {
    checkpoint('Draw rectangle')
    const left = Math.min(fromX, toX)
    const right = Math.max(fromX, toX)
    const top = Math.min(fromY, toY)
    const bottom = Math.max(fromY, toY)
    for (let x = left; x <= right; x += 1) {
      paintPixel(x, top)
      paintPixel(x, bottom)
    }
    for (let y = top; y <= bottom; y += 1) {
      paintPixel(left, y)
      paintPixel(right, y)
    }
    touch('Drew rectangle')
  }

  const undo = () => {
    const previous = history.value.pop()
    if (!previous) return
    future.value.push(cloneProject(project.value))
    project.value = previous
    touch('Undo')
  }

  const redo = () => {
    const next = future.value.pop()
    if (!next) return
    history.value.push(cloneProject(project.value))
    project.value = next
    touch('Redo')
  }

  const addFrame = (duplicate = false) => {
    checkpoint(duplicate ? 'Duplicate frame' : 'Add frame')
    const frameId = makeId('frame')
    const currentFrame = activeFrame.value
    project.value.frames.push({
      id: frameId,
      name: `F${project.value.frames.length + 1}`,
      duration: currentFrame?.duration ?? 120,
    })
    project.value.layers.forEach((layer) => {
      layer.cels[frameId] = duplicate
        ? [
            ...(layer.cels[activeFrameId.value] ??
              emptyPixels(project.value.width, project.value.height)),
          ]
        : emptyPixels(project.value.width, project.value.height)
    })
    activeFrameId.value = frameId
    touch(duplicate ? 'Duplicated frame' : 'Added frame')
  }

  const deleteFrame = (frameId = activeFrameId.value) => {
    if (project.value.frames.length === 1) return
    checkpoint('Delete frame')
    const index = project.value.frames.findIndex((frame) => frame.id === frameId)
    project.value.frames.splice(index, 1)
    project.value.layers.forEach((layer) => Reflect.deleteProperty(layer.cels, frameId))
    activeFrameId.value = project.value.frames[Math.max(0, index - 1)]!.id
    touch('Deleted frame')
  }

  const addLayer = () => {
    checkpoint('Add layer')
    const id = makeId('layer')
    project.value.layers.push({
      id,
      name: `Layer ${project.value.layers.length + 1}`,
      visible: true,
      opacity: 1,
      cels: Object.fromEntries(
        project.value.frames.map((frame) => [
          frame.id,
          emptyPixels(project.value.width, project.value.height),
        ]),
      ),
    })
    activeLayerId.value = id
    touch('Added layer')
  }

  const deleteLayer = (layerId = activeLayerId.value) => {
    if (project.value.layers.length === 1) return
    checkpoint('Delete layer')
    const index = project.value.layers.findIndex((layer) => layer.id === layerId)
    project.value.layers.splice(index, 1)
    activeLayerId.value = project.value.layers[Math.max(0, index - 1)]!.id
    touch('Deleted layer')
  }

  const toggleLayer = (layerId: string) => {
    const layer = project.value.layers.find((item) => item.id === layerId)
    if (!layer) return
    checkpoint(layer.visible ? 'Hide layer' : 'Show layer')
    layer.visible = !layer.visible
    touch(layer.visible ? 'Layer shown' : 'Layer hidden')
  }

  const renameProject = (name: string) => {
    const clean = name.trim().slice(0, 64)
    if (!clean || clean === project.value.name) return
    checkpoint('Rename project')
    project.value.name = clean
    touch('Renamed project')
  }

  const applyOperations = (frameEdits: FrameArtEdit[], layerId = activeLayerId.value) => {
    const layer = project.value.layers.find((item) => item.id === layerId)
    const edits = frameEdits.filter(
      (frameEdit) =>
        frameEdit.operations.length > 0 &&
        project.value.frames.some((frame) => frame.id === frameEdit.frameId),
    )
    if (!layer || edits.length === 0) return
    checkpoint('Apply assistant proposal')
    edits.forEach((frameEdit) => {
      const pixels =
        layer.cels[frameEdit.frameId] ??
        (layer.cels[frameEdit.frameId] = emptyPixels(project.value.width, project.value.height))
      const set = (x: number, y: number, color: Pixel) => {
        if (x >= 0 && y >= 0 && x < project.value.width && y < project.value.height) {
          pixels[y * project.value.width + x] = color
        }
      }
      frameEdit.operations.forEach((operation: ArtOperation) => {
        if (operation.type === 'set_pixels') {
          operation.pixels.forEach((pixel) => set(pixel.x, pixel.y, pixel.color))
        } else if (operation.type === 'fill_rect' || operation.type === 'outline_rect') {
          for (let y = operation.y; y < operation.y + operation.height; y += 1) {
            for (let x = operation.x; x < operation.x + operation.width; x += 1) {
              if (
                operation.type === 'fill_rect' ||
                x === operation.x ||
                y === operation.y ||
                x === operation.x + operation.width - 1 ||
                y === operation.y + operation.height - 1
              ) {
                set(x, y, operation.color)
              }
            }
          }
        } else if (operation.type === 'replace_palette_color') {
          const from = normalizeHex(operation.from)
          pixels.forEach((pixel, index) => {
            if (pixel?.toLowerCase() === from) pixels[index] = operation.to
          })
        }
      })
    })
    touch(`Applied assistant edit to ${edits.length} frame${edits.length === 1 ? '' : 's'}`)
  }

  return {
    project,
    activeFrameId,
    activeLayerId,
    activeTool,
    primaryColor,
    brushSize,
    zoom,
    showGrid,
    onionSkin,
    dirtyRevision,
    lastAction,
    activeFrame,
    activeLayer,
    activePixels,
    canUndo,
    canRedo,
    checkpoint,
    replaceProject,
    beginStroke,
    paintPixel,
    endStroke,
    pickColor,
    floodFill,
    drawLine,
    drawRectangle,
    undo,
    redo,
    addFrame,
    deleteFrame,
    addLayer,
    deleteLayer,
    toggleLayer,
    renameProject,
    applyOperations,
  }
}
