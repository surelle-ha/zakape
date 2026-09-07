export type ActionNotice = {
  tone: 'success' | 'error'
  message: string
  retry?: () => void | Promise<void>
}

let dismissTimer: number | null = null

export const useActionNotice = () => {
  const notice = useState<ActionNotice | null>('action-notice', () => null)

  const dismiss = () => {
    if (dismissTimer !== null) window.clearTimeout(dismissTimer)
    dismissTimer = null
    notice.value = null
  }

  const show = (next: ActionNotice, dismissAfterMs?: number) => {
    dismiss()
    notice.value = next
    if (dismissAfterMs) dismissTimer = window.setTimeout(dismiss, dismissAfterMs)
  }

  return {
    dismiss,
    notice,
    showError: (message: string, retry: () => void | Promise<void>) =>
      show({ tone: 'error', message, retry }),
    showSuccess: (message: string) => show({ tone: 'success', message }, 4_000),
  }
}
