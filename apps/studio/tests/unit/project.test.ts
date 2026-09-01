import { describe, expect, it } from 'vitest'
import {
  createBlankProject,
  createDemoProject,
  emptyPixels,
  normalizeHex,
  parseSpriteProject,
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

  it('creates a bounded blank project for the project home', () => {
    const project = createBlankProject(64)

    expect(project).toMatchObject({ width: 64, height: 64, name: 'Untitled sprite' })
    expect(project.frames).toHaveLength(1)
    expect(project.layers).toHaveLength(1)
    expect(project.layers[0]!.cels[project.frames[0]!.id]).toHaveLength(64 * 64)
    expect(createBlankProject(999).width).toBe(256)
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
  })
})
