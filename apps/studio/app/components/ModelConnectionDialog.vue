<script setup lang="ts">
import { Check, KeyRound, Link2, LoaderCircle, ShieldCheck, X } from '@lucide/vue'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const { connection, status, errorMessage, testConnection } = useAiAssistant()
const { loadPreference, savePreference } = useProjectRepository()

const baseUrl = ref(connection.value.baseUrl)
const model = ref(connection.value.model)
const apiKey = ref(connection.value.apiKey)
const saved = ref(false)

const saveConnection = async () => {
  connection.value = {
    baseUrl: baseUrl.value.trim().replace(/\/$/, ''),
    model: model.value.trim(),
    apiKey: apiKey.value,
  }
  await savePreference('model-connection', {
    baseUrl: connection.value.baseUrl,
    model: connection.value.model,
  })
  saved.value = true
  window.setTimeout(() => (saved.value = false), 1200)
}

const test = async () => {
  await saveConnection()
  await testConnection()
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    const preference = await loadPreference<{ baseUrl: string; model: string }>('model-connection')
    if (preference) {
      baseUrl.value = preference.baseUrl
      model.value = preference.model
    }
  },
)
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" role="presentation" @mousedown.self="emit('close')">
      <section
        class="connection-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connection-title"
      >
        <header>
          <div>
            <span class="eyebrow">Bring your own model</span>
            <h2 id="connection-title">Connect an art assistant</h2>
          </div>
          <button
            type="button"
            class="icon-button"
            aria-label="Close connection dialog"
            @click="emit('close')"
          >
            <X :size="18" />
          </button>
        </header>

        <div class="privacy-note">
          <ShieldCheck :size="19" />
          <p>
            <strong>Direct by design.</strong> Requests go from this device to your endpoint. The
            API key stays in memory and is never saved in the project database.
          </p>
        </div>

        <label class="field-label">
          <span><Link2 :size="14" /> Base URL</span>
          <input
            v-model="baseUrl"
            type="url"
            placeholder="http://localhost:11434/v1"
            autocomplete="url"
          />
          <small>Any OpenAI-compatible chat-completions endpoint.</small>
        </label>
        <label class="field-label">
          <span>Model ID</span>
          <input v-model="model" type="text" placeholder="qwen2.5-coder:7b" autocomplete="off" />
        </label>
        <label class="field-label">
          <span><KeyRound :size="14" /> API key <em>session only</em></span>
          <input
            v-model="apiKey"
            type="password"
            placeholder="Optional for local providers"
            autocomplete="off"
          />
        </label>

        <p v-if="errorMessage" class="inline-error">{{ errorMessage }}</p>
        <footer>
          <span v-if="status === 'connected'" class="connection-success"
            ><Check :size="14" /> Connection works</span
          >
          <span v-else />
          <button type="button" class="button-secondary" @click="saveConnection">
            <Check v-if="saved" :size="15" /> {{ saved ? 'Saved' : 'Save settings' }}
          </button>
          <button
            type="button"
            class="button-primary"
            :disabled="status === 'testing'"
            @click="test"
          >
            <LoaderCircle v-if="status === 'testing'" class="spin" :size="15" />
            {{ status === 'testing' ? 'Testing…' : 'Test connection' }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
