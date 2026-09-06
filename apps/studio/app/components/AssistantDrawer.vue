<script setup lang="ts">
import {
  Bot,
  Check,
  Eye,
  Film,
  LoaderCircle,
  ScanLine,
  SendHorizontal,
  Settings2,
  Sparkles,
  UserRound,
  Wrench,
  X,
} from '@lucide/vue'
import type { AssistantEditScope, AssistantSkillId } from '~/types/editor'
import { ASSISTANT_SKILLS, assistantSkill } from '~/utils/assistantSkills'

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
const skill = useState<AssistantSkillId>('assistant-skill', () => 'fix')
const closeButton = ref<HTMLButtonElement | null>(null)
const promptInput = ref<HTMLTextAreaElement | null>(null)
const conversation = ref<HTMLElement | null>(null)
const activeFrameIndex = computed(() =>
  Math.max(
    0,
    project.value.frames.findIndex((frame) => frame.id === activeFrameId.value),
  ),
)
const selectedSkill = computed(() => assistantSkill(skill.value))
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
const proposalTimingCount = computed(
  () =>
    proposal.value?.actions.filter((action) => action.type === 'set_frame_duration').length ?? 0,
)
const workingLabel = computed(() =>
  agentPass.value.current <= 1
    ? `${selectedSkill.value.label} · building the first pass`
    : `${selectedSkill.value.label} · inspecting rendered pass ${agentPass.value.current}`,
)

const scrollToLatest = async () => {
  await nextTick()
  conversation.value?.scrollTo({ top: conversation.value.scrollHeight, behavior: 'smooth' })
}

const submitPrompt = async () => {
  const message = prompt.value.trim()
  if (!message || status.value === 'working') return
  if (connection.value.provider !== 'codex-cli' && !connection.value.model) {
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
    skill.value,
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

const selectSkill = (nextSkill: AssistantSkillId) => {
  if (skill.value === nextSkill || status.value === 'working') return
  skill.value = nextSkill
  const recommendedScope = assistantSkill(nextSkill).recommendedScope
  if (scope.value !== recommendedScope) scope.value = recommendedScope
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
                detail: 'Choose Ollama, a compatible API, or your signed-in Codex CLI.',
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
          <section class="assistant-skill-rack" aria-labelledby="assistant-skill-title">
            <header>
              <span id="assistant-skill-title">Art skill</span>
              <small :class="{ active: connection.visionEnabled }">
                <Eye :size="11" aria-hidden="true" />
                {{ connection.visionEnabled ? 'Vision on' : 'Grids only' }}
              </small>
            </header>
            <div role="group" aria-label="Zakape art skills">
              <button
                v-for="item in ASSISTANT_SKILLS"
                :key="item.id"
                type="button"
                :class="{ active: skill === item.id }"
                :aria-pressed="skill === item.id"
                :disabled="status === 'working'"
                :title="item.description"
                @click="selectSkill(item.id)"
              >
                {{ item.label }}
              </button>
            </div>
            <p>{{ selectedSkill.description }}</p>
          </section>

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
              <ul class="assistant-capability-strip" aria-label="Assistant capabilities">
                <li><Wrench :size="11" aria-hidden="true" /> Bounded tools</li>
                <li><Eye :size="11" aria-hidden="true" /> Rendered vision</li>
                <li><ScanLine :size="11" aria-hidden="true" /> Self-review</li>
              </ul>
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
                  <i v-if="entry.skill">{{ assistantSkill(entry.skill).label }}</i>
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
              <span class="eyebrow">
                {{ assistantSkill(proposal.skill).label }} · Ready after
                {{ proposal.passes }} passes
              </span>
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
                <template v-if="proposalTimingCount">
                  Adjusts {{ proposalTimingCount }} frame timing{{
                    proposalTimingCount === 1 ? '' : 's'
                  }}.
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
                scope === 'sheet'
                  ? `${selectedSkill.label}: describe an animation change…`
                  : `${selectedSkill.label}: describe a pixel-art edit…`
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
                · {{ activeLayer?.name }} · {{ connection.visionEnabled ? 'vision' : 'grids' }}
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
