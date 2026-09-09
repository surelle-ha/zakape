import { describe, expect, it } from 'vitest'
import {
  DEFAULT_APPEARANCE,
  accentReadable,
  contrastRatio,
  deriveAppearanceTokens,
  normalizeAccent,
  normalizeAppearance,
} from '../../app/utils/appearance'

describe('appearance preferences', () => {
  it('normalizes malformed preferences to the reviewed default', () => {
    expect(normalizeAppearance(null)).toEqual(DEFAULT_APPEARANCE)
    expect(normalizeAppearance({ theme: 'system', accent: 'transparent' })).toEqual(
      DEFAULT_APPEARANCE,
    )
    expect(normalizeAccent('#A855F7')).toBe('#a855f7')
  })

  it('derives distinct readable dark and light surface tokens', () => {
    const dark = deriveAppearanceTokens({ version: 1, theme: 'dark', accent: '#8b5cf6' })
    const light = deriveAppearanceTokens({ version: 1, theme: 'light', accent: '#7c3aed' })
    expect(dark['--ink']).not.toBe(light['--ink'])
    expect(contrastRatio(dark['--text'], dark['--ink'])).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(light['--text'], light['--ink'])).toBeGreaterThanOrEqual(4.5)
  })

  it('detects accents that disappear against the selected surface', () => {
    expect(accentReadable('#8b5cf6', 'dark')).toBe(true)
    expect(accentReadable('#12151a', 'dark')).toBe(false)
    expect(accentReadable('#7c3aed', 'light')).toBe(true)
    expect(accentReadable('#f7f8fa', 'light')).toBe(false)
  })
})
