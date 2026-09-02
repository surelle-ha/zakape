import { getCurrentWindow } from '@tauri-apps/api/window'

export const useAppWindow = () => {
  const isMaximized = useState<boolean>('window-maximized', () => false)
  const hasTauri = import.meta.client && '__TAURI_INTERNALS__' in window

  const withWindow = async (
    action: (window: ReturnType<typeof getCurrentWindow>) => Promise<void>,
  ) => {
    if (!hasTauri) return
    await action(getCurrentWindow())
  }

  const refreshMaximized = async () => {
    if (!hasTauri) return
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
      if (!hasTauri) return () => undefined
      return getCurrentWindow().onCloseRequested((event) => {
        event.preventDefault()
        requestClose()
      })
    },
    exitConfirmed: () => withWindow((window) => window.destroy()),
    refreshMaximized,
  }
}
