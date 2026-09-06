import type { SpriteProject } from '~/types/editor'
import type { ImportedSpritePayload } from '~/utils/import'
import { importedSpriteProject } from '~/utils/import'
import { parseSpriteProject } from '~/utils/project'
import type { GodotProjectConnection, GodotResourceIndex, GodotResourceEntry } from '~/utils/godot'

interface GodotImportResult {
  kind: 'sprite' | 'zakape'
  fileName: string
  sprite: ImportedSpritePayload | null
  contents: string | null
}

interface GodotAssetFile {
  relativePath: string
  contents: number[]
}

interface GodotWriteResult {
  written: string[]
}

interface GodotProjectDiscovery {
  projects: GodotProjectConnection[]
  selectedProjectPath: string | null
  selectedDirectory: string
}

const connectionPreference = 'godot-project-connections'
const activePreference = 'godot-active-project'
const isTauriRuntime = () => import.meta.client && '__TAURI_INTERNALS__' in window
let resourceRefreshId = 0
let initializationPromise: Promise<void> | null = null

const invokeDesktop = async <T>(command: string, args?: Record<string, unknown>) => {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, args)
}

export const useGodotWorkspace = () => {
  const available = useState<boolean>('godot-available', () => false)
  const initialized = useState<boolean>('godot-initialized', () => false)
  const projects = useState<GodotProjectConnection[]>('godot-projects', () => [])
  const activeProjectPath = useState<string>('godot-active-project-path', () => '')
  const resources = useState<GodotResourceEntry[]>('godot-resources', () => [])
  const resourcesTruncated = useState<boolean>('godot-resources-truncated', () => false)
  const busy = useState<string>('godot-busy', () => '')
  const error = useState<string>('godot-error', () => '')
  const notice = useState<string>('godot-notice', () => '')
  const { loadPreference, savePreference } = useProjectRepository()

  const activeProject = computed(
    () => projects.value.find((project) => project.rootPath === activeProjectPath.value) ?? null,
  )

  const saveConnections = async () => {
    await Promise.all([
      savePreference(connectionPreference, projects.value.slice(0, 16)),
      savePreference(activePreference, activeProjectPath.value),
    ])
  }

  const refreshResources = async (announce = false) => {
    const refreshId = ++resourceRefreshId
    const selected = activeProject.value
    resources.value = []
    resourcesTruncated.value = false
    if (!available.value || !selected || selected.availability === 'missing') return
    busy.value = 'resources'
    error.value = ''
    try {
      const index = await invokeDesktop<GodotResourceIndex>('godot_list_resources', {
        projectPath: selected.rootPath,
      })
      if (refreshId !== resourceRefreshId || activeProjectPath.value !== selected.rootPath) return
      resources.value = index.entries
      resourcesTruncated.value = index.truncated
      if (announce) {
        notice.value = `Indexed ${index.entries.length.toLocaleString()} res:// item${index.entries.length === 1 ? '' : 's'}.`
      }
    } catch (caught) {
      if (refreshId === resourceRefreshId) {
        error.value = caught instanceof Error ? caught.message : String(caught)
      }
    } finally {
      if (refreshId === resourceRefreshId) busy.value = ''
    }
  }

  const initialize = async () => {
    if (!import.meta.client) return
    if (initializationPromise) {
      await initializationPromise
      return
    }
    if (initialized.value) {
      if (available.value) await refreshResources()
      return
    }
    initialized.value = true
    if (!isTauriRuntime()) return
    initializationPromise = (async () => {
      try {
        const desktopAvailable = await invokeDesktop<boolean>('godot_integration_available')
        if (!desktopAvailable) return
        const [savedProjects, savedActive] = await Promise.all([
          loadPreference<GodotProjectConnection[]>(connectionPreference),
          loadPreference<string>(activePreference),
        ])
        const candidates = Array.isArray(savedProjects) ? savedProjects.slice(0, 16) : []
        projects.value = await Promise.all(
          candidates.map(async (candidate) => {
            try {
              const inspected = await invokeDesktop<GodotProjectConnection>(
                'godot_inspect_project',
                { projectPath: candidate.rootPath },
              )
              return { ...inspected, availability: 'ready' as const }
            } catch {
              return { ...candidate, availability: 'missing' as const }
            }
          }),
        )
        activeProjectPath.value =
          projects.value.find((project) => project.rootPath === savedActive)?.rootPath ??
          projects.value.find((project) => project.availability !== 'missing')?.rootPath ??
          projects.value[0]?.rootPath ??
          ''
        available.value = true
        await refreshResources()
      } catch (caught) {
        initialized.value = false
        error.value = caught instanceof Error ? caught.message : String(caught)
      }
    })()
    try {
      await initializationPromise
    } finally {
      initializationPromise = null
    }
  }

  const scanFolder = async (): Promise<string | null> => {
    if (initializationPromise) await initializationPromise
    if (!available.value) return null
    error.value = ''
    notice.value = ''
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({
      directory: true,
      multiple: false,
      title: 'Choose a Godot project or projects folder',
    })
    if (!selected || Array.isArray(selected)) return null
    busy.value = 'scan'
    try {
      const discovery = await invokeDesktop<GodotProjectDiscovery>('godot_discover_projects', {
        searchPath: selected,
      })
      const discovered = discovery.projects
      if (!discovered.length) {
        throw new Error('No project.godot files were found within six folder levels.')
      }
      const byPath = new Map(projects.value.map((project) => [project.rootPath, project]))
      discovered.forEach((project) =>
        byPath.set(project.rootPath, { ...project, availability: 'ready' }),
      )
      projects.value = [...byPath.values()].slice(0, 16)
      activeProjectPath.value =
        discovered.find((project) => project.rootPath === discovery.selectedProjectPath)
          ?.rootPath ?? discovered[0]!.rootPath
      notice.value = discovery.selectedDirectory
        ? `Connected ${discovered[0]!.name} and opened res://${discovery.selectedDirectory}.`
        : `Connected ${discovered.length} Godot project${discovered.length === 1 ? '' : 's'}.`
      await saveConnections()
      await refreshResources()
      return discovery.selectedDirectory
    } catch (caught) {
      error.value = caught instanceof Error ? caught.message : String(caught)
      return null
    } finally {
      busy.value = ''
    }
  }

  const selectProject = async (rootPath: string) => {
    activeProjectPath.value = rootPath
    error.value = ''
    notice.value = ''
    await savePreference(activePreference, rootPath)
    await refreshResources()
  }

  const removeProject = async (rootPath: string) => {
    projects.value = projects.value.filter((project) => project.rootPath !== rootPath)
    if (activeProjectPath.value === rootPath) {
      activeProjectPath.value = projects.value[0]?.rootPath ?? ''
    }
    await saveConnections()
    await refreshResources()
  }

  const createDirectory = async (relativePath: string) => {
    const selected = activeProject.value
    if (!selected) throw new Error('Connect a Godot project first.')
    busy.value = 'create-folder'
    error.value = ''
    try {
      const path = await invokeDesktop<string>('godot_create_directory', {
        projectPath: selected.rootPath,
        relativePath,
      })
      notice.value = `Created res://${path}.`
      await refreshResources()
      return path
    } finally {
      busy.value = ''
    }
  }

  const importResource = async (relativePath: string): Promise<SpriteProject> => {
    const selected = activeProject.value
    if (!selected) throw new Error('Connect a Godot project first.')
    busy.value = 'import'
    error.value = ''
    try {
      const result = await invokeDesktop<GodotImportResult>('godot_import_resource', {
        projectPath: selected.rootPath,
        relativePath,
      })
      if (result.kind === 'sprite' && result.sprite) {
        return importedSpriteProject(result.sprite, 'godot')
      }
      if (result.kind === 'zakape' && result.contents) {
        return parseSpriteProject(JSON.parse(result.contents))
      }
      throw new Error('That Godot resource could not be converted into a Zakape project.')
    } finally {
      busy.value = ''
    }
  }

  const assetConflicts = async (relativePaths: string[]) => {
    const selected = activeProject.value
    if (!selected) throw new Error('Connect a Godot project first.')
    return invokeDesktop<string[]>('godot_asset_conflicts', {
      projectPath: selected.rootPath,
      relativePaths,
    })
  }

  const writeAssets = async (files: GodotAssetFile[], overwrite: boolean) => {
    const selected = activeProject.value
    if (!selected) throw new Error('Connect a Godot project first.')
    busy.value = 'publish'
    error.value = ''
    try {
      const result = await invokeDesktop<GodotWriteResult>('godot_write_assets', {
        projectPath: selected.rootPath,
        files,
        overwrite,
      })
      notice.value = `Published ${result.written.length} asset${result.written.length === 1 ? '' : 's'} to Godot.`
      await refreshResources()
      return result
    } finally {
      busy.value = ''
    }
  }

  return {
    available,
    initialized,
    projects,
    activeProjectPath,
    activeProject,
    resources,
    resourcesTruncated,
    busy,
    error,
    notice,
    initialize,
    scanFolder,
    selectProject,
    removeProject,
    refreshResources,
    createDirectory,
    importResource,
    assetConflicts,
    writeAssets,
  }
}
