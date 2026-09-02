import { describe, expect, it } from 'vitest'
import { importedSpriteProject } from '~/utils/import'

describe('desktop sprite import adapter', () => {
  it('turns a decoded payload into a validated Zakape project', () => {
    const project = importedSpriteProject({
      sourceHash: '0123456789abcdef',
      name: 'Imported hero',
      width: 2,
      height: 1,
      colorMode: 'rgba',
      palette: ['#112233', '#ffffff'],
      frames: [{ id: 'frame_import_1', name: 'F1', duration: 90 }],
      layers: [
        {
          id: 'layer_import_1',
          name: '   ',
          visible: true,
          opacity: 1,
          cels: { frame_import_1: ['#112233', null] },
        },
      ],
    })

    expect(project).toMatchObject({
      id: 'project_ase_0123456789abcdef',
      name: 'Imported hero',
      width: 2,
      height: 1,
      colorMode: 'rgba',
    })
    expect(project.layers[0]).toMatchObject({ name: 'Imported layer 1' })
    expect(project.layers[0]!.cels.frame_import_1).toEqual(['#112233', null])
  })
})
