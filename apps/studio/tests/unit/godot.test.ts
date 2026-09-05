import { describe, expect, it } from 'vitest'
import type { GodotResourceEntry } from '~/utils/godot'
import {
  buildGodotSpriteFramesResource,
  godotBreadcrumbs,
  godotPublishPaths,
  safeGodotBaseName,
  validateGodotPublish,
  visibleGodotResources,
} from '~/utils/godot'
import { createBlankProject } from '~/utils/project'

const entries: GodotResourceEntry[] = [
  {
    path: 'art',
    name: 'art',
    kind: 'folder',
    isDirectory: true,
    size: 0,
    modifiedAt: null,
    importable: false,
  },
  {
    path: 'art/hero',
    name: 'hero',
    kind: 'folder',
    isDirectory: true,
    size: 0,
    modifiedAt: null,
    importable: false,
  },
  {
    path: 'art/hero/run.png',
    name: 'run.png',
    kind: 'texture',
    isDirectory: false,
    size: 240,
    modifiedAt: 1,
    importable: true,
  },
  {
    path: 'scripts/player.gd',
    name: 'player.gd',
    kind: 'script',
    isDirectory: false,
    size: 800,
    modifiedAt: 2,
    importable: false,
  },
]

describe('Godot resource browser helpers', () => {
  it('browses immediate children while search spans the complete res root', () => {
    expect(visibleGodotResources(entries, '', '', 'all').map((entry) => entry.path)).toEqual([
      'art',
    ])
    expect(visibleGodotResources(entries, 'art', '', 'all').map((entry) => entry.path)).toEqual([
      'art/hero',
    ])
    expect(visibleGodotResources(entries, '', 'run', 'texture').map((entry) => entry.path)).toEqual(
      ['art/hero/run.png'],
    )
  })

  it('builds navigable res breadcrumbs', () => {
    expect(godotBreadcrumbs('art/hero')).toEqual([
      { label: 'res://', path: '' },
      { label: 'art', path: 'art' },
      { label: 'hero', path: 'art/hero' },
    ])
  })
})

describe('Godot publishing helpers', () => {
  it('creates predictable safe names and bundle paths', () => {
    expect(safeGodotBaseName('  Player Idle!  ')).toBe('player-idle')
    expect(godotPublishPaths('animation', 'art/hero', 'player-idle', true)).toEqual([
      'art/hero/player-idle-sheet.png',
      'art/hero/player-idle.tres',
      'art/hero/player-idle.zakape',
    ])
  })

  it('writes a Godot 4 SpriteFrames resource with atlas regions and exact timing', () => {
    const project = createBlankProject(16, 12, 'Runner')
    const firstFrameId = project.frames[0]!.id
    project.frames[0]!.duration = 120
    project.frames.push({ id: 'frame_second', name: 'F2', duration: 140 })
    project.layers.forEach((layer) => {
      layer.cels.frame_second = [...layer.cels[firstFrameId]!]
    })

    const resource = buildGodotSpriteFramesResource(
      project,
      'art/runner-sheet.png',
      'run & jump',
      true,
    )

    expect(resource).toContain('[gd_resource type="SpriteFrames" load_steps=4 format=3]')
    expect(resource).toContain('path="res://art/runner-sheet.png"')
    expect(resource).toContain('region = Rect2(0, 0, 16, 12)')
    expect(resource).toContain('region = Rect2(16, 0, 16, 12)')
    expect(resource).toContain('"duration": 1.2')
    expect(resource).toContain('"duration": 1.4')
    expect(resource).toContain('"name": &"run & jump"')
    expect(resource).toContain('"loop": true')
    expect(resource).toContain('"speed": 10.0')
  })

  it('rejects traversal, unsafe names, legacy resource output, and oversized sheets', () => {
    const project = createBlankProject(1024, 1024, 'Large')
    expect(
      validateGodotPublish(project, 'frame', '../outside', 'hero', 'default', 'godot4'),
    ).toMatch(/valid folder/)
    expect(validateGodotPublish(project, 'frame', '', 'hero.png', 'default', 'godot4')).toMatch(
      /letters, numbers/,
    )
    expect(validateGodotPublish(project, 'animation', '', 'hero', 'default', 'legacy')).toMatch(
      /Godot 4/,
    )
    project.frames = Array.from({ length: 17 }, (_, index) => ({
      id: `frame_${index}`,
      name: `F${index + 1}`,
      duration: 100,
    }))
    expect(validateGodotPublish(project, 'animation', '', 'hero', 'default', 'godot4')).toMatch(
      /too large/,
    )
  })
})
