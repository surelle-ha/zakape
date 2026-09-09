<script setup lang="ts">
import { X } from '@lucide/vue'

const props = defineProps<{
  open: boolean
  title: string
  eyebrow: string
  description: string
  busy?: boolean
  applyLabel?: string
}>()
const emit = defineEmits<{ close: []; apply: []; restore: [] }>()
const dialog = ref<HTMLElement | null>(null)
const headingId = computed(
  () => `settings-title-${props.eyebrow.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
)
let previousFocus: HTMLElement | null = null

const focusable = () =>
  Array.from(
    dialog.value?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ) ?? [],
  )

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    emit('close')
    return
  }
  if (event.key !== 'Tab') return
  const controls = focusable()
  const first = controls[0]
  const last = controls.at(-1)
  if (!first || !last) return
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(
  () => props.open,
  async (open) => {
    if (open) {
      previousFocus = document.activeElement as HTMLElement | null
      await nextTick()
      dialog.value?.focus()
    } else {
      await nextTick()
      previousFocus?.focus()
    }
  },
)
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="settings-backdrop" role="presentation" @mousedown.self="emit('close')">
      <section
        ref="dialog"
        class="settings-dialog"
        role="dialog"
        aria-modal="true"
        :aria-labelledby="headingId"
        tabindex="-1"
        @keydown.stop="onKeydown"
      >
        <header class="settings-dialog-header">
          <div>
            <span class="eyebrow">{{ eyebrow }}</span>
            <h2 :id="headingId">{{ title }}</h2>
            <p>{{ description }}</p>
          </div>
          <button
            type="button"
            class="icon-button"
            :aria-label="`Close ${title}`"
            @click="emit('close')"
          >
            <X :size="17" aria-hidden="true" />
          </button>
        </header>
        <div class="settings-dialog-body"><slot /></div>
        <footer class="settings-dialog-actions">
          <button type="button" class="button-quiet" :disabled="busy" @click="emit('restore')">
            Restore defaults
          </button>
          <span class="settings-action-status"><slot name="status" /></span>
          <button type="button" class="button-secondary" :disabled="busy" @click="emit('close')">
            Cancel
          </button>
          <button type="button" class="button-primary" :disabled="busy" @click="emit('apply')">
            {{ busy ? 'Saving…' : (applyLabel ?? 'Apply') }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
