import type { Frame, Layer, SpriteProject } from '~/types/editor'
import { parseSpriteProject } from '~/utils/project'

interface ImportedSpritePayload {
  sourceHash: string
  name: string
  width: number
  height: number
  colorMode: SpriteProject['colorMode']
  palette: string[]
  frames: Frame[]
  layers: Layer[]
}

const isTauriRuntime = () => import.meta.client && '__TAURI_INTERNALS__' in window

export const importedSpriteProject = (payload: ImportedSpritePayload): SpriteProject => {
  const now = new Date().toISOString()
  const safeLayers = payload.layers.map((layer, index) => ({
    ...layer,
    name: layer.name.trim() || `Imported layer ${index + 1}`,
  }))
  return parseSpriteProject({
    version: 1,
    id: `project_ase_${payload.sourceHash}`,
    name: payload.name || 'Imported sprite',
    width: payload.width,
    height: payload.height,
    colorMode: payload.colorMode,
    background: 'transparent',
    palette: payload.palette,
    frames: payload.frames,
    layers: safeLayers,
    createdAt: now,
    updatedAt: now,
  })
}

export const importProjectFile = async (file: File): Promise<SpriteProject> => {
  if (file.size > 32 * 1024 * 1024) {
    throw new Error("That project exceeds Zakape's 32 MB project limit.")
  }
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'zakape' || extension === 'json') {
    return parseSpriteProject(JSON.parse(await file.text()))
  }
  if (!['ase', 'aseprite'].includes(extension ?? '')) {
    throw new Error('Choose a .zakape, .ase, or .aseprite project file.')
  }
  if (!isTauriRuntime()) {
    throw new Error('Binary sprite import is available in the Zakape desktop app.')
  }

  const { invoke } = await import('@tauri-apps/api/core')
  const bytes = Array.from(new Uint8Array(await file.arrayBuffer()))
  const payload = await invoke<ImportedSpritePayload>('import_aseprite_project', {
    bytes,
    fileName: file.name,
  })
  return importedSpriteProject(payload)
}
