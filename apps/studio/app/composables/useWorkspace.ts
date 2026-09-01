export type WorkspaceScreen = 'home' | 'editor'

export const useWorkspace = () => {
  const screen = useState<WorkspaceScreen>('workspace-screen', () => 'home')
  const openRequest = useState<number>('workspace-open-request', () => 0)
  const newRequest = useState<number>('workspace-new-request', () => 0)
  const requestedSize = useState<number>('workspace-new-size', () => 32)

  const showHome = () => {
    screen.value = 'home'
  }

  const showEditor = () => {
    screen.value = 'editor'
  }

  const requestOpen = () => {
    openRequest.value += 1
  }

  const requestNew = (size = 32) => {
    requestedSize.value = size
    newRequest.value += 1
  }

  return {
    screen,
    openRequest,
    newRequest,
    requestedSize,
    showHome,
    showEditor,
    requestOpen,
    requestNew,
  }
}
