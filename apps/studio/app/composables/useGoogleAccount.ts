export interface GoogleAccountProfile {
  id: string
  email: string
  name: string
  picture?: string
}

export type AccountAccessChoice = 'guest' | 'google'

interface GoogleAuthConfiguration {
  available: boolean
  featureEnabled: boolean
  platform: 'android' | 'ios' | 'desktop'
  clientConfigured: boolean
}

interface GoogleAuthSession {
  accessToken: string
  expiresAt: number
  account: GoogleAccountProfile
}

const profilePreference = 'google-account-profile'
const accessPreference = 'account-access-choice'

const isTauriRuntime = () => import.meta.client && '__TAURI_INTERNALS__' in window

const invokeNative = async <T>(command: string, args: Record<string, unknown> = {}) => {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, args)
}

export const useGoogleAccount = () => {
  const configuration = useState<GoogleAuthConfiguration | null>(
    'google-auth-configuration',
    () => null,
  )
  const account = useState<GoogleAccountProfile | null>('google-account-profile', () => null)
  const accessToken = useState<string | null>('google-access-token', () => null)
  const expiresAt = useState<number>('google-token-expiry', () => 0)
  const status = useState<'idle' | 'loading' | 'authenticated' | 'error'>(
    'google-auth-status',
    () => 'idle',
  )
  const errorMessage = useState<string>('google-auth-error', () => '')
  const dialogOpen = useState<boolean>('google-account-dialog-open', () => false)
  const initialized = useState<boolean>('google-auth-initialized', () => false)
  const ready = useState<boolean>('google-auth-ready', () => false)
  const accessChoice = useState<AccountAccessChoice | null>('account-access-choice', () => null)
  const { loadPreference, savePreference } = useProjectRepository()

  const applySession = async (session: GoogleAuthSession) => {
    accessToken.value = session.accessToken
    expiresAt.value = session.expiresAt
    account.value = session.account
    status.value = 'authenticated'
    errorMessage.value = ''
    accessChoice.value = 'google'
    await Promise.all([
      savePreference(profilePreference, session.account),
      savePreference(accessPreference, 'google'),
    ])
  }

  const loadConfiguration = async () => {
    if (!isTauriRuntime()) {
      configuration.value = {
        available: false,
        featureEnabled: false,
        platform: 'desktop',
        clientConfigured: false,
      }
      return configuration.value
    }
    configuration.value = await invokeNative<GoogleAuthConfiguration>('google_auth_configuration')
    return configuration.value
  }

  const refreshSession = async () => {
    if (!configuration.value?.available) return null
    try {
      status.value = 'loading'
      const session = await invokeNative<GoogleAuthSession>('google_auth_refresh')
      await applySession(session)
      return session.accessToken
    } catch (error) {
      accessToken.value = null
      expiresAt.value = 0
      account.value = null
      accessChoice.value = null
      status.value = 'idle'
      errorMessage.value = error instanceof Error ? error.message : String(error)
      await Promise.all([
        savePreference(profilePreference, null),
        savePreference(accessPreference, null),
      ])
      return null
    }
  }

  const initialize = async () => {
    if (!import.meta.client || initialized.value) return
    initialized.value = true
    try {
      const config = await loadConfiguration()
      const savedChoice = await loadPreference<AccountAccessChoice>(accessPreference)
      accessChoice.value = ['guest', 'google'].includes(savedChoice ?? '') ? savedChoice : null
      if (accessChoice.value !== 'google') return
      if (!config.available) {
        accessChoice.value = null
        await savePreference(accessPreference, null)
        return
      }
      const savedProfile = await loadPreference<GoogleAccountProfile>(profilePreference)
      if (!savedProfile) {
        accessChoice.value = null
        await savePreference(accessPreference, null)
        return
      }
      account.value = savedProfile
      await refreshSession()
    } catch (error) {
      status.value = 'error'
      errorMessage.value = error instanceof Error ? error.message : String(error)
    } finally {
      ready.value = true
    }
  }

  const continueAsGuest = async () => {
    account.value = null
    accessToken.value = null
    expiresAt.value = 0
    status.value = 'idle'
    errorMessage.value = ''
    accessChoice.value = 'guest'
    await savePreference(accessPreference, 'guest')
  }

  const signIn = async () => {
    if (!configuration.value) await loadConfiguration()
    if (!configuration.value?.available) {
      errorMessage.value = configuration.value?.featureEnabled
        ? 'Google sign-in credentials have not been configured for this build.'
        : 'Google sign-in is not included in this build. Guest access remains available.'
      status.value = 'error'
      return false
    }
    status.value = 'loading'
    errorMessage.value = ''
    try {
      const session = await invokeNative<GoogleAuthSession>('google_auth_sign_in')
      await applySession(session)
      return true
    } catch (error) {
      status.value = 'error'
      errorMessage.value = error instanceof Error ? error.message : String(error)
      return false
    }
  }

  const signOut = async () => {
    status.value = 'loading'
    errorMessage.value = ''
    try {
      if (isTauriRuntime()) {
        await invokeNative('google_auth_sign_out', { accessToken: accessToken.value })
      }
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : String(error)
    } finally {
      account.value = null
      accessToken.value = null
      expiresAt.value = 0
      accessChoice.value = null
      status.value = 'idle'
      await Promise.all([
        savePreference(profilePreference, null),
        savePreference(accessPreference, null),
      ])
    }
  }

  const getAccessToken = async () => {
    if (!account.value) return null
    if (accessToken.value && expiresAt.value > Date.now() / 1000 + 90) return accessToken.value
    return refreshSession()
  }

  return {
    configuration,
    account,
    status,
    errorMessage,
    dialogOpen,
    ready,
    accessChoice,
    authenticated: computed(() => Boolean(account.value)),
    authenticationRequired: computed(() => ready.value && !accessChoice.value),
    initialize,
    continueAsGuest,
    signIn,
    signOut,
    refreshSession,
    getAccessToken,
  }
}
