import { describe, expect, it } from 'vitest'
import { hexToHsv, hexToRgb, hsvToHex, normalizeHexColor, rgbToHex } from '../../app/utils/color'

describe('custom color mixer', () => {
  it('normalizes shorthand colors and rejects invalid values safely', () => {
    expect(normalizeHexColor('#Fa8')).toBe('#ffaa88')
    expect(normalizeHexColor('nope', '#123456')).toBe('#123456')
  })

  it('converts between hex and RGB without changing the selected color', () => {
    expect(hexToRgb('#7ed0aa')).toEqual({ r: 126, g: 208, b: 170 })
    expect(rgbToHex({ r: 126, g: 208, b: 170 })).toBe('#7ed0aa')
  })

  it('round-trips representative hues through HSV', () => {
    for (const color of ['#ff0000', '#00ff00', '#0000ff', '#ff875f', '#16221c']) {
      expect(hsvToHex(hexToHsv(color))).toBe(color)
    }
  })
})
