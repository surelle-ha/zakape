import type { PGlite } from '@electric-sql/pglite'
import type { SpriteProject } from '~/types/editor'

let databasePromise: Promise<PGlite> | null = null

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

  const loadLatest = async (): Promise<SpriteProject | null> => {
    if (!import.meta.client) return null
    persistenceState.value = 'loading'
    try {
      const database = await getDatabase()
      const result = await database.query<{ data: SpriteProject }>(
        'select data from projects order by updated_at desc limit 1',
      )
      persistenceState.value = 'idle'
      return result.rows[0]?.data ?? null
    } catch (error) {
      console.warn('Zakape could not restore the local project.', error)
      persistenceState.value = 'error'
      return null
    }
  }

  const saveProject = async (project: SpriteProject) => {
    if (!import.meta.client) return
    try {
      const database = await getDatabase()
      await database.query(
        `insert into projects (id, name, updated_at, data)
         values ($1, $2, $3, $4::jsonb)
         on conflict (id) do update
         set name = excluded.name, updated_at = excluded.updated_at, data = excluded.data`,
        [project.id, project.name, project.updatedAt, JSON.stringify(project)],
      )
      persistenceState.value = 'saved'
    } catch (error) {
      console.warn('Zakape could not save the local project.', error)
      persistenceState.value = 'error'
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

  return { persistenceState, loadLatest, saveProject, loadPreference, savePreference }
}
