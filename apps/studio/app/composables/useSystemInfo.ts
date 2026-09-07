import {
  formatSystemInfo,
  genericRenderingEngine,
  supportDestinations,
  type SupportDestination,
} from '~/utils/systemInfo'

const isTauriRuntime = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const browserOs = () => {
  const source = navigator.userAgent
  if (/Android/i.test(source)) return 'Android'
  if (/iPhone|iPad|iPod/i.test(source)) return 'iOS'
  if (/Windows/i.test(source)) return 'Windows'
  if (/Mac OS X/i.test(source)) return 'macOS'
  if (/Linux/i.test(source)) return 'Linux'
  return undefined
}

export const useSystemInfo = () => {
  const config = useRuntimeConfig()
  const { currentVersion } = useAppUpdater()
  const { showError, showSuccess } = useActionNotice()
  const busy = useState<boolean>('system-info-busy', () => false)

  const collect = async () => {
    let osFamily = browserOs()
    let osVersion: string | undefined
    let architecture: string | undefined
    let locale = navigator.language
    if (isTauriRuntime()) {
      try {
        const os = await import('@tauri-apps/plugin-os')
        osFamily = os.platform()
        osVersion = os.version()
        architecture = os.arch()
        locale = (await os.locale()) ?? locale
      } catch {
        // Browser-safe fields remain enough to produce a supportable diagnostic block.
      }
    }
    return formatSystemInfo({
      appVersion: currentVersion.value || String(config.public.appVersion),
      buildId: String(config.public.buildId),
      releaseChannel: String(config.public.releaseChannel),
      buildType: String(config.public.buildType),
      osFamily,
      osVersion,
      architecture,
      locale,
      renderingEngine: genericRenderingEngine(navigator.userAgent),
    })
  }

  const copySystemInfo = async () => {
    if (busy.value) return
    busy.value = true
    try {
      const text = await collect()
      let copied = false
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text)
          copied = true
        }
      } catch {
        // Packaged WebViews may reject the standards clipboard API.
      }
      if (!copied && isTauriRuntime()) {
        const { writeText } = await import('@tauri-apps/plugin-clipboard-manager')
        await writeText(text)
        copied = true
      }
      if (!copied) throw new Error('Clipboard access is unavailable.')
      showSuccess('System information copied')
    } catch {
      showError('Zakape could not copy system information.', copySystemInfo)
    } finally {
      busy.value = false
    }
  }

  const openSupportDestination = async (destination: SupportDestination) => {
    if (busy.value) return
    busy.value = true
    const url = supportDestinations[destination]
    try {
      if (!navigator.onLine) throw new Error('Zakape is offline.')
      if (isTauriRuntime()) {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('open_support_url', { destination })
      } else {
        const opened = window.open(url, '_blank', 'noopener,noreferrer')
        if (!opened) throw new Error('The browser blocked the new tab.')
        opened.opener = null
      }
    } catch {
      showError('Zakape could not open that support page.', () =>
        openSupportDestination(destination),
      )
    } finally {
      busy.value = false
    }
  }

  return { busy, collect, copySystemInfo, openSupportDestination }
}
