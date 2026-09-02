import type { PGlite } from '@electric-sql/pglite'
import type { SpriteProject } from '~/types/editor'
import { parseSpriteProject } from '~/utils/project'

let databasePromise: Promise<PGlite> | null = null

export interface WorkspaceProjectSummary {
  id: string
  name: string
  width: number
  height: number
  frameCount: number
  updatedAt: string
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
      const browserProjects = await databaseProjects()
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
      desktopProjects.forEach((project) => projectsById.set(project.id, project))
      recentProjects.value = [...projectsById.values()]
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .slice(0, 100)
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

  return {
    persistenceState,
    workspaceDirectory,
    recentProjects,
    refreshProjects,
    loadProject,
    loadLatest,
    saveProject,
    loadPreference,
    savePreference,
  }
}
