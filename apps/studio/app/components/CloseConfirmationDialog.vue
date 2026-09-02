<script setup lang="ts">
import { CircleAlert, LoaderCircle, X } from '@lucide/vue'

const props = defineProps<{
  kind: 'project' | 'application'
  projectName?: string
  projectCount?: number
  busy?: boolean
  error?: string
}>()

const emit = defineEmits<{
  cancel: []
  confirm: []
}>()

const dialog = ref<HTMLElement | null>(null)
const cancelButton = ref<HTMLButtonElement | null>(null)
let returnFocus: HTMLElement | null = null

const title = computed(() =>
  props.kind === 'project' ? `Close “${props.projectName || 'Untitled sprite'}”?` : 'Exit Zakape?',
)
const description = computed(() => {
  if (props.kind === 'project') {
    return 'Zakape will save this project to Documents/zakape before closing its tab.'
  }
  const count = props.projectCount ?? 0
  return `${count || 'No'} open project${count === 1 ? '' : 's'} will be saved before Zakape exits.`
})
const cancelLabel = computed(() => (props.kind === 'project' ? 'Keep open' : 'Keep working'))
const confirmLabel = computed(() => (props.kind === 'project' ? 'Close project' : 'Exit Zakape'))

const cancel = () => {
  if (!props.busy) emit('cancel')
}

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    event.preventDefault()
    cancel()
    return
  }
  if (event.key !== 'Tab' || !dialog.value) return
  const controls = [...dialog.value.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
  if (!controls.length) return
  const currentIndex = controls.indexOf(document.activeElement as HTMLButtonElement)
  const nextIndex = event.shiftKey
    ? (currentIndex - 1 + controls.length) % controls.length
    : (currentIndex + 1) % controls.length
  event.preventDefault()
  controls[nextIndex]?.focus()
}

onMounted(async () => {
  returnFocus = document.activeElement as HTMLElement | null
  await nextTick()
  cancelButton.value?.focus()
})

onBeforeUnmount(() => returnFocus?.focus())
</script>

<template>
  <Teleport to="body">
    <div class="close-confirmation-backdrop" @click.self="cancel">
      <section
        ref="dialog"
        class="close-confirmation-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="close-confirmation-title"
        aria-describedby="close-confirmation-description"
        @keydown="onKeydown"
      >
        <div class="close-confirmation-icon" aria-hidden="true">
          <CircleAlert :size="18" />
        </div>
        <div class="close-confirmation-copy">
          <span class="eyebrow">Confirm close</span>
          <h2 id="close-confirmation-title">{{ title }}</h2>
          <p id="close-confirmation-description">{{ description }}</p>
          <p v-if="error" class="close-confirmation-error" role="alert">{{ error }}</p>
        </div>
        <button
          class="close-confirmation-x"
          type="button"
          aria-label="Cancel closing"
          :disabled="busy"
          @click="cancel"
        >
          <X :size="15" />
        </button>
        <div class="close-confirmation-actions">
          <button
            ref="cancelButton"
            type="button"
            class="button-secondary"
            :disabled="busy"
            @click="cancel"
          >
            {{ cancelLabel }}
          </button>
          <button
            type="button"
            class="button-danger"
            :disabled="busy"
            :aria-busy="busy"
            @click="emit('confirm')"
          >
            <LoaderCircle v-if="busy" class="spin" :size="14" />
            {{ busy ? 'Saving…' : confirmLabel }}
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
