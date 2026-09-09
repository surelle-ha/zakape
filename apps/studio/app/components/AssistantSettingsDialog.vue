<script setup lang="ts">
import { Bot, Check, Cpu, Eye, KeyRound, ShieldCheck, SquareTerminal } from '@lucide/vue'
import type {
  AssistantPreference,
  AssistantSettingsTab,
  ModelConnection,
  ModelProvider,
} from '~/types/editor'
import {
  OLLAMA_DEFAULT_URL,
  normalizeCompatibleBaseUrl,
  normalizeOllamaBaseUrl,
  useAiAssistant,
} from '~/composables/useAiAssistant'
import { ASSISTANT_SKILLS, ASSISTANT_TOOL_CATALOG } from '~/utils/assistantSkills'
import { normalizeAssistantPreference } from '~/utils/editorSettings'

const props = defineProps<{ open: boolean; initialTab: AssistantSettingsTab }>()
const emit = defineEmits<{ close: []; applied: [] }>()
const { connection, status, errorMessage, availableModels, testConnection, clearConnectionState } =
  useAiAssistant()
const { loadPreference, savePreference } = useProjectRepository()
const { applied, persist, defaults } = useAssistantSettings()
const activeTab = ref<AssistantSettingsTab>('model')
const draft = ref<AssistantPreference>(defaults())
const provider = ref<ModelProvider>('ollama')
const baseUrl = ref(OLLAMA_DEFAULT_URL)
const model = ref('')
const apiKey = ref('')
const visionEnabled = ref(true)
const saving = ref(false)
const saved = ref(false)
const connectionSnapshot = ref<ModelConnection>({ ...connection.value })

const isOllama = computed(() => provider.value === 'ollama')
const isCompatible = computed(() => provider.value === 'openai-compatible')
const isCodex = computed(() => provider.value === 'codex-cli')
const setTab = (tab: AssistantSettingsTab) => (activeTab.value = tab)
const loadDrafts = async () => {
  connectionSnapshot.value = { ...connection.value }
  draft.value = normalizeAssistantPreference(applied.value)
  const preference = await loadPreference<Partial<ModelConnection>>('model-connection')
  provider.value = preference?.provider ?? connection.value.provider
  baseUrl.value = preference?.baseUrl ?? connection.value.baseUrl
  model.value = preference?.model ?? connection.value.model
  visionEnabled.value = preference?.visionEnabled ?? connection.value.visionEnabled
  apiKey.value = connection.value.apiKey
  clearConnectionState()
}
const switchProvider = (next: ModelProvider) => {
  provider.value = next
  baseUrl.value = next === 'ollama' ? OLLAMA_DEFAULT_URL : ''
  model.value = ''
  clearConnectionState(next)
}
const test = async () => {
  const candidate: ModelConnection = {
    provider: provider.value,
    baseUrl: isOllama.value
      ? normalizeOllamaBaseUrl(baseUrl.value)
      : isCompatible.value
        ? normalizeCompatibleBaseUrl(baseUrl.value)
        : '',
    model: model.value.trim(),
    apiKey: isCompatible.value ? apiKey.value : '',
    visionEnabled: visionEnabled.value,
  }
  const models = await testConnection(candidate)
  if (!isCodex.value && !model.value && models[0]) model.value = models[0].id
}
const apply = async () => {
  saving.value = true
  try {
    await persist(draft.value)
    connection.value = {
      provider: provider.value,
      baseUrl: isOllama.value
        ? normalizeOllamaBaseUrl(baseUrl.value)
        : isCompatible.value
          ? normalizeCompatibleBaseUrl(baseUrl.value)
          : '',
      model: model.value.trim(),
      apiKey: isCompatible.value ? apiKey.value : '',
      visionEnabled: visionEnabled.value,
    }
    await savePreference('model-connection', {
      provider: connection.value.provider,
      baseUrl: connection.value.baseUrl,
      model: connection.value.model,
      visionEnabled: connection.value.visionEnabled,
    })
    saved.value = true
    emit('applied')
    emit('close')
  } catch {
    // Keep the dialog and draft open; the caller can retry.
  } finally {
    saving.value = false
    window.setTimeout(() => (saved.value = false), 1200)
  }
}
const restore = () => {
  draft.value = defaults()
  provider.value = 'ollama'
  baseUrl.value = OLLAMA_DEFAULT_URL
  model.value = ''
  apiKey.value = ''
  visionEnabled.value = true
}
const close = () => {
  draft.value = normalizeAssistantPreference(applied.value)
  connection.value = { ...connectionSnapshot.value }
  emit('close')
}
watch(
  () => props.open,
  (open) => {
    if (open) {
      activeTab.value = props.initialTab
      void loadDrafts()
    }
  },
)
</script>

<template>
  <SettingsDialogShell
    :open="open"
    eyebrow="Art assistant"
    title="Assistant Settings"
    description="Tune the model, instructions, and bounded capabilities Zakape can use."
    :busy="saving"
    @close="close"
    @apply="apply"
    @restore="restore"
  >
    <nav class="settings-tabs" role="tablist" aria-label="Assistant settings sections">
      <button
        v-for="tab in ['model', 'instructions', 'skills', 'tools'] as AssistantSettingsTab[]"
        :key="tab"
        type="button"
        role="tab"
        :aria-selected="activeTab === tab"
        :class="{ active: activeTab === tab }"
        @click="setTab(tab)"
      >
        {{
          tab === 'model'
            ? 'Model'
            : tab === 'instructions'
              ? 'Instructions'
              : tab === 'skills'
                ? 'Skills'
                : 'Tools'
        }}
      </button>
    </nav>
    <section v-if="activeTab === 'model'" class="settings-section">
      <div class="provider-switch compact" role="group" aria-label="Model provider">
        <button type="button" :class="{ active: isOllama }" @click="switchProvider('ollama')">
          <Cpu :size="15" /><span>Ollama<small>Local</small></span></button
        ><button
          type="button"
          :class="{ active: isCompatible }"
          @click="switchProvider('openai-compatible')"
        >
          <Bot :size="15" /><span>Compatible API<small>Endpoint</small></span></button
        ><button type="button" :class="{ active: isCodex }" @click="switchProvider('codex-cli')">
          <SquareTerminal :size="15" /><span>Codex CLI<small>Desktop</small></span>
        </button>
      </div>
      <label v-if="!isCodex" class="settings-field"
        ><span>{{ isOllama ? 'Ollama address' : 'Base URL' }}</span
        ><input v-model="baseUrl" type="url" autocomplete="url"
      /></label>
      <label v-if="!isCodex" class="settings-field"
        ><span>Model {{ isCompatible ? 'ID' : '' }}</span
        ><select v-if="isOllama" v-model="model" aria-label="Installed model">
          <option value="">
            {{ availableModels.length ? 'Choose a model' : 'Find installed models' }}
          </option>
          <option v-for="item in availableModels" :key="item.id" :value="item.id">
            {{ item.id }}
          </option></select
        ><input v-else v-model="model" type="text" placeholder="provider/model-name"
      /></label>
      <label v-if="isCompatible" class="settings-field"
        ><span><KeyRound :size="13" /> API key <em>Session only</em></span
        ><input v-model="apiKey" type="password" autocomplete="off"
      /></label>
      <label v-if="isCodex" class="settings-field" data-testid="codex-runtime"
        ><span>Model override <em>Optional</em></span
        ><input
          v-model="model"
          type="text"
          placeholder="Use the Codex default"
          aria-label="Model override"
          autocomplete="off"
      /></label>
      <label class="assistant-vision-toggle"
        ><Eye :size="16" /><span
          ><strong>Rendered vision</strong
          ><small>Attach bounded previews for visual review.</small></span
        ><input v-model="visionEnabled" type="checkbox" aria-label="Enable rendered vision"
      /></label>
      <button type="button" class="button-secondary" :disabled="status === 'testing'" @click="test">
        {{
          status === 'testing'
            ? 'Checking…'
            : isOllama
              ? 'Find models'
              : isCodex
                ? 'Check Codex'
                : 'Test connection'
        }}
      </button>
      <p v-if="status === 'connected'" class="connection-success" role="status">
        <Check :size="13" />
        {{ isOllama ? 'Ollama is ready' : isCodex ? 'Codex is ready' : 'Connection works' }}
      </p>
      <p v-if="errorMessage" class="settings-error" role="alert">{{ errorMessage }}</p>
    </section>
    <section v-else-if="activeTab === 'instructions'" class="settings-section">
      <div class="settings-section-heading">
        <strong>Additional instruction</strong
        ><small>Zakape’s safety and pixel-art rules remain protected.</small>
      </div>
      <textarea
        v-model="draft.userInstruction"
        class="settings-textarea"
        maxlength="4000"
        rows="8"
        placeholder="Describe your preferred art direction, review style, or palette discipline…"
      /><small class="settings-count">{{ draft.userInstruction.length }}/4000</small>
    </section>
    <section v-else-if="activeTab === 'skills'" class="settings-section">
      <div class="settings-section-heading">
        <strong>Enabled skills</strong><small>At least one skill stays enabled.</small>
      </div>
      <label v-for="skill in ASSISTANT_SKILLS" :key="skill.id" class="settings-toggle-row"
        ><span
          ><strong>{{ skill.label }}</strong
          ><small>{{ skill.description }}</small></span
        ><input
          v-model="draft.enabledSkillIds"
          type="checkbox"
          :value="skill.id"
          :disabled="
            draft.enabledSkillIds.length === 1 && draft.enabledSkillIds.includes(skill.id)
          "
      /></label>
    </section>
    <section v-else class="settings-section">
      <div class="settings-section-heading">
        <strong>Function tools</strong
        ><small>Pixel writing stays enabled; other tools are optional.</small>
      </div>
      <label v-for="tool in ASSISTANT_TOOL_CATALOG" :key="tool.name" class="settings-toggle-row"
        ><span
          ><strong>{{ tool.name.replaceAll('_', ' ') }}</strong
          ><small>{{ tool.purpose }}</small></span
        ><input
          v-model="draft.enabledToolIds"
          type="checkbox"
          :value="tool.name"
          :disabled="tool.required"
      /></label>
    </section>
    <template #status
      ><span v-if="saved" class="connection-success"><Check :size="13" /> Saved</span
      ><span v-else><ShieldCheck :size="13" /> Local settings</span></template
    >
  </SettingsDialogShell>
</template>
