export type Pixel = string | null
export type ColorMode = 'rgba' | 'grayscale' | 'indexed'
export type CanvasBackground = 'transparent' | 'black' | 'white'

export interface Frame {
  id: string
  name: string
  duration: number
}

export interface Layer {
  id: string
  name: string
  visible: boolean
  opacity: number
  cels: Record<string, Pixel[]>
}

export interface SpriteProject {
  version: 1
  id: string
  name: string
  width: number
  height: number
  colorMode: ColorMode
  background: CanvasBackground
  palette: string[]
  frames: Frame[]
  layers: Layer[]
  createdAt: string
  updatedAt: string
}

export type ToolId =
  'pencil' | 'mirror' | 'dither' | 'eraser' | 'fill' | 'picker' | 'line' | 'rectangle' | 'hand'

export interface PixelPoint {
  x: number
  y: number
}

export interface SetPixelsOperation {
  type: 'set_pixels'
  pixels: Array<PixelPoint & { color: string | null }>
}

export interface FillRectOperation {
  type: 'fill_rect' | 'outline_rect'
  x: number
  y: number
  width: number
  height: number
  color: string | null
}

export interface ReplaceColorOperation {
  type: 'replace_palette_color'
  from: string
  to: string | null
}

export type ArtOperation = SetPixelsOperation | FillRectOperation | ReplaceColorOperation

export type AssistantEditScope = 'frame' | 'sheet'

export interface FrameArtEdit {
  frameId: string
  operations: ArtOperation[]
}

export interface ArtProposal {
  summary: string
  scope: AssistantEditScope
  layerId: string
  frames: FrameArtEdit[]
}

export type ModelProvider = 'ollama' | 'openai-compatible'

export interface ModelConnection {
  provider: ModelProvider
  baseUrl: string
  model: string
  apiKey: string
}
