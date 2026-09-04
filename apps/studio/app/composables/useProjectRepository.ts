import type { PGlite } from '@electric-sql/pglite'
import type { Pixel, SpriteProject } from '~/types/editor'
import { makeId, parseSpriteProject } from '~/utils/project'
import { getCompositePixels } from '~/utils/render'

let databasePromise: Promise<PGlite> | null = null

export interface WorkspaceProjectSummary {
  id: string
  name: string
  width: number
  height: number
  frameCount: number
  updatedAt: string
  folderId?: string | null
  preview?: WorkspaceProjectPreview
}

export interface WorkspaceFolder {
  id: string
  name: string
  parentId: string | null
  createdAt: string
}

export interface WorkspaceProjectPreview {
  width: number
  height: number
  pixels: Pixel[]
}

const previewEdge = 48
const folderPreference = 'workspace-folders'
const assignmentPreference = 'workspace-project-folders'

const normalizeFolders = (value: unknown): WorkspaceFolder[] => {
  if (!Array.isArray(value)) return []
  const folders = value
    .filter(
      (entry): entry is WorkspaceFolder =>
        Boolean(entry) &&
        typeof entry === 'object' &&
        typeof (entry as WorkspaceFolder).id === 'string' &&
        typeof (entry as WorkspaceFolder).name === 'string' &&
        typeof (entry as WorkspaceFolder).createdAt === 'string',
    )
    .slice(0, 128)
    .map((entry) => ({
      id: entry.id.slice(0, 128),
      name: entry.name.trim().slice(0, 48),
      parentId: typeof entry.parentId === 'string' ? entry.parentId.slice(0, 128) : null,
      createdAt: entry.createdAt,
    }))
    .filter((entry) => entry.id && entry.name)
  const ids = new Set(folders.map((folder) => folder.id))
  return folders.map((folder) => ({
    ...folder,
    parentId:
      folder.parentId && folder.parentId !== folder.id && ids.has(folder.parentId)
        ? folder.parentId
        : null,
  }))
}

const normalizeAssignments = (
  value: unknown,
  folders: WorkspaceFolder[],
): Record<string, string> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const folderIds = new Set(folders.map((folder) => folder.id))
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(
        ([projectId, folderId]) =>
          /^[a-z0-9_-]{1,128}$/i.test(projectId) &&
          typeof folderId === 'string' &&
          folderIds.has(folderId),
      )
      .slice(0, 1000),
  ) as Record<string, string>
}

export const createProjectPreview = (project: SpriteProject): WorkspaceProjectPreview => {
  const frameId = project.frames[0]!.id
  const source = getCompositePixels(project, frameId)
  const scale = Math.min(1, previewEdge / project.width, previewEdge / project.height)
  const width = Math.max(1, Math.round(project.width * scale))
  const height = Math.max(1, Math.round(project.height * scale))
  const pixels = Array.from({ length: width * height }, (_, index) => {
    const x = index % width
    const y = Math.floor(index / width)
    const sourceX = Math.min(project.width - 1, Math.floor(((x + 0.5) / width) * project.width))
    const sourceY = Math.min(project.height - 1, Math.floor(((y + 0.5) / height) * project.height))
    return source[sourceY * project.width + sourceX] ?? null
  })
  return { width, height, pixels }
}

const isTauriRuntime = () => import.meta.client && '__TAURI_INTERNALS__' in window

const invokeDesktop = async <T>(
  command: string,
  args: Record<string, unknown> = {},
): Promise<T> => {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(command, args)
}

const getDatabase = async () => {
  if (!databasePromise) {
    databasePromise = import('@electric-sql/pglite').then(async ({ PGlite }) => {
      const database = new PGlite('idb://zakape')
      await database.exec(`
        create table if not exists projects (
          id text primary key,
          name text not null,
          updated_at timestamptz not null,
          data jsonb not null
        );
        create index if not exists projects_updated_at on projects(updated_at desc);
        create table if not exists preferences (
          key text primary key,
          value jsonb not null
        );
      `)
      return database
    })
  }
  return databasePromise
}

export const useProjectRepository = () => {
  const persistenceState = useState<'idle' | 'loading' | 'saved' | 'error'>(
    'persistence-state',
    () => 'idle',
  )
  const workspaceDirectory = useState<string>('workspace-directory', () => 'Documents/zakape')
  const recentProjects = useState<WorkspaceProjectSummary[]>('workspace-projects', () => [])
  const workspaceFolders = useState<WorkspaceFolder[]>('workspace-folders', () => [])
  const projectFolderAssignments = useState<Record<string, string>>(
    'workspace-project-folder-assignments',
    () => ({}),
  )
  const activeLibraryFolder = useState<string>('workspace-active-folder', () => 'all')

  const databaseProjects = async (): Promise<WorkspaceProjectSummary[]> => {
    const database = await getDatabase()
    const result = await database.query<{ data: SpriteProject }>(
      'select data from projects order by updated_at desc limit 100',
    )
    return result.rows.flatMap(({ data }) => {
      try {
        const project = parseSpriteProject(data)
        return [
          {
            id: project.id,
            name: project.name,
            width: project.width,
            height: project.height,
            frameCount: project.frames.length,
            updatedAt: project.updatedAt,
            preview: createProjectPreview(project),
          },
        ]
      } catch {
        return []
      }
    })
  }

  const refreshProjects = async () => {
    if (!import.meta.client) return []
    persistenceState.value = 'loading'
    try {
      const [browserProjects, savedFolders, savedAssignments] = await Promise.all([
        databaseProjects(),
        loadPreference<WorkspaceFolder[]>(folderPreference),
        loadPreference<Record<string, string>>(assignmentPreference),
      ])
      workspaceFolders.value = normalizeFolders(savedFolders)
      projectFolderAssignments.value = normalizeAssignments(
        savedAssignments,
        workspaceFolders.value,
      )
      if (
        !['all', 'unfiled'].includes(activeLibraryFolder.value) &&
        !workspaceFolders.value.some((folder) => folder.id === activeLibraryFolder.value)
      ) {
        activeLibraryFolder.value = 'all'
      }
      let desktopProjects: WorkspaceProjectSummary[] = []
      if (isTauriRuntime()) {
        const [directory, projects] = await Promise.all([
          invokeDesktop<string>('workspace_directory'),
          invokeDesktop<WorkspaceProjectSummary[]>('workspace_list_projects'),
        ])
        workspaceDirectory.value = directory
        desktopProjects = projects
      }
      const projectsById = new Map(browserProjects.map((project) => [project.id, project]))
      desktopProjects.forEach((project) => {
        const browserProject = projectsById.get(project.id)
        projectsById.set(project.id, { ...project, preview: browserProject?.preview })
      })
      let projects = [...projectsById.values()]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, 100)
      if (isTauriRuntime()) {
        projects = await Promise.all(
          projects.map(async (summary, index) => {
            if (summary.preview || index >= 16) return summary
            try {
              const contents = await invokeDesktop<string>('workspace_read_project', {
                projectId: summary.id,
              })
              const project = parseSpriteProject(JSON.parse(contents))
              return { ...summary, preview: createProjectPreview(project) }
            } catch {
              return summary
            }
          }),
        )
      }
      recentProjects.value = projects.map((summary) => ({
        ...summary,
        folderId: projectFolderAssignments.value[summary.id] ?? null,
      }))
      persistenceState.value = 'idle'
      return recentProjects.value
    } catch (error) {
      console.warn('Zakape could not index the project working directory.', error)
      persistenceState.value = 'error'
      return []
    }
  }

  const loadProject = async (projectId: string): Promise<SpriteProject | null> => {
    if (!import.meta.client) return null
    persistenceState.value = 'loading'
    try {
      if (isTauriRuntime()) {
        try {
          const contents = await invokeDesktop<string>('workspace_read_project', { projectId })
          const project = parseSpriteProject(JSON.parse(contents))
          persistenceState.value = 'idle'
          return project
        } catch {
          // Projects created before the desktop directory existed can still be restored from PGlite.
        }
      }
      const database = await getDatabase()
      const result = await database.query<{ data: SpriteProject }>(
        'select data from projects where id = $1 limit 1',
        [projectId],
      )
      persistenceState.value = 'idle'
      return result.rows[0] ? parseSpriteProject(result.rows[0].data) : null
    } catch (error) {
      console.warn('Zakape could not open that project.', error)
      persistenceState.value = 'error'
      return null
    }
  }

  const loadLatest = async (): Promise<SpriteProject | null> => {
    if (!import.meta.client) return null
    persistenceState.value = 'loading'
    try {
      const database = await getDatabase()
      const result = await database.query<{ data: SpriteProject }>(
        'select data from projects order by updated_at desc limit 1',
      )
      persistenceState.value = 'idle'
      return result.rows[0] ? parseSpriteProject(result.rows[0].data) : null
    } catch (error) {
      console.warn('Zakape could not restore the local project.', error)
      persistenceState.value = 'error'
      return null
    }
  }

  const saveProject = async (project: SpriteProject) => {
    if (!import.meta.client) return false
    try {
      const database = await getDatabase()
      await database.query(
        `insert into projects (id, name, updated_at, data)
         values ($1, $2, $3, $4::jsonb)
         on conflict (id) do update
         set name = excluded.name, updated_at = excluded.updated_at, data = excluded.data`,
        [project.id, project.name, project.updatedAt, JSON.stringify(project)],
      )
      if (isTauriRuntime()) {
        await invokeDesktop<string>('workspace_write_project', {
          projectId: project.id,
          contents: JSON.stringify(project, null, 2),
        })
      }
      const summary: WorkspaceProjectSummary = {
        id: project.id,
        name: project.name,
        width: project.width,
        height: project.height,
        frameCount: project.frames.length,
        updatedAt: project.updatedAt,
        folderId: projectFolderAssignments.value[project.id] ?? null,
        preview: createProjectPreview(project),
      }
      recentProjects.value = [
        summary,
        ...recentProjects.value.filter((entry) => entry.id !== project.id),
      ]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, 100)
      persistenceState.value = 'saved'
      return true
    } catch (error) {
      console.warn('Zakape could not save the local project.', error)
      persistenceState.value = 'error'
      return false
    }
  }

  const loadPreference = async <T>(key: string): Promise<T | null> => {
    if (!import.meta.client) return null
    const database = await getDatabase()
    const result = await database.query<{ value: T }>(
      'select value from preferences where key = $1',
      [key],
    )
    return result.rows[0]?.value ?? null
  }

  const savePreference = async (key: string, value: unknown) => {
    if (!import.meta.client) return
    const database = await getDatabase()
    await database.query(
      `insert into preferences (key, value) values ($1, $2::jsonb)
       on conflict (key) do update set value = excluded.value`,
      [key, JSON.stringify(value)],
    )
  }

  const createWorkspaceFolder = async (name: string, parentId: string | null = null) => {
    const cleanName = name.trim().slice(0, 48)
    const cleanParentId = workspaceFolders.value.some((folder) => folder.id === parentId)
      ? parentId
      : null
    if (!cleanName) return null
    const duplicate = workspaceFolders.value.some(
      (folder) =>
        folder.parentId === cleanParentId && folder.name.toLowerCase() === cleanName.toLowerCase(),
    )
    if (duplicate) return null
    const folder: WorkspaceFolder = {
      id: makeId('folder'),
      name: cleanName,
      parentId: cleanParentId,
      createdAt: new Date().toISOString(),
    }
    workspaceFolders.value = [...workspaceFolders.value, folder]
    activeLibraryFolder.value = folder.id
    await savePreference(folderPreference, workspaceFolders.value)
    return folder
  }

  const assignProjectToFolder = async (projectId: string, folderId: string | null) => {
    const nextFolderId = workspaceFolders.value.some((folder) => folder.id === folderId)
      ? folderId
      : null
    const nextAssignments = { ...projectFolderAssignments.value }
    if (nextFolderId) nextAssignments[projectId] = nextFolderId
    else Reflect.deleteProperty(nextAssignments, projectId)
    projectFolderAssignments.value = nextAssignments
    recentProjects.value = recentProjects.value.map((project) =>
      project.id === projectId ? { ...project, folderId: nextFolderId } : project,
    )
    await savePreference(assignmentPreference, nextAssignments)
  }

  return {
    persistenceState,
    workspaceDirectory,
    recentProjects,
    workspaceFolders,
    projectFolderAssignments,
    activeLibraryFolder,
    refreshProjects,
    loadProject,
    loadLatest,
    saveProject,
    loadPreference,
    savePreference,
    createWorkspaceFolder,
    assignProjectToFolder,
  }
}
