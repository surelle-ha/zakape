import { describe, expect, it } from 'vitest'
import { resolveBuildMetadata } from '../../build/metadata'

describe('build metadata', () => {
  it('prefers explicit non-secret release metadata', () => {
    expect(
      resolveBuildMetadata(
        {
          ZAKAPE_BUILD_SHA: 'abcdef1234567890',
          ZAKAPE_RELEASE_CHANNEL: 'stable',
          ZAKAPE_BUILD_TYPE: 'release',
          GITHUB_SHA: 'ignored',
        },
        'ignored',
      ),
    ).toEqual({ buildId: 'abcdef1234567890', releaseChannel: 'stable', buildType: 'release' })
  })

  it('falls back deterministically without exposing arbitrary environment content', () => {
    expect(resolveBuildMetadata({ GITHUB_SHA: 'f00ba4' }, 'local')).toEqual({
      buildId: 'f00ba4',
      releaseChannel: 'development',
      buildType: 'development',
    })
    expect(resolveBuildMetadata({ ZAKAPE_BUILD_SHA: ' spaces? no ' }, undefined).buildId).toBe(
      'spacesno',
    )
    expect(resolveBuildMetadata({}, null).buildId).toBe('development')
  })
})
