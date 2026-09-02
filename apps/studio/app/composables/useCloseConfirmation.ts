export type CloseRequest = { kind: 'project'; documentId: string } | { kind: 'application' }

export const useCloseConfirmation = () => {
  const closeRequest = useState<CloseRequest | null>('close-confirmation-request', () => null)

  const requestProjectClose = (documentId: string) => {
    closeRequest.value = { kind: 'project', documentId }
  }

  const requestApplicationClose = () => {
    closeRequest.value = { kind: 'application' }
  }

  const cancelClose = () => {
    closeRequest.value = null
  }

  return {
    closeRequest,
    requestProjectClose,
    requestApplicationClose,
    cancelClose,
  }
}
