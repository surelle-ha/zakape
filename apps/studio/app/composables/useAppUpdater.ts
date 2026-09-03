import type { Update } from '@tauri-apps/plugin-updater'

export type AppUpdateStatus =
  'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'current' | 'unsupported' | 'error'

let pendingUpdate: Update | null = null
let initialCheckTimer: number | null = null
let automaticCheckInterval: number | null = null
let visibilityListener: (() => void) | null = null
let onlineListener: (() => void) | null = null
let lastAutomaticCheck = 0

const UPDATE_POLL_INTERVAL = 10 * 60 * 1000
const UPDATE_RESUME_THRESHOLD = 2 * 60 * 1000

const isDesktopRuntime = () =>
  '__TAURI_INTERNALS__' in window && !/Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent)

export const useAppUpdater = () => {
  const config = useRuntimeConfig()
  const status = useState<AppUpdateStatus>('app-update-status', () => 'idle')
  const currentVersion = useState('app-current-version', () => String(config.public.appVersion))
  const availableVersion = useState('app-available-version', () => '')
  const releaseNotes = useState('app-update-release-notes', () => '')
  const progress = useState('app-update-progress', () => 0)
  const errorMessage = useState('app-update-error', () => '')
  const dialogOpen = useState('app-update-dialog-open', () => false)
  const supported = useState('app-update-supported', () => false)
  const initialized = useState('app-update-initialized', () => false)

  const statusLabel = computed(() => {
    if (status.value === 'checking') return 'Checking for updates'
    if (status.value === 'available') return `Update v${availableVersion.value} available`
    if (status.value === 'downloading') return `Installing update ${progress.value}%`
    if (status.value === 'ready') return 'Restart to finish update'
    if (status.value === 'current') return 'Zakape is up to date'
    if (status.value === 'error') return 'Update check failed'
    if (status.value === 'unsupported') return 'Desktop updates only'
    return supported.value ? 'Updates monitored' : ''
  })

  const checkForUpdates = async (manual = true) => {
    if (!supported.value) {
      status.value = 'unsupported'
      errorMessage.value = 'Automatic updates are available in the installed desktop app.'
      if (manual) dialogOpen.value = true
      return
    }
    if (status.value === 'checking' || status.value === 'downloading') return

    status.value = 'checking'
    errorMessage.value = ''
    progress.value = 0
    if (manual) dialogOpen.value = true
    try {
      const { check } = await import('@tauri-apps/plugin-updater')
      const update = await check({ timeout: 20_000 })
      if (pendingUpdate && pendingUpdate !== update) await pendingUpdate.close()
      pendingUpdate = update
      if (!update) {
        availableVersion.value = ''
        releaseNotes.value = ''
        status.value = manual ? 'current' : 'idle'
        return
      }
      availableVersion.value = update.version
      releaseNotes.value = update.body?.trim() ?? ''
      status.value = 'available'
    } catch (error) {
      errorMessage.value =
        error instanceof Error
          ? error.message
          : 'Zakape could not reach the signed update manifest.'
      status.value = manual ? 'error' : 'idle'
      if (!manual) dialogOpen.value = false
    } finally {
      if (!manual) lastAutomaticCheck = Date.now()
    }
  }

  const checkInBackground = () => {
    if (
      !supported.value ||
      document.visibilityState === 'hidden' ||
      ['checking', 'available', 'downloading', 'ready'].includes(status.value) ||
      Date.now() - lastAutomaticCheck < UPDATE_RESUME_THRESHOLD
    ) {
      return
    }
    void checkForUpdates(false)
  }

  const installUpdate = async () => {
    if (!pendingUpdate || status.value !== 'available') return
    status.value = 'downloading'
    progress.value = 0
    errorMessage.value = ''
    let downloadedBytes = 0
    let contentLength = 0
    try {
      await pendingUpdate.downloadAndInstall(
        (event) => {
          if (event.event === 'Started') {
            contentLength = event.data.contentLength ?? 0
            return
          }
          if (event.event === 'Progress') {
            downloadedBytes += event.data.chunkLength
            progress.value = contentLength
              ? Math.min(99, Math.round((downloadedBytes / contentLength) * 100))
              : Math.min(99, progress.value + 1)
            return
          }
          progress.value = 100
        },
        { timeout: 120_000, restartAfterInstall: false },
      )
      status.value = 'ready'
    } catch (error) {
      status.value = 'error'
      errorMessage.value =
        error instanceof Error ? error.message : 'Zakape could not install the signed update.'
    }
  }

  const relaunchApp = async () => {
    if (!supported.value) return
    const { relaunch } = await import('@tauri-apps/plugin-process')
    await relaunch()
  }

  const initialize = async () => {
    if (initialized.value) return
    initialized.value = true
    supported.value = isDesktopRuntime()
    if (!supported.value) return
    try {
      const { getVersion } = await import('@tauri-apps/api/app')
      currentVersion.value = await getVersion()
    } catch {
      // The package version remains an accurate fallback in browser-based QA.
    }
    initialCheckTimer = window.setTimeout(checkInBackground, 2_500)
    automaticCheckInterval = window.setInterval(checkInBackground, UPDATE_POLL_INTERVAL)
    visibilityListener = () => {
      if (document.visibilityState === 'visible') checkInBackground()
    }
    onlineListener = checkInBackground
    document.addEventListener('visibilitychange', visibilityListener)
    window.addEventListener('online', onlineListener)
  }

  const dispose = () => {
    if (initialCheckTimer !== null) window.clearTimeout(initialCheckTimer)
    if (automaticCheckInterval !== null) window.clearInterval(automaticCheckInterval)
    if (visibilityListener) document.removeEventListener('visibilitychange', visibilityListener)
    if (onlineListener) window.removeEventListener('online', onlineListener)
    initialCheckTimer = null
    automaticCheckInterval = null
    visibilityListener = null
    onlineListener = null
    initialized.value = false
  }

  return {
    availableVersion,
    checkForUpdates,
    currentVersion,
    dialogOpen,
    dispose,
    errorMessage,
    initialize,
    installUpdate,
    progress,
    relaunchApp,
    releaseNotes,
    status,
    statusLabel,
    supported,
  }
}
