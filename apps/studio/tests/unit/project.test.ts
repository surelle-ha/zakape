import { describe, expect, it } from 'vitest'
import { createProjectPreview } from '~/composables/useProjectRepository'
import {
  createBlankProject,
  createDemoProject,
  coercePixelToColorMode,
  emptyPixels,
  normalizeHex,
  parseSpriteProject,
  registerPixelColor,
} from '~/utils/project'

describe('project helpers', () => {
  it('creates a complete layered animation', () => {
    const project = createDemoProject()

    expect(project.width).toBe(32)
    expect(project.frames).toHaveLength(4)
    expect(project.layers).toHaveLength(2)
    expect(
      project.layers.every((layer) =>
        project.frames.every((frame) => layer.cels[frame.id]?.length === 1024),
      ),
    ).toBe(true)
  })

  it('normalizes supported colors and rejects unsafe values', () => {
    expect(normalizeHex('#FA7')).toBe('#ffaa77')
    expect(normalizeHex('#B9F5D0')).toBe('#b9f5d0')
    expect(normalizeHex('red')).toBeNull()
    expect(normalizeHex('url(javascript:alert(1))')).toBeNull()
  })

  it('creates independent transparent buffers', () => {
    const pixels = emptyPixels(2, 2)
    pixels[0] = '#ffffff'

    expect(pixels).toEqual(['#ffffff', null, null, null])
  })

  it('creates bounded recent-project previews from composited artwork', () => {
    const project = createBlankProject(2, 2, 'Preview study')
    const frameId = project.frames[0]!.id
    project.layers[0]!.cels[frameId] = ['#8b5cf6', null, null, '#d946ef']

    expect(createProjectPreview(project)).toEqual({
      width: 2,
      height: 2,
      pixels: ['#8b5cf6', null, null, '#d946ef'],
    })

    const large = createProjectPreview(createBlankProject(96, 48, 'Large preview'))
    expect(large).toMatchObject({ width: 48, height: 24 })
    expect(large.pixels).toHaveLength(48 * 24)
  })

  it('creates a named rectangular project within the canvas limits', () => {
    const project = createBlankProject(96, 48, 'Forest runner')

    expect(project).toMatchObject({ width: 96, height: 48, name: 'Forest runner' })
    expect(project.checkerSize).toBe(2)
    expect(project.frames).toHaveLength(1)
    expect(project.layers).toHaveLength(1)
    expect(project.layers[0]!.cels[project.frames[0]!.id]).toHaveLength(96 * 48)
    expect(createBlankProject(2048).width).toBe(1024)
    expect(() => createBlankProject(1024, 1025)).not.toThrow()
  })

  it('initializes color mode and background without losing pixel constraints', () => {
    const grayscale = createBlankProject(3, 2, 'Value study', 'grayscale', 'white')
    const indexed = createBlankProject(2, 2, 'Palette study', 'indexed', 'black')

    expect(grayscale).toMatchObject({ colorMode: 'grayscale', background: 'white' })
    expect(grayscale.layers[0]!.cels[grayscale.frames[0]!.id]).toEqual(
      Array.from({ length: 6 }, () => '#ffffff'),
    )
    expect(coercePixelToColorMode(grayscale, '#ff0000')).toBe('#363636')
    expect(indexed).toMatchObject({ colorMode: 'indexed', background: 'black' })
    expect(indexed.palette).toContain(coercePixelToColorMode(indexed, '#ff8b62'))
  })

  it('normalizes and preserves a selected starting palette', () => {
    const project = createBlankProject(16, 16, 'Palette study', 'indexed', 'transparent', [
      '#22aaff',
      '#22AAFF',
      'invalid',
      '#110022',
    ])

    expect(project.palette).toEqual(['#22aaff', '#110022'])
  })

  it('preserves an explicitly empty palette and registers indexed colors on first use', () => {
    const rgba = createBlankProject(4, 4, 'No palette', 'rgba', 'transparent', [])
    const indexed = createBlankProject(4, 4, 'Growing palette', 'indexed', 'transparent', [])

    expect(rgba.palette).toEqual([])
    expect(indexed.palette).toEqual([])
    expect(registerPixelColor(indexed, '#22AAFF')).toBe('#22aaff')
    expect(indexed.palette).toEqual(['#22aaff'])
    expect(registerPixelColor(indexed, '#22aaff')).toBe('#22aaff')
    expect(indexed.palette).toHaveLength(1)
  })

  it('normalizes non-empty greyscale starting palettes', () => {
    const project = createBlankProject(2, 2, 'Value palette', 'grayscale', 'transparent', [
      '#ff0000',
      '#00ff00',
    ])

    expect(project.palette).toEqual(['#363636', '#b6b6b6'])
  })

  it('uses the nearest indexed color after reaching the palette limit', () => {
    const palette = Array.from(
      { length: 256 },
      (_, index) => `#00${index.toString(16).padStart(2, '0')}00`,
    )
    const project = createBlankProject(2, 2, 'Full palette', 'indexed', 'transparent', palette)
    const resolved = registerPixelColor(project, '#ff0000')

    expect(project.palette).toHaveLength(256)
    expect(project.palette).toContain(resolved)
    expect(resolved).not.toBe('#ff0000')
  })

  it('accepts complete projects and rejects unsafe or incomplete imports', () => {
    const project = createBlankProject(32)
    expect(parseSpriteProject(project)).toEqual(project)

    expect(() => parseSpriteProject({ ...project, id: '../outside' })).toThrow(/invalid/)
    expect(() => parseSpriteProject({ ...project, frames: [] })).toThrow(/invalid/)
    expect(() =>
      parseSpriteProject({
        ...project,
        layers: [{ ...project.layers[0]!, cels: { [project.frames[0]!.id]: [] } }],
      }),
    ).toThrow(/invalid/)

    const legacy = { ...project } as Record<string, unknown>
    delete legacy.checkerSize
    expect(parseSpriteProject(legacy).checkerSize).toBe(2)
    expect(() => parseSpriteProject({ ...project, checkerSize: 0 })).toThrow(/invalid/)
  })
})
