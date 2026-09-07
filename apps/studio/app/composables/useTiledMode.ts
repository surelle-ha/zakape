export interface TiledModePreference {
  version: 1
  enabled: boolean
  columns: number
  rows: number
}

const preferenceKey = 'canvas-tiled-mode'
const minAxis = 2
const maxAxis = 9

export const validTiledAxis = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= minAxis && value <= maxAxis

export const useTiledMode = () => {
  const enabled = useState<boolean>('tiled-mode-enabled', () => false)
  const columns = useState<number>('tiled-mode-columns', () => 3)
  const rows = useState<number>('tiled-mode-rows', () => 3)
  const dialogOpen = useState<boolean>('tiled-mode-dialog-open', () => false)
  const hydrated = useState<boolean>('tiled-mode-hydrated', () => false)
  const { loadPreference, savePreference } = useProjectRepository()

  const preference = (): TiledModePreference => ({
    version: 1,
    enabled: enabled.value,
    columns: columns.value,
    rows: rows.value,
  })

  const persist = async () => {
    if (!hydrated.value) return
    try {
      await savePreference(preferenceKey, preference())
    } catch (error) {
      console.warn('Zakape could not save the Tiled Mode preference.', error)
    }
  }

  const hydrate = async () => {
    try {
      const stored = await loadPreference<Partial<TiledModePreference>>(preferenceKey)
      if (stored?.version === 1) {
        enabled.value = stored.enabled === true
        columns.value = validTiledAxis(stored.columns) ? stored.columns : 3
        rows.value = validTiledAxis(stored.rows) ? stored.rows : 3
      }
    } catch (error) {
      console.warn('Zakape could not load the Tiled Mode preference.', error)
    } finally {
      hydrated.value = true
    }
  }

  const toggle = async () => {
    enabled.value = !enabled.value
    await persist()
  }

  const applySettings = async (nextColumns: number, nextRows: number) => {
    if (!validTiledAxis(nextColumns) || !validTiledAxis(nextRows)) return false
    columns.value = nextColumns
    rows.value = nextRows
    dialogOpen.value = false
    await persist()
    return true
  }

  return {
    enabled,
    columns,
    rows,
    dialogOpen,
    hydrated,
    effectiveColumns: computed(() => (enabled.value ? columns.value : 1)),
    effectiveRows: computed(() => (enabled.value ? rows.value : 1)),
    hydrate,
    persist,
    toggle,
    applySettings,
  }
}
