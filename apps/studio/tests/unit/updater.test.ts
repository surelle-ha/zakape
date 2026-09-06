import { computed, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const updaterMocks = vi.hoisted(() => ({ check: vi.fn() }))
const processMocks = vi.hoisted(() => ({ relaunch: vi.fn() }))

vi.mock('@tauri-apps/plugin-updater', () => ({ check: updaterMocks.check }))
vi.mock('@tauri-apps/plugin-process', () => ({ relaunch: processMocks.relaunch }))

describe('desktop updater lifecycle', () => {
  beforeEach(() => {
    vi.resetModules()
    updaterMocks.check.mockReset()
    processMocks.relaunch.mockReset()
    const states = new Map<string, ReturnType<typeof ref>>()
    vi.stubGlobal('computed', computed)
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { appVersion: '1.2.3' } }))
    vi.stubGlobal('useState', (key: string, factory: () => unknown) => {
      if (!states.has(key)) states.set(key, ref(factory()))
      return states.get(key)
    })
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: {},
    })
  })

  afterEach(() => {
    Reflect.deleteProperty(window, '__TAURI_INTERNALS__')
    vi.unstubAllGlobals()
  })

  it('releases a discovered update before performing another manual check', async () => {
    const previousUpdate = {
      version: '1.2.4',
      body: 'Patch notes',
      close: vi.fn().mockResolvedValue(undefined),
    }
    updaterMocks.check.mockResolvedValueOnce(previousUpdate).mockResolvedValueOnce(null)
    const { useAppUpdater } = await import('../../app/composables/useAppUpdater')
    const updater = useAppUpdater()
    updater.supported.value = true

    await updater.checkForUpdates(true)
    expect(updater.status.value).toBe('available')

    await updater.checkForUpdates(true)
    expect(previousUpdate.close).toHaveBeenCalledOnce()
    expect(updaterMocks.check).toHaveBeenCalledTimes(2)
    expect(updater.status.value).toBe('current')
    expect(updater.availableVersion.value).toBe('')
  })

  it('asks the installer to restart Windows and relaunches platforms where install returns', async () => {
    const update = {
      version: '1.2.4',
      body: '',
      close: vi.fn().mockResolvedValue(undefined),
      downloadAndInstall: vi.fn().mockResolvedValue(undefined),
    }
    updaterMocks.check.mockResolvedValue(update)
    processMocks.relaunch.mockResolvedValue(undefined)
    const { useAppUpdater } = await import('../../app/composables/useAppUpdater')
    const updater = useAppUpdater()
    updater.supported.value = true

    await updater.checkForUpdates(true)
    await updater.installUpdate()

    expect(update.downloadAndInstall).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 120_000,
      restartAfterInstall: true,
    })
    expect(processMocks.relaunch).toHaveBeenCalledOnce()
    expect(updater.status.value).toBe('ready')
  })
})
