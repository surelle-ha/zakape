export type LauncherView = 'recent' | 'new'

export const useWorkspace = () => {
  const launcherOpen = useState<boolean>('workspace-launcher-open', () => true)
  const launcherView = useState<LauncherView>('workspace-launcher-view', () => 'recent')
  const screen = computed(() => (launcherOpen.value ? 'home' : 'editor'))

  const showHome = () => {
    launcherView.value = 'recent'
    launcherOpen.value = true
  }

  const showEditor = () => {
    launcherOpen.value = false
  }

  const requestOpen = () => {
    launcherView.value = 'recent'
    launcherOpen.value = true
  }

  const requestNew = () => {
    launcherView.value = 'new'
    launcherOpen.value = true
  }

  return {
    screen,
    launcherOpen,
    launcherView,
    showHome,
    showEditor,
    requestOpen,
    requestNew,
  }
}
