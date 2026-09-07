export const UNAVAILABLE = 'Unavailable'

export type SupportDestination = 'bug' | 'feature' | 'support'

export const supportDestinations: Record<SupportDestination, string> = {
  bug: 'https://github.com/surelle-ha/zakape/issues/new?template=bug.yml',
  feature: 'https://github.com/surelle-ha/zakape/issues/new?template=feature.yml',
  support: 'https://ko-fi.com/surelle',
}

export type SystemInfoFields = {
  appVersion: string | null | undefined
  buildId: string | null | undefined
  releaseChannel: string | null | undefined
  buildType: string | null | undefined
  osFamily: string | null | undefined
  osVersion: string | null | undefined
  architecture: string | null | undefined
  locale: string | null | undefined
  renderingEngine: string | null | undefined
}

const MAX_VALUE_LENGTH = 96

export const systemInfoValue = (value: string | null | undefined) => {
  const normalized = value
    ?.split('')
    .map((character) => {
      const code = character.charCodeAt(0)
      return code < 32 || code === 127 ? ' ' : character
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
  return normalized ? normalized.slice(0, MAX_VALUE_LENGTH) : UNAVAILABLE
}

export const genericRenderingEngine = (userAgent: string | null | undefined) => {
  const source = userAgent ?? ''
  const version = (expression: RegExp) => source.match(expression)?.[1]
  if (/\bwv\b|; wv\)/i.test(source))
    return `Android WebView ${version(/(?:Version|Chrome)\/([\d.]+)/i) ?? ''}`.trim()
  if (/\bEdg\//i.test(source)) return `Chromium WebView ${version(/Edg\/([\d.]+)/i) ?? ''}`.trim()
  if (/\bFirefox\//i.test(source)) return `Gecko ${version(/Firefox\/([\d.]+)/i) ?? ''}`.trim()
  if (/\bChrome\//i.test(source) || /\bChromium\//i.test(source))
    return `Chromium ${version(/(?:Chrome|Chromium)\/([\d.]+)/i) ?? ''}`.trim()
  if (/\bSafari\//i.test(source) && /\bVersion\//i.test(source))
    return `WebKit ${version(/Version\/([\d.]+)/i) ?? ''}`.trim()
  return UNAVAILABLE
}

export const formatSystemInfo = (fields: SystemInfoFields) =>
  [
    'Zakape system information',
    `Zakape version: ${systemInfoValue(fields.appVersion)}`,
    `Build: ${systemInfoValue(fields.buildId)}`,
    `Release: ${systemInfoValue(fields.releaseChannel)} · ${systemInfoValue(fields.buildType)}`,
    `Operating system: ${systemInfoValue(fields.osFamily)} ${systemInfoValue(fields.osVersion)}`,
    `Architecture: ${systemInfoValue(fields.architecture)}`,
    `Locale: ${systemInfoValue(fields.locale)}`,
    `Rendering engine: ${systemInfoValue(fields.renderingEngine)}`,
  ].join('\n')
