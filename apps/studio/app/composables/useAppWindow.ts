import { getCurrentWindow } from '@tauri-apps/api/window'

export const useAppWindow = () => {
  const isMaximized = useState<boolean>('window-maximized', () => false)
  const hasTauri = import.meta.client && '__TAURI_INTERNALS__' in window
  const hasDesktopWindow = hasTauri && !/Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent)

  const withWindow = async (
    action: (window: ReturnType<typeof getCurrentWindow>) => Promise<void>,
  ) => {
    if (!hasDesktopWindow) return
    await action(getCurrentWindow())
  }

  const refreshMaximized = async () => {
    if (!hasDesktopWindow) return
    isMaximized.value = await getCurrentWindow().isMaximized()
  }

  return {
    hasTauri,
    isMaximized,
    minimize: () => withWindow((window) => window.minimize()),
    startDragging: () => withWindow((window) => window.startDragging()),
    toggleMaximize: async () => {
      await withWindow((window) => window.toggleMaximize())
      await refreshMaximized()
    },
    onCloseRequested: async (requestClose: () => void) => {
      if (!hasDesktopWindow) return () => undefined
      return getCurrentWindow().onCloseRequested((event) => {
        event.preventDefault()
        requestClose()
      })
    },
    exitConfirmed: () => withWindow((window) => window.destroy()),
    refreshMaximized,
  }
}
