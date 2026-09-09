<script setup lang="ts">
import { Check, Moon, Sun } from '@lucide/vue'
import type { AppearancePreference } from '~/types/editor'
import {
  ACCENT_PRESETS,
  accentReadable,
  normalizeAccent,
  deriveAppearanceTokens,
} from '~/utils/appearance'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; applied: [] }>()
const { applied, persist, defaults } = useAppearanceSettings()
const draft = ref<AppearancePreference>({ ...applied.value })
const saving = ref(false)
const error = ref('')

const preview = (next: AppearancePreference) => {
  draft.value = next
  if (import.meta.client) {
    document.documentElement.dataset.theme = next.theme
    for (const [name, value] of Object.entries(deriveAppearanceTokens(next)))
      document.documentElement.style.setProperty(name, value)
  }
  error.value = accentReadable(next.accent, next.theme)
    ? ''
    : 'Choose a darker or lighter accent so controls remain readable.'
}
const resetDraft = () => preview(defaults())
const close = () => {
  preview(applied.value)
  emit('close')
}
const apply = async () => {
  if (error.value) return
  saving.value = true
  try {
    await persist(draft.value)
    emit('applied')
    emit('close')
  } catch {
    error.value = 'Zakape could not save appearance yet. Try again.'
  } finally {
    saving.value = false
  }
}
const setAccent = (value: string) =>
  preview({ ...draft.value, accent: normalizeAccent(value, draft.value.accent) })
watch(
  () => props.open,
  (open) => {
    if (open) {
      draft.value = { ...applied.value }
      error.value = ''
    }
  },
)
</script>

<template>
  <SettingsDialogShell
    :open="open"
    eyebrow="Editor appearance"
    title="Shape the workbench"
    description="Keep the canvas neutral, then choose the accent and contrast that help you draw."
    :busy="saving"
    @close="close"
    @apply="apply"
    @restore="resetDraft"
  >
    <section class="settings-section" aria-labelledby="appearance-theme-label">
      <div class="settings-section-heading">
        <strong id="appearance-theme-label">Theme</strong
        ><small>Explicit mode; Zakape will not follow system changes.</small>
      </div>
      <div class="settings-choice-grid" role="group" aria-label="Theme">
        <button
          type="button"
          :class="{ active: draft.theme === 'dark' }"
          :aria-pressed="draft.theme === 'dark'"
          @click="preview({ ...draft, theme: 'dark' })"
        >
          <Moon :size="16" /><span><strong>Dark</strong><small>Graphite studio</small></span
          ><Check v-if="draft.theme === 'dark'" :size="14" />
        </button>
        <button
          type="button"
          :class="{ active: draft.theme === 'light' }"
          :aria-pressed="draft.theme === 'light'"
          @click="preview({ ...draft, theme: 'light' })"
        >
          <Sun :size="16" /><span><strong>Light</strong><small>Drafting paper</small></span
          ><Check v-if="draft.theme === 'light'" :size="14" />
        </button>
      </div>
    </section>
    <section class="settings-section" aria-labelledby="appearance-accent-label">
      <div class="settings-section-heading">
        <strong id="appearance-accent-label">Accent</strong
        ><small>Used for focus, active tools, outlines, and primary actions.</small>
      </div>
      <div class="accent-preset-row" role="group" aria-label="Accent presets">
        <button
          v-for="preset in ACCENT_PRESETS"
          :key="preset.id"
          type="button"
          class="accent-preset"
          :class="{ active: draft.accent === preset.color }"
          :aria-label="preset.label"
          :aria-pressed="draft.accent === preset.color"
          @click="setAccent(preset.color)"
        >
          <i :style="{ background: preset.color }" /><span>{{ preset.label }}</span>
        </button>
      </div>
      <label class="settings-field"
        ><span>Custom accent</span>
        <div class="color-input-row">
          <input
            :value="draft.accent"
            type="color"
            aria-label="Custom accent color"
            @input="setAccent(($event.target as HTMLInputElement).value)"
          /><input
            :value="draft.accent"
            type="text"
            inputmode="text"
            maxlength="7"
            aria-label="Custom accent hex"
            @change="setAccent(($event.target as HTMLInputElement).value)"
          /></div
      ></label>
      <p v-if="error" class="settings-error" role="alert">{{ error }}</p>
    </section>
    <div class="settings-preview-strip" :style="{ '--preview-accent': draft.accent }">
      <span class="preview-dot" /><strong>Preview</strong
      ><span>Canvas chrome stays neutral; interaction color carries your choice.</span>
    </div>
  </SettingsDialogShell>
</template>
