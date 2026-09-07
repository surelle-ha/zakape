<script setup lang="ts">
const { columns, rows, dialogOpen, applySettings } = useTiledMode()
const columnDraft = ref('3')
const rowDraft = ref('3')
const closeButton = ref<HTMLButtonElement | null>(null)

const parsedColumns = computed(() => Number(columnDraft.value))
const parsedRows = computed(() => Number(rowDraft.value))
const valid = computed(
  () =>
    validTiledAxis(parsedColumns.value) &&
    validTiledAxis(parsedRows.value) &&
    columnDraft.value.trim() !== '' &&
    rowDraft.value.trim() !== '',
)
const warning = computed(() => valid.value && (parsedColumns.value > 5 || parsedRows.value > 5))
const close = () => {
  dialogOpen.value = false
}
const preset = (value: number) => {
  columnDraft.value = String(value)
  rowDraft.value = String(value)
}
const apply = async () => {
  if (!valid.value) return
  await applySettings(parsedColumns.value, parsedRows.value)
}
watch(dialogOpen, async (open) => {
  if (!open) return
  columnDraft.value = String(columns.value)
  rowDraft.value = String(rows.value)
  await nextTick()
  closeButton.value?.focus()
})
</script>

<template>
  <Teleport to="body">
    <div v-if="dialogOpen" class="tiled-mode-backdrop" @click.self="close">
      <section
        class="tiled-mode-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tiled-mode-heading"
        @keydown.esc.prevent="close"
      >
        <header>
          <div>
            <span class="eyebrow">Canvas presentation</span>
            <h2 id="tiled-mode-heading">Tiled Mode</h2>
          </div>
          <button
            ref="closeButton"
            type="button"
            aria-label="Close Tiled Mode settings"
            @click="close"
          >
            ×
          </button>
        </header>
        <p>Repeat one source canvas while every visible copy edits the same artwork.</p>
        <div class="tiled-mode-presets" aria-label="Tiled Mode presets">
          <button v-for="size in [2, 3, 5]" :key="size" type="button" @click="preset(size)">
            {{ size }}×{{ size }}
          </button>
        </div>
        <div class="tiled-mode-fields">
          <label>
            <span>Columns</span>
            <input
              v-model="columnDraft"
              type="number"
              min="2"
              max="9"
              step="1"
              inputmode="numeric"
            />
          </label>
          <label>
            <span>Rows</span>
            <input v-model="rowDraft" type="number" min="2" max="9" step="1" inputmode="numeric" />
          </label>
        </div>
        <p v-if="!valid" class="field-error" role="alert">Enter whole numbers from 2 through 9.</p>
        <p v-else-if="warning" class="tiled-mode-warning">
          More than five tiles on either axis can reduce drawing performance.
        </p>
        <small>For even grids, the upper-left tile of the central group is the source tile.</small>
        <footer>
          <button type="button" @click="close">Cancel</button>
          <button type="button" class="button-primary" :disabled="!valid" @click="apply">
            Apply layout
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
