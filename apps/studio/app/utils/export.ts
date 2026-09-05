import { GIFEncoder, applyPalette, quantize } from 'gifenc'
import type { SpriteProject } from '~/types/editor'
import { drawProjectFrame } from '~/utils/render'

const isTauri = () => import.meta.client && '__TAURI_INTERNALS__' in window

const saveBytes = async (name: string, bytes: Uint8Array, mime: string) => {
  if (isTauri()) {
    const [{ save }, { writeFile }] = await Promise.all([
      import('@tauri-apps/plugin-dialog'),
      import('@tauri-apps/plugin-fs'),
    ])
    const path = await save({ defaultPath: name })
    if (path) await writeFile(path, bytes)
    return
  }
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer
  const blob = new Blob([arrayBuffer], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = name
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 500)
}

export const canvasToPngBytes = async (canvas: HTMLCanvasElement) => {
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('PNG encoding failed.'))),
      'image/png',
    ),
  )
  return new Uint8Array(await blob.arrayBuffer())
}

export const renderFrameCanvas = (project: SpriteProject, frameId: string, scale: number) => {
  const canvas = document.createElement('canvas')
  canvas.width = project.width * scale
  canvas.height = project.height * scale
  const context = canvas.getContext('2d')!
  drawProjectFrame(context, project, frameId, scale)
  return canvas
}

export const safeExportName = (name: string) =>
  name
    .trim()
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-|-$/g, '') || 'sprite'

export const exportCurrentPng = async (project: SpriteProject, frameId: string, scale = 1) => {
  const bytes = await canvasToPngBytes(renderFrameCanvas(project, frameId, scale))
  await saveBytes(`${safeExportName(project.name)}.png`, bytes, 'image/png')
}

export const renderCurrentPngBytes = async (project: SpriteProject, frameId: string, scale = 1) =>
  canvasToPngBytes(renderFrameCanvas(project, frameId, scale))

export const renderSpriteSheetPngBytes = async (project: SpriteProject, scale = 1) => {
  const canvas = document.createElement('canvas')
  canvas.width = project.width * project.frames.length * scale
  canvas.height = project.height * scale
  const context = canvas.getContext('2d')!
  project.frames.forEach((frame, index) => {
    context.save()
    context.translate(index * project.width * scale, 0)
    drawProjectFrame(context, project, frame.id, scale)
    context.restore()
  })
  return canvasToPngBytes(canvas)
}

export const exportSpriteSheet = async (project: SpriteProject, scale = 1) => {
  const base = safeExportName(project.name)
  await saveBytes(`${base}-sheet.png`, await renderSpriteSheetPngBytes(project, scale), 'image/png')
  const metadata = {
    image: `${base}-sheet.png`,
    frameWidth: project.width * scale,
    frameHeight: project.height * scale,
    frames: project.frames.map((frame, index) => ({
      name: frame.name,
      x: index * project.width * scale,
      y: 0,
      width: project.width * scale,
      height: project.height * scale,
      duration: frame.duration,
    })),
  }
  await saveBytes(
    `${base}-sheet.json`,
    new TextEncoder().encode(JSON.stringify(metadata, null, 2)),
    'application/json',
  )
}

export const exportProjectFile = async (project: SpriteProject) => {
  await saveBytes(
    `${safeExportName(project.name)}.zakape`,
    new TextEncoder().encode(JSON.stringify(project, null, 2)),
    'application/json',
  )
}

export const exportAnimatedGif = async (project: SpriteProject, scale = 1) => {
  const gif = GIFEncoder()
  project.frames.forEach((frame) => {
    const canvas = renderFrameCanvas(project, frame.id, scale)
    const context = canvas.getContext('2d')!
    const image = context.getImageData(0, 0, canvas.width, canvas.height)
    const palette = quantize(image.data, 256, { format: 'rgba4444' })
    const index = applyPalette(image.data, palette, 'rgba4444')
    gif.writeFrame(index, canvas.width, canvas.height, {
      palette,
      delay: frame.duration,
      transparent: true,
      repeat: 0,
    })
  })
  gif.finish()
  await saveBytes(`${safeExportName(project.name)}.gif`, gif.bytes(), 'image/gif')
}
