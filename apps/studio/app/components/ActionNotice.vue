<script setup lang="ts">
import { Check, RefreshCw, X } from '@lucide/vue'

const { dismiss, notice } = useActionNotice()
const retrying = ref(false)

const retry = async () => {
  if (!notice.value?.retry || retrying.value) return
  retrying.value = true
  try {
    await notice.value.retry()
  } finally {
    retrying.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="action-notice">
      <section
        v-if="notice"
        class="action-notice"
        :class="notice.tone"
        :role="notice.tone === 'error' ? 'alert' : 'status'"
        :aria-live="notice.tone === 'error' ? 'assertive' : 'polite'"
        aria-atomic="true"
      >
        <Check v-if="notice.tone === 'success'" :size="15" aria-hidden="true" />
        <span>{{ notice.message }}</span>
        <button v-if="notice.retry" type="button" :disabled="retrying" @click="retry">
          <RefreshCw :class="{ spin: retrying }" :size="13" aria-hidden="true" />
          Retry
        </button>
        <button type="button" aria-label="Dismiss notification" @click="dismiss">
          <X :size="14" aria-hidden="true" />
        </button>
      </section>
    </Transition>
  </Teleport>
</template>
