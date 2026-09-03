export interface RgbColor {
  r: number
  g: number
  b: number
}

export interface HsvColor {
  h: number
  s: number
  v: number
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(maximum, Math.max(minimum, value))

export const normalizeHexColor = (value: string, fallback = '#000000') => {
  const candidate = value.trim().toLowerCase()
  if (/^#[0-9a-f]{6}$/.test(candidate)) return candidate
  if (/^#[0-9a-f]{3}$/.test(candidate)) {
    const [r, g, b] = candidate.slice(1)
    return '#' + r + r + g + g + b + b
  }
  return fallback
}

export const hexToRgb = (value: string): RgbColor => {
  const normalized = normalizeHexColor(value)
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  }
}

export const rgbToHex = ({ r, g, b }: RgbColor) =>
  '#' +
  [r, g, b]
    .map((channel) =>
      Math.round(clamp(channel, 0, 255))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')

export const rgbToHsv = ({ r, g, b }: RgbColor): HsvColor => {
  const red = clamp(r, 0, 255) / 255
  const green = clamp(g, 0, 255) / 255
  const blue = clamp(b, 0, 255) / 255
  const maximum = Math.max(red, green, blue)
  const minimum = Math.min(red, green, blue)
  const delta = maximum - minimum
  let hue = 0

  if (delta) {
    if (maximum === red) hue = 60 * (((green - blue) / delta) % 6)
    else if (maximum === green) hue = 60 * ((blue - red) / delta + 2)
    else hue = 60 * ((red - green) / delta + 4)
  }

  return {
    h: hue < 0 ? hue + 360 : hue,
    s: maximum === 0 ? 0 : (delta / maximum) * 100,
    v: maximum * 100,
  }
}

export const hsvToRgb = ({ h, s, v }: HsvColor): RgbColor => {
  const hue = ((h % 360) + 360) % 360
  const saturation = clamp(s, 0, 100) / 100
  const value = clamp(v, 0, 100) / 100
  const chroma = value * saturation
  const segment = hue / 60
  const secondary = chroma * (1 - Math.abs((segment % 2) - 1))
  const offset = value - chroma
  let channels: [number, number, number]

  if (segment < 1) channels = [chroma, secondary, 0]
  else if (segment < 2) channels = [secondary, chroma, 0]
  else if (segment < 3) channels = [0, chroma, secondary]
  else if (segment < 4) channels = [0, secondary, chroma]
  else if (segment < 5) channels = [secondary, 0, chroma]
  else channels = [chroma, 0, secondary]

  return {
    r: (channels[0] + offset) * 255,
    g: (channels[1] + offset) * 255,
    b: (channels[2] + offset) * 255,
  }
}

export const hexToHsv = (value: string) => rgbToHsv(hexToRgb(value))
export const hsvToHex = (value: HsvColor) => rgbToHex(hsvToRgb(value))
