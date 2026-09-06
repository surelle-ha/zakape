import { computed, ref } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const tauriMocks = vi.hoisted(() => ({ invoke: vi.fn(), open: vi.fn() }))

vi.mock('@tauri-apps/api/core', () => ({ invoke: tauriMocks.invoke }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: tauriMocks.open }))

describe('Godot workspace connection flow', () => {
  beforeEach(() => {
    vi.resetModules()
    tauriMocks.invoke.mockReset()
    tauriMocks.open.mockReset()
    const states = new Map<string, ReturnType<typeof ref>>()
    vi.stubGlobal('computed', computed)
    vi.stubGlobal('useState', (key: string, factory: () => unknown) => {
      if (!states.has(key)) states.set(key, ref(factory()))
      return states.get(key)
    })
    vi.stubGlobal('useProjectRepository', () => ({
      loadPreference: vi.fn().mockResolvedValue(null),
      savePreference: vi.fn().mockResolvedValue(undefined),
    }))
  })

  afterEach(() => vi.unstubAllGlobals())

  it('connects an owning project and returns the selected folder inside res://', async () => {
    tauriMocks.open.mockResolvedValue('C:\\game\\art\\characters')
    tauriMocks.invoke.mockImplementation(async (command: string) => {
      if (command === 'godot_discover_projects') {
        return {
          projects: [
            {
              rootPath: 'C:\\game',
              name: 'Pocket Quest',
              configVersion: 5,
              godotVersion: '4.6',
              compatibility: 'godot4',
            },
          ],
          selectedProjectPath: 'C:\\game',
          selectedDirectory: 'art/characters',
        }
      }
      if (command === 'godot_list_resources') {
        return {
          entries: [
            {
              path: 'art/characters',
              name: 'characters',
              kind: 'folder',
              isDirectory: true,
              size: 0,
              modifiedAt: null,
              importable: false,
            },
          ],
          truncated: false,
        }
      }
      throw new Error(`Unexpected command: ${command}`)
    })
    const { useGodotWorkspace } = await import('../../app/composables/useGodotWorkspace')
    const workspace = useGodotWorkspace()
    workspace.available.value = true

    const selectedDirectory = await workspace.scanFolder()

    expect(selectedDirectory).toBe('art/characters')
    expect(workspace.activeProject.value?.name).toBe('Pocket Quest')
    expect(workspace.resources.value).toHaveLength(1)
    expect(tauriMocks.invoke).toHaveBeenCalledWith('godot_list_resources', {
      projectPath: 'C:\\game',
    })
  })
})
