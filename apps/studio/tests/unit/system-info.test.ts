import { describe, expect, it } from 'vitest'
import {
  formatSystemInfo,
  genericRenderingEngine,
  supportDestinations,
  UNAVAILABLE,
} from '../../app/utils/systemInfo'

describe('support system information', () => {
  it('formats only the approved, labelled diagnostic fields', () => {
    const output = formatSystemInfo({
      appVersion: '0.20.0',
      buildId: 'abc1234',
      releaseChannel: 'stable',
      buildType: 'release',
      osFamily: 'windows',
      osVersion: '11',
      architecture: 'x86_64',
      locale: 'en-PH',
      renderingEngine: 'Chromium 140.0',
    })
    expect(output).toBe(
      [
        'Zakape system information',
        'Zakape version: 0.20.0',
        'Build: abc1234',
        'Release: stable · release',
        'Operating system: windows 11',
        'Architecture: x86_64',
        'Locale: en-PH',
        'Rendering engine: Chromium 140.0',
      ].join('\n'),
    )
    expect(output).not.toMatch(/username|hostname|token|project|prompt|endpoint/i)
  })

  it('keeps optional values private and uses explicit fallbacks', () => {
    const output = formatSystemInfo({
      appVersion: undefined,
      buildId: undefined,
      releaseChannel: undefined,
      buildType: undefined,
      osFamily: undefined,
      osVersion: undefined,
      architecture: undefined,
      locale: undefined,
      renderingEngine: undefined,
    })
    expect(output.match(/Unavailable/g)).toHaveLength(9)
    expect(UNAVAILABLE).toBe('Unavailable')
  })

  it('reduces raw user agents to a generic engine label', () => {
    expect(genericRenderingEngine('Mozilla/5.0 Chrome/140.0.0.0 Safari/537.36')).toBe(
      'Chromium 140.0.0.0',
    )
    expect(genericRenderingEngine('Mozilla/5.0 Firefox/142.0')).toBe('Gecko 142.0')
    expect(
      genericRenderingEngine('Mozilla/5.0 (Linux; Android 15; wv) Version/4.0 Chrome/139.0'),
    ).toBe('Android WebView 4.0')
    expect(genericRenderingEngine('private-agent')).toBe(UNAVAILABLE)
  })

  it('uses only fixed official support destinations', () => {
    expect(supportDestinations).toEqual({
      bug: 'https://github.com/surelle-ha/zakape/issues/new?template=bug.yml',
      feature: 'https://github.com/surelle-ha/zakape/issues/new?template=feature.yml',
      support: 'https://ko-fi.com/surelle',
    })
  })
})
