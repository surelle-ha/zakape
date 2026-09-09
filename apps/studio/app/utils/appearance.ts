import type { AppearancePreference, AppearanceTheme } from '~/types/editor'

export const DEFAULT_APPEARANCE: AppearancePreference = {
  version: 1,
  theme: 'dark',
  accent: '#8b5cf6',
}

export const ACCENT_PRESETS = [
  { id: 'violet', label: 'Violet', color: '#8b5cf6' },
  { id: 'sky', label: 'Sky', color: '#38bdf8' },
  { id: 'rose', label: 'Rose', color: '#fb7185' },
  { id: 'amber', label: 'Amber', color: '#f59e0b' },
  { id: 'mint', label: 'Mint', color: '#34d399' },
] as const

const hexPattern = /^#[0-9a-f]{6}$/i

export const normalizeAccent = (value: unknown, fallback = DEFAULT_APPEARANCE.accent) => {
  const candidate = typeof value === 'string' ? value.trim().toLowerCase() : ''
  return hexPattern.test(candidate) ? candidate : fallback
}

export const normalizeTheme = (value: unknown): AppearanceTheme =>
  value === 'light' ? 'light' : 'dark'

export const normalizeAppearance = (value: unknown): AppearancePreference => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { ...DEFAULT_APPEARANCE }
  const record = value as Record<string, unknown>
  return {
    version: 1,
    theme: normalizeTheme(record.theme),
    accent: normalizeAccent(record.accent),
  }
}

const channel = (value: string, offset: number) =>
  Number.parseInt(value.slice(offset, offset + 2), 16)

const luminance = (color: string) => {
  const channels = [channel(color, 1), channel(color, 3), channel(color, 5)].map((entry) => {
    const normalized = entry / 255
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4
  })
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722
}

export const contrastRatio = (first: string, second: string) => {
  const high = Math.max(luminance(first), luminance(second))
  const low = Math.min(luminance(first), luminance(second))
  return (high + 0.05) / (low + 0.05)
}

export const accentReadable = (accent: string, theme: AppearanceTheme) => {
  const surface = theme === 'dark' ? '#12151a' : '#f7f8fa'
  return contrastRatio(accent, surface) >= 3
}

const mix = (first: string, second: string, amount: number) => {
  const values = [1, 3, 5].map((offset) =>
    Math.round(
      channel(first, offset) + (channel(second, offset) - channel(first, offset)) * amount,
    ),
  )
  return `#${values.map((value) => value.toString(16).padStart(2, '0')).join('')}`
}

export const deriveAppearanceTokens = (preference: AppearancePreference) => {
  const dark = preference.theme === 'dark'
  // Drafting-paper surfaces keep light mode neutral while the chosen accent
  // remains reserved for focus, selection, and important actions.
  const ink = dark ? '#0b0d10' : '#e8e5df'
  const panel = dark ? '#12151a' : '#f4f1eb'
  const raised = dark ? '#181c22' : '#fbfaf7'
  const soft = dark ? '#20252d' : '#e9e6df'
  const text = dark ? '#f2f4f7' : '#252831'
  const muted = dark ? '#9aa3af' : '#686b72'
  const line = dark ? '#303640' : '#d2cec5'
  const accent = normalizeAccent(preference.accent)
  const accentSoft = dark ? mix(ink, accent, 0.22) : mix(panel, accent, 0.14)
  const accentForeground =
    contrastRatio(accent, '#ffffff') >= contrastRatio(accent, '#15171c') ? '#ffffff' : '#15171c'
  return {
    '--ink': ink,
    '--panel': panel,
    '--panel-raised': raised,
    '--panel-soft': soft,
    '--line': line,
    '--line-strong': dark ? '#48515e' : '#aaa59b',
    '--muted': muted,
    '--text': text,
    '--paper': dark ? '#e5e7eb' : '#292b32',
    '--mint': accent,
    '--mint-strong': accent,
    // Legacy component styles use --orange for primary actions; map it to the
    // selected accent so every interactive family changes together.
    '--orange': accent,
    '--yellow': dark ? '#e9d5ff' : '#7c3aed',
    '--scroll-thumb': dark ? '#4b5260' : '#aaa59b',
    '--scroll-thumb-hover': dark ? '#656e7d' : '#7c7d80',
    '--accent-soft': accentSoft,
    '--accent-contrast': accentForeground,
  }
}

export type AppearanceTokens = ReturnType<typeof deriveAppearanceTokens>
