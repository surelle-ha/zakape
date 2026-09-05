import type { SpriteProject } from '~/types/editor'
import { safeExportName } from '~/utils/export'

export type GodotCompatibility = 'godot4' | 'legacy' | 'unknown'
export type GodotResourceKind =
  | 'folder'
  | 'texture'
  | 'scene'
  | 'resource'
  | 'script'
  | 'audio'
  | 'font'
  | 'source'
  | 'data'
  | 'other'

export interface GodotProjectConnection {
  rootPath: string
  name: string
  configVersion: number | null
  godotVersion: string | null
  compatibility: GodotCompatibility
  availability?: 'ready' | 'missing'
}

export interface GodotResourceEntry {
  path: string
  name: string
  kind: GodotResourceKind
  isDirectory: boolean
  size: number
  modifiedAt: number | null
  importable: boolean
}

export interface GodotResourceIndex {
  entries: GodotResourceEntry[]
  truncated: boolean
}

export type GodotPublishKind = 'frame' | 'animation'

export interface GodotBreadcrumb {
  label: string
  path: string
}

export const joinGodotPath = (...parts: string[]) =>
  parts
    .flatMap((part) => part.split(/[\\/]/))
    .map((part) => part.trim())
    .filter(Boolean)
    .join('/')

export const parentGodotPath = (path: string) => {
  const normalized = joinGodotPath(path)
  const separator = normalized.lastIndexOf('/')
  return separator < 0 ? '' : normalized.slice(0, separator)
}

export const godotBreadcrumbs = (path: string): GodotBreadcrumb[] => {
  const parts = joinGodotPath(path).split('/').filter(Boolean)
  return [
    { label: 'res://', path: '' },
    ...parts.map((label, index) => ({
      label,
      path: parts.slice(0, index + 1).join('/'),
    })),
  ]
}

export const visibleGodotResources = (
  entries: GodotResourceEntry[],
  directory: string,
  query: string,
  kind: GodotResourceKind | 'all',
) => {
  const normalizedDirectory = joinGodotPath(directory)
  const normalizedQuery = query.trim().toLocaleLowerCase()
  return entries
    .filter((entry) => {
      const matchesLocation = normalizedQuery
        ? entry.path.toLocaleLowerCase().includes(normalizedQuery)
        : parentGodotPath(entry.path) === normalizedDirectory
      const matchesKind = kind === 'all' || entry.isDirectory || entry.kind === kind
      return matchesLocation && matchesKind
    })
    .sort((left, right) => {
      if (left.isDirectory !== right.isDirectory) return left.isDirectory ? -1 : 1
      return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })
    })
}

export const safeGodotBaseName = (name: string) =>
  safeExportName(name).toLowerCase().slice(0, 64) || 'sprite'

const hasControlCharacters = (value: string) =>
  [...value].some((character) => character.charCodeAt(0) < 32)

const validRelativeDirectory = (path: string) =>
  !path ||
  (path.length <= 512 &&
    !path.startsWith('/') &&
    !path.includes('\\') &&
    path
      .split('/')
      .every(
        (part) =>
          part &&
          part !== '.' &&
          part !== '..' &&
          !part.startsWith('.') &&
          part.length <= 128 &&
          !/[<>:"|?*]/.test(part) &&
          !hasControlCharacters(part),
      ))

export const validateGodotPublish = (
  project: SpriteProject,
  kind: GodotPublishKind,
  targetDirectory: string,
  baseName: string,
  animationName: string,
  compatibility: GodotCompatibility,
) => {
  if (!validRelativeDirectory(targetDirectory)) {
    return 'Choose a valid folder inside res://.'
  }
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/i.test(baseName)) {
    return 'Use 1–64 letters, numbers, hyphens, or underscores for the asset name.'
  }
  if (kind === 'animation') {
    if (compatibility === 'legacy') {
      return 'SpriteFrames publishing requires a Godot 4 project.'
    }
    const cleanAnimationName = animationName.trim()
    if (
      !cleanAnimationName ||
      cleanAnimationName.length > 64 ||
      hasControlCharacters(cleanAnimationName)
    ) {
      return 'Enter an animation name between 1 and 64 characters.'
    }
    const sheetWidth = project.width * project.frames.length
    const sheetPixels = sheetWidth * project.height
    if (sheetWidth > 32_768 || project.height > 32_768 || sheetPixels > 16_777_216) {
      return 'This animation is too large for a safe Godot texture. Export fewer or smaller frames.'
    }
  }
  return ''
}

const godotString = (value: string) => JSON.stringify(value)

const godotNumber = (value: number) => {
  const rounded = Math.round(value * 1000) / 1000
  return Number.isInteger(rounded) ? `${rounded}.0` : String(rounded)
}

export const buildGodotSpriteFramesResource = (
  project: SpriteProject,
  sheetRelativePath: string,
  animationName: string,
  loop: boolean,
) => {
  if (!project.frames.length) throw new Error('The animation needs at least one frame.')
  if (!validRelativeDirectory(parentGodotPath(sheetRelativePath))) {
    throw new Error('The sprite sheet path is invalid.')
  }
  const normalizedSheetPath = joinGodotPath(sheetRelativePath)
  const atlasResources = project.frames
    .map(
      (_frame, index) =>
        `[sub_resource type="AtlasTexture" id="AtlasTexture_${index + 1}"]\n` +
        'atlas = ExtResource("1_sheet")\n' +
        `region = Rect2(${index * project.width}, 0, ${project.width}, ${project.height})\n` +
        'filter_clip = true',
    )
    .join('\n\n')
  const frames = project.frames
    .map(
      (frame, index) =>
        `{\n"duration": ${godotNumber(frame.duration / 100)},\n` +
        `"texture": SubResource("AtlasTexture_${index + 1}")\n}`,
    )
    .join(', ')
  return (
    `[gd_resource type="SpriteFrames" load_steps=${project.frames.length + 2} format=3]\n\n` +
    `[ext_resource type="Texture2D" path="res://${normalizedSheetPath}" id="1_sheet"]\n\n` +
    `${atlasResources}\n\n[resource]\nanimations = [{\n` +
    `"frames": [${frames}],\n` +
    `"loop": ${loop},\n` +
    `"name": &${godotString(animationName.trim())},\n` +
    '"speed": 10.0\n}]\n'
  )
}

export const godotPublishPaths = (
  kind: GodotPublishKind,
  targetDirectory: string,
  baseName: string,
  includeSource: boolean,
) => {
  const prefix = joinGodotPath(targetDirectory, baseName)
  const paths = kind === 'animation' ? [`${prefix}-sheet.png`, `${prefix}.tres`] : [`${prefix}.png`]
  if (includeSource) paths.push(`${prefix}.zakape`)
  return paths
}
