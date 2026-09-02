export type LauncherView = 'recent' | 'new'

export const useWorkspace = () => {
  const launcherOpen = useState<boolean>('workspace-launcher-open', () => true)
  const launcherView = useState<LauncherView>('workspace-launcher-view', () => 'recent')
  const assistantOpen = useState<boolean>('workspace-assistant-open', () => false)
  const modelConnectionOpen = useState<boolean>('workspace-model-connection-open', () => false)
  const shortcutGuideOpen = useState<boolean>('workspace-shortcut-guide-open', () => false)
  const walkthroughOpen = useState<boolean>('workspace-walkthrough-open', () => false)
  const screen = computed(() => (launcherOpen.value ? 'home' : 'editor'))

  const showHome = () => {
    assistantOpen.value = false
    modelConnectionOpen.value = false
    shortcutGuideOpen.value = false
    walkthroughOpen.value = false
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

  const toggleAssistant = () => {
    shortcutGuideOpen.value = false
    walkthroughOpen.value = false
    assistantOpen.value = !assistantOpen.value
    if (!assistantOpen.value) modelConnectionOpen.value = false
  }

  const showShortcutGuide = () => {
    assistantOpen.value = false
    walkthroughOpen.value = false
    shortcutGuideOpen.value = true
  }

  const showWalkthrough = () => {
    assistantOpen.value = false
    shortcutGuideOpen.value = false
    walkthroughOpen.value = true
  }

  return {
    screen,
    launcherOpen,
    launcherView,
    assistantOpen,
    modelConnectionOpen,
    shortcutGuideOpen,
    walkthroughOpen,
    showHome,
    showEditor,
    requestOpen,
    requestNew,
    toggleAssistant,
    showShortcutGuide,
    showWalkthrough,
  }
}
