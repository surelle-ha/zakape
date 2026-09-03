<script setup lang="ts">
import {
  Bot,
  Check,
  Film,
  LoaderCircle,
  ScanLine,
  SendHorizontal,
  Settings2,
  Sparkles,
  UserRound,
  X,
} from '@lucide/vue'
import type { AssistantEditScope } from '~/types/editor'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const {
  project,
  activeFrameId,
  activeLayerId,
  activeLayer,
  applyProposal: applyEditorProposal,
} = useEditor()
const { modelConnectionOpen: connectionOpen } = useWorkspace()
const {
  connection,
  status,
  errorMessage,
  proposal,
  chatEntries,
  agentPass,
  requestProposal,
  loadChat,
  discardProposal,
  markProposalApplied,
} = useAiAssistant()
const prompt = ref('')
const scope = ref<AssistantEditScope>('frame')
const closeButton = ref<HTMLButtonElement | null>(null)
const promptInput = ref<HTMLTextAreaElement | null>(null)
const conversation = ref<HTMLElement | null>(null)
const activeFrameIndex = computed(() =>
  Math.max(
    0,
    project.value.frames.findIndex((frame) => frame.id === activeFrameId.value),
  ),
)
const proposalOperationCount = computed(
  () => proposal.value?.edits.reduce((total, edit) => total + edit.operations.length, 0) ?? 0,
)
const proposalFrameCount = computed(
  () =>
    new Set(
      proposal.value?.edits
        .filter((edit) => edit.operations.length > 0)
        .map((edit) => edit.frameId),
    ).size,
)
const proposalLayerCount = computed(
  () => proposal.value?.actions.filter((action) => action.type === 'create_layer').length ?? 0,
)
const proposalCreatedFrameCount = computed(
  () => proposal.value?.actions.filter((action) => action.type === 'create_frame').length ?? 0,
)
const workingLabel = computed(() =>
  agentPass.value.current <= 1
    ? 'Building the first pass'
    : `Reviewing the rendered result · pass ${agentPass.value.current}`,
)

const scrollToLatest = async () => {
  await nextTick()
  conversation.value?.scrollTo({ top: conversation.value.scrollHeight, behavior: 'smooth' })
}

const submitPrompt = async () => {
  const message = prompt.value.trim()
  if (!message || status.value === 'working') return
  if (!connection.value.model) {
    connectionOpen.value = true
    return
  }
  prompt.value = ''
  await requestProposal(
    message,
    project.value,
    activeFrameId.value,
    activeLayerId.value,
    scope.value,
  )
  await scrollToLatest()
  promptInput.value?.focus()
}

const applyProposal = () => {
  if (!proposal.value || !applyEditorProposal(proposal.value)) return
  markProposalApplied()
}

const selectScope = (nextScope: AssistantEditScope) => {
  if (scope.value === nextScope) return
  scope.value = nextScope
  discardProposal(true)
}

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && !connectionOpen.value) emit('close')
}

watch(
  () => [props.open, project.value.id] as const,
  async ([open, projectId]) => {
    if (!open) {
      connectionOpen.value = false
      return
    }
    await loadChat(projectId)
    await scrollToLatest()
    promptInput.value?.focus()
  },
  { immediate: true },
)
watch(() => chatEntries.value.length, scrollToLatest)
watch(status, (nextStatus) => nextStatus === 'working' && void scrollToLatest())
</script>

<template>
  <Teleport to="body">
    <Transition name="assistant-drawer">
      <aside
        v-if="open"
        class="assistant-drawer"
        aria-label="AI art assistant"
        @keydown="onKeydown"
      >
        <header class="assistant-drawer-heading">
          <span class="assistant-mark"><Sparkles :size="17" /></span>
          <div><span class="eyebrow">Agentic workspace</span><strong>Art assistant</strong></div>
          <div class="assistant-header-actions">
            <button
              v-tooltip="{
                text: 'Model management',
                detail: 'Choose local Ollama or a compatible endpoint.',
              }"
              type="button"
              class="assistant-model-button"
              :aria-label="`Manage model${connection.model ? `: ${connection.model}` : ''}`"
              @click="connectionOpen = true"
            >
              <span :class="['connection-indicator', { connected: status === 'connected' }]" />
              <Settings2 :size="14" />
            </button>
            <button
              ref="closeButton"
              type="button"
              aria-label="Close assistant"
              @click="emit('close')"
            >
              <X :size="16" />
            </button>
          </div>
        </header>

        <div class="assistant-chat-shell">
          <fieldset class="assistant-scope">
            <legend>Edit scope</legend>
            <div class="scope-switch">
              <button
                type="button"
                :class="{ active: scope === 'frame' }"
                :aria-pressed="scope === 'frame'"
                :disabled="status === 'working'"
                data-testid="assistant-scope-frame"
                @click="selectScope('frame')"
              >
                <ScanLine :size="14" />
                <span
                  ><strong>This frame</strong><small>Frame {{ activeFrameIndex + 1 }}</small></span
                >
              </button>
              <button
                type="button"
                :class="{ active: scope === 'sheet' }"
                :aria-pressed="scope === 'sheet'"
                :disabled="status === 'working'"
                data-testid="assistant-scope-sheet"
                @click="selectScope('sheet')"
              >
                <Film :size="14" />
                <span>
                  <strong>Entire sheet</strong>
                  <small
                    >{{ project.frames.length }} frame{{
                      project.frames.length === 1 ? '' : 's'
                    }}</small
                  >
                </span>
              </button>
            </div>
          </fieldset>

          <div ref="conversation" class="assistant-conversation" aria-live="polite">
            <div v-if="chatEntries.length === 0" class="assistant-chat-empty">
              <Bot :size="22" />
              <strong>Work with your canvas, not around it.</strong>
              <p>
                Describe an edit or animation. The assistant renders a draft in memory, inspects its
                pixels, and refines it before asking you to apply anything.
              </p>
            </div>

            <article
              v-for="entry in chatEntries"
              :key="entry.id"
              :class="['assistant-message', entry.role, entry.state]"
            >
              <span class="assistant-avatar">
                <UserRound v-if="entry.role === 'user'" :size="13" />
                <Bot v-else :size="13" />
              </span>
              <div>
                <span class="assistant-message-meta">
                  {{ entry.role === 'user' ? 'You' : 'Zakape' }}
                  <i v-if="entry.scope">{{
                    entry.scope === 'sheet' ? 'entire sheet' : 'this frame'
                  }}</i>
                  <i v-if="entry.state === 'applied'">applied</i>
                  <i v-else-if="entry.state === 'discarded'">discarded</i>
                </span>
                <p>{{ entry.content }}</p>
              </div>
            </article>

            <article v-if="status === 'working'" class="assistant-message assistant working">
              <span class="assistant-avatar"><LoaderCircle class="spin" :size="13" /></span>
              <div>
                <span class="assistant-message-meta">Zakape agent</span>
                <p>{{ workingLabel }}</p>
                <small
                  >It will run at least one visual review before handing over the proposal.</small
                >
              </div>
            </article>

            <article v-if="proposal" class="proposal-card">
              <span class="eyebrow">Ready after {{ proposal.passes }} passes</span>
              <strong>{{ proposal.summary }}</strong>
              <p>
                {{ proposalOperationCount }} operation{{
                  proposalOperationCount === 1 ? '' : 's'
                }}
                across {{ proposalFrameCount }} edited frame{{
                  proposalFrameCount === 1 ? '' : 's'
                }}.
                <template v-if="proposalCreatedFrameCount || proposalLayerCount">
                  Creates {{ proposalCreatedFrameCount }} frame{{
                    proposalCreatedFrameCount === 1 ? '' : 's'
                  }}
                  and {{ proposalLayerCount }} layer{{ proposalLayerCount === 1 ? '' : 's' }}.
                </template>
              </p>
              <ul v-if="proposal.reviewNotes.length">
                <li v-for="note in proposal.reviewNotes.slice(-3)" :key="note">{{ note }}</li>
              </ul>
              <div>
                <button type="button" class="button-quiet" @click="discardProposal(true)">
                  <X :size="14" /> Discard
                </button>
                <button type="button" class="button-primary" @click="applyProposal">
                  <Check :size="14" /> Apply work
                </button>
              </div>
            </article>

            <p v-if="errorMessage && !connectionOpen" class="inline-error" role="alert">
              {{ errorMessage }}
            </p>
          </div>

          <div class="prompt-box assistant-composer">
            <textarea
              ref="promptInput"
              v-model="prompt"
              rows="3"
              :placeholder="
                scope === 'sheet' ? 'Describe an animation change…' : 'Describe a pixel-art edit…'
              "
              aria-label="Assistant message"
              @keydown.meta.enter.prevent="submitPrompt"
              @keydown.ctrl.enter.prevent="submitPrompt"
            />
            <div>
              <span>
                {{
                  scope === 'sheet'
                    ? `${project.frames.length} frames`
                    : `Frame ${activeFrameIndex + 1}`
                }}
                · {{ activeLayer?.name }}
              </span>
              <button
                v-tooltip="{
                  text: 'Send to assistant',
                  detail: 'Draft, inspect, and refine the edit.',
                  shortcut: 'Ctrl+Enter',
                }"
                type="button"
                :disabled="status === 'working' || !prompt.trim()"
                aria-label="Send message"
                @click="submitPrompt"
              >
                <LoaderCircle v-if="status === 'working'" class="spin" :size="14" />
                <SendHorizontal v-else :size="14" />
              </button>
            </div>
          </div>
        </div>

        <ModelConnectionDialog :open="connectionOpen" @close="connectionOpen = false" />
      </aside>
    </Transition>
  </Teleport>
</template>
