<script setup lang="ts">
import { Check, Cloud, Cpu, KeyRound, Link2, LoaderCircle, ShieldCheck, X } from '@lucide/vue'
import type { ModelConnection, ModelProvider } from '~/types/editor'
import { OLLAMA_DEFAULT_URL, normalizeOllamaBaseUrl } from '~/composables/useAiAssistant'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const { connection, status, errorMessage, availableModels, testConnection, clearConnectionState } =
  useAiAssistant()
const { loadPreference, savePreference } = useProjectRepository()

const provider = ref<ModelProvider>(connection.value.provider)
const baseUrl = ref(connection.value.baseUrl)
const model = ref(connection.value.model)
const apiKey = ref(connection.value.apiKey)
const saved = ref(false)
const dialog = ref<HTMLElement | null>(null)
let previousFocus: HTMLElement | null = null

const isOllama = computed(() => provider.value === 'ollama')
const runtimeLabel = computed(() => {
  if (status.value === 'testing') return 'Checking'
  if (status.value === 'connected') {
    const count = availableModels.value.length
    return `${count} model${count === 1 ? '' : 's'} ready`
  }
  if (status.value === 'error') return 'Unavailable'
  return 'Not checked'
})

const switchProvider = (nextProvider: ModelProvider) => {
  if (provider.value === nextProvider) return
  provider.value = nextProvider
  baseUrl.value = nextProvider === 'ollama' ? OLLAMA_DEFAULT_URL : ''
  model.value = ''
  apiKey.value = ''
  clearConnectionState(nextProvider)
}

const draftConnection = (): ModelConnection => ({
  provider: provider.value,
  baseUrl: isOllama.value
    ? normalizeOllamaBaseUrl(baseUrl.value)
    : baseUrl.value.trim().replace(/\/$/, ''),
  model: model.value.trim(),
  apiKey: isOllama.value ? '' : apiKey.value,
})

const saveConnection = async (showConfirmation = true) => {
  try {
    connection.value = draftConnection()
    baseUrl.value = connection.value.baseUrl
    await savePreference('model-connection', {
      provider: connection.value.provider,
      baseUrl: connection.value.baseUrl,
      model: connection.value.model,
    })
    if (showConfirmation) {
      saved.value = true
      window.setTimeout(() => (saved.value = false), 1200)
    }
    return true
  } catch (error) {
    status.value = 'error'
    errorMessage.value = error instanceof Error ? error.message : 'These settings are invalid.'
    return false
  }
}

const test = async () => {
  if (!(await saveConnection(false))) return
  const models = await testConnection()
  if (!model.value && models[0]) {
    model.value = models[0].id
    connection.value.model = models[0].id
    await saveConnection(false)
  }
}

const handleDialogKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    emit('close')
    return
  }
  if (event.key !== 'Tab' || !dialog.value) return
  const focusable = Array.from(
    dialog.value.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), select:not(:disabled)',
    ),
  )
  if (!focusable.length) return
  const first = focusable[0]!
  const last = focusable.at(-1)!
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

watch(model, (nextModel) => {
  if (connection.value.provider === provider.value) connection.value.model = nextModel
})

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      await nextTick()
      previousFocus?.focus()
      return
    }
    previousFocus = document.activeElement as HTMLElement | null
    clearConnectionState()
    const preference = await loadPreference<Partial<ModelConnection>>('model-connection')
    if (preference?.baseUrl) {
      const inferredProvider: ModelProvider =
        preference.provider ??
        (/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]):11434(?:\/v1)?\/?$/i.test(preference.baseUrl)
          ? 'ollama'
          : 'openai-compatible')
      provider.value = inferredProvider
      baseUrl.value =
        inferredProvider === 'ollama'
          ? preference.baseUrl.replace(/\/v1\/?$/i, '')
          : preference.baseUrl
      model.value = preference.model ?? ''
      connection.value = {
        provider: inferredProvider,
        baseUrl: baseUrl.value,
        model: model.value,
        apiKey: connection.value.apiKey,
      }
    } else {
      provider.value = connection.value.provider
      baseUrl.value = connection.value.baseUrl
      model.value = connection.value.model
    }
    apiKey.value = connection.value.apiKey
    await nextTick()
    dialog.value?.focus()
  },
)
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="modal-backdrop" role="presentation" @mousedown.self="emit('close')">
      <section
        ref="dialog"
        class="connection-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connection-title"
        tabindex="-1"
        @keydown="handleDialogKeydown"
      >
        <header>
          <div>
            <span class="eyebrow">Model assistant</span>
            <h2 id="connection-title">Choose where the model runs</h2>
          </div>
          <button
            type="button"
            class="icon-button"
            aria-label="Close connection dialog"
            @click="emit('close')"
          >
            <X :size="18" aria-hidden="true" />
          </button>
        </header>

        <div class="provider-switch" role="group" aria-label="Model provider">
          <button
            type="button"
            :class="{ active: isOllama }"
            :aria-pressed="isOllama"
            @click="switchProvider('ollama')"
          >
            <Cpu :size="17" aria-hidden="true" />
            <span><strong>Ollama</strong><small>Local runtime</small></span>
          </button>
          <button
            type="button"
            :class="{ active: !isOllama }"
            :aria-pressed="!isOllama"
            @click="switchProvider('openai-compatible')"
          >
            <Cloud :size="17" aria-hidden="true" />
            <span><strong>Compatible API</strong><small>Local or hosted endpoint</small></span>
          </button>
        </div>

        <div class="privacy-note">
          <ShieldCheck :size="19" aria-hidden="true" />
          <p v-if="isOllama">
            <strong>On-device by default.</strong> Zakape connects only to Ollama on this computer's
            loopback address. Your prompt and canvas do not pass through Zakape servers.
          </p>
          <p v-else>
            <strong>Direct by design.</strong> Requests go from this device to your endpoint. The
            API key stays in memory and is never saved in the project database.
          </p>
        </div>

        <div v-if="isOllama" class="local-runtime" data-testid="ollama-runtime">
          <span class="runtime-glyph"><Cpu :size="17" aria-hidden="true" /></span>
          <span>
            <strong>Local runtime</strong>
            <small>{{ baseUrl || OLLAMA_DEFAULT_URL }}</small>
          </span>
          <span :class="['runtime-state', status]" aria-live="polite">
            <i aria-hidden="true" /> {{ runtimeLabel }}
          </span>
        </div>

        <label class="field-label">
          <span>
            <Link2 :size="14" aria-hidden="true" />
            {{ isOllama ? 'Ollama address' : 'Base URL' }}
            <em v-if="isOllama">Loopback only</em>
          </span>
          <input
            v-model="baseUrl"
            :name="isOllama ? 'ollama-url' : 'provider-url'"
            type="url"
            :placeholder="isOllama ? OLLAMA_DEFAULT_URL : 'https://api.example.com/v1'"
            autocomplete="url"
            spellcheck="false"
          />
          <small v-if="isOllama">Zakape supports 127.0.0.1, localhost, and [::1].</small>
          <small v-else>Any API that supports models and chat completions.</small>
        </label>

        <div v-if="isOllama" class="field-label">
          <span><label for="ollama-model">Installed model</label></span>
          <select
            id="ollama-model"
            v-model="model"
            name="ollama-model"
            :disabled="availableModels.length === 0"
          >
            <option value="" disabled>
              {{ availableModels.length ? 'Choose a model' : 'Find installed models first' }}
            </option>
            <option v-for="item in availableModels" :key="item.id" :value="item.id">
              {{ item.id }}
            </option>
          </select>
          <small>Models are discovered from the Ollama installation on this device.</small>
        </div>

        <template v-else>
          <label class="field-label">
            <span>Model ID</span>
            <input
              v-model="model"
              name="model-id"
              type="text"
              placeholder="provider/model-name"
              autocomplete="off"
              spellcheck="false"
            />
          </label>
          <label class="field-label">
            <span> <KeyRound :size="14" aria-hidden="true" /> API key <em>Session only</em> </span>
            <input
              v-model="apiKey"
              name="api-key"
              type="password"
              placeholder="Optional for endpoints without authentication"
              autocomplete="off"
              spellcheck="false"
            />
          </label>
        </template>

        <p v-if="errorMessage" class="inline-error" role="alert">{{ errorMessage }}</p>
        <footer>
          <span
            v-if="status === 'connected'"
            class="connection-success"
            role="status"
            aria-live="polite"
          >
            <Check :size="14" aria-hidden="true" />
            {{ isOllama ? 'Ollama is ready' : 'Connection works' }}
          </span>
          <span v-else />
          <button
            type="button"
            class="button-secondary"
            aria-live="polite"
            @click="saveConnection()"
          >
            <Check v-if="saved" :size="15" aria-hidden="true" />
            {{ saved ? 'Saved' : 'Save settings' }}
          </button>
          <button
            type="button"
            class="button-primary"
            :disabled="status === 'testing'"
            @click="test"
          >
            <LoaderCircle v-if="status === 'testing'" class="spin" :size="15" aria-hidden="true" />
            {{ status === 'testing' ? 'Checking…' : isOllama ? 'Find models' : 'Test connection' }}
          </button>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
