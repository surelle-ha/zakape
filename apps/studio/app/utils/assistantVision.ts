import type { AssistantEditScope, SpriteProject } from '~/types/editor'
import { canvasToPngBytes, renderFrameCanvas } from '~/utils/export'

const MAX_VISION_IMAGES = 4
const MAX_VISION_PIXELS = 2_097_152
const MAX_PREVIEW_SIDE = 512
const MAX_PREVIEW_SCALE = 8

export interface AssistantVisionPlan {
  frameIds: string[]
  scale: number
}

export interface AssistantVisionInput extends AssistantVisionPlan {
  images: string[]
}

const unique = (values: Array<string | undefined>) => [
  ...new Set(values.filter((value): value is string => Boolean(value))),
]

const sampleEvenly = (frameIds: string[], limit: number) => {
  if (frameIds.length <= limit) return frameIds
  if (limit === 1) return [frameIds[0]!]
  return unique(
    Array.from({ length: limit }, (_, index) => {
      const position = Math.round((index * (frameIds.length - 1)) / (limit - 1))
      return frameIds[position]
    }),
  )
}

export const assistantVisionScale = (width: number, height: number) =>
  Math.max(1, Math.min(MAX_PREVIEW_SCALE, Math.floor(MAX_PREVIEW_SIDE / Math.max(width, height))))

export const planAssistantVision = (
  project: SpriteProject,
  activeFrameId: string,
  scope: AssistantEditScope,
  createdFrameIds: string[] = [],
): AssistantVisionPlan => {
  const activeIndex = project.frames.findIndex((frame) => frame.id === activeFrameId)
  const orderedFrameIds = project.frames.map((frame) => frame.id)
  const candidates =
    scope === 'sheet'
      ? orderedFrameIds
      : unique([
          activeFrameId,
          ...createdFrameIds,
          orderedFrameIds[activeIndex - 1],
          orderedFrameIds[activeIndex + 1],
        ])
  const scale = assistantVisionScale(project.width, project.height)
  const pixelsPerImage = project.width * project.height * scale * scale
  const budgetedLimit = Math.max(
    1,
    Math.min(MAX_VISION_IMAGES, Math.floor(MAX_VISION_PIXELS / Math.max(1, pixelsPerImage))),
  )
  let frameIds = sampleEvenly(candidates, budgetedLimit)
  if (
    scope === 'sheet' &&
    candidates.includes(activeFrameId) &&
    !frameIds.includes(activeFrameId)
  ) {
    frameIds = unique([activeFrameId, ...frameIds]).slice(0, budgetedLimit)
    frameIds.sort((left, right) => candidates.indexOf(left) - candidates.indexOf(right))
  }
  return { frameIds, scale }
}

const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = ''
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  }
  return btoa(binary)
}

export const renderAssistantVision = async (
  project: SpriteProject,
  activeFrameId: string,
  scope: AssistantEditScope,
  createdFrameIds: string[] = [],
): Promise<AssistantVisionInput> => {
  const plan = planAssistantVision(project, activeFrameId, scope, createdFrameIds)
  const images = await Promise.all(
    plan.frameIds.map(async (frameId) => {
      const source = renderFrameCanvas(project, frameId, 1)
      const canvas = document.createElement('canvas')
      canvas.width = source.width * plan.scale
      canvas.height = source.height * plan.scale
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Zakape could not prepare rendered vision for the assistant.')
      context.imageSmoothingEnabled = false
      context.clearRect(0, 0, canvas.width, canvas.height)
      context.drawImage(source, 0, 0, canvas.width, canvas.height)
      return bytesToBase64(await canvasToPngBytes(canvas))
    }),
  )
  return { ...plan, images }
}
