<script setup lang="ts">
import {
  Check,
  ChevronRight,
  Film,
  LoaderCircle,
  ScanLine,
  Settings2,
  Sparkles,
  X,
} from '@lucide/vue'
import type { AssistantEditScope } from '~/types/editor'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const { project, activeFrameId, activeLayerId, activeLayer, applyOperations } = useEditor()
const { modelConnectionOpen: connectionOpen } = useWorkspace()
const { connection, status, errorMessage, proposal, requestProposal, discardProposal } =
  useAiAssistant()
const prompt = ref('')
const scope = ref<AssistantEditScope>('frame')
const closeButton = ref<HTMLButtonElement | null>(null)
const activeFrameIndex = computed(() =>
  Math.max(
    0,
    project.value.frames.findIndex((frame) => frame.id === activeFrameId.value),
  ),
)
const proposalOperationCount = computed(
  () => proposal.value?.frames.reduce((total, frame) => total + frame.operations.length, 0) ?? 0,
)
const proposalFrameCount = computed(
  () => proposal.value?.frames.filter((frame) => frame.operations.length > 0).length ?? 0,
)
const suggestions = ['Add a warm rim light', 'Clean silhouette jaggies', 'Push the idle pose']

const submitPrompt = async () => {
  if (!connection.value.model) {
    connectionOpen.value = true
    return
  }
  await requestProposal(
    prompt.value,
    project.value,
    activeFrameId.value,
    activeLayerId.value,
    scope.value,
  )
}

const applyProposal = () => {
  if (!proposal.value) return
  applyOperations(proposal.value.frames, proposal.value.layerId)
  prompt.value = ''
  discardProposal()
}

const selectScope = (nextScope: AssistantEditScope) => {
  if (scope.value === nextScope) return
  scope.value = nextScope
  discardProposal()
}

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && !connectionOpen.value) emit('close')
}

watch(
  () => props.open,
  async (open) => {
    if (!open) {
      connectionOpen.value = false
      return
    }
    await nextTick()
    closeButton.value?.focus()
  },
)
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
          <div><span class="eyebrow">Optional workflow</span><strong>Art assistant</strong></div>
          <button
            ref="closeButton"
            type="button"
            aria-label="Close assistant"
            @click="emit('close')"
          >
            <X :size="16" />
          </button>
        </header>

        <div class="assistant-drawer-scroll assistant-section">
          <div class="assistant-intro">
            <div>
              <strong>Ask for a bounded edit</strong>
              <p>Review model-suggested pixel operations before they touch your sprite.</p>
            </div>
          </div>

          <button
            v-tooltip="{
              text: 'Model connection',
              detail: 'Choose local Ollama or an OpenAI-compatible endpoint.',
            }"
            type="button"
            class="connection-row"
            @click="connectionOpen = true"
          >
            <span :class="['connection-indicator', { connected: status === 'connected' }]" />
            <span>
              <strong>{{ connection.model || 'No model connected' }}</strong>
              <small>{{
                connection.model
                  ? connection.provider === 'ollama'
                    ? 'Ollama · on this device'
                    : connection.baseUrl
                  : 'Ollama on-device or compatible API'
              }}</small>
            </span>
            <Settings2 :size="15" />
          </button>

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
                <span
                  ><strong>Entire sheet</strong
                  ><small
                    >{{ project.frames.length }} frame{{
                      project.frames.length === 1 ? '' : 's'
                    }}</small
                  ></span
                >
              </button>
            </div>
            <div class="scope-strip" :class="{ sheet: scope === 'sheet' }" aria-hidden="true">
              <i
                v-for="frame in project.frames"
                :key="frame.id"
                :class="{ active: frame.id === activeFrameId, targeted: scope === 'sheet' }"
              />
            </div>
            <p>
              {{
                scope === 'sheet'
                  ? `Coordinate one edit across all ${project.frames.length} frame${project.frames.length === 1 ? '' : 's'}. Applies as one undo step.`
                  : 'Edit the current frame, using its neighbors only as visual reference.'
              }}
            </p>
          </fieldset>

          <div class="prompt-box">
            <textarea
              v-model="prompt"
              rows="5"
              :placeholder="
                scope === 'sheet'
                  ? 'Describe how the animation should change…'
                  : 'Describe a precise pixel-art edit…'
              "
              aria-label="Assistant prompt"
              @keydown.meta.enter.prevent="submitPrompt"
              @keydown.ctrl.enter.prevent="submitPrompt"
            />
            <div>
              <span
                >{{
                  scope === 'sheet'
                    ? `${project.frames.length} frame${project.frames.length === 1 ? '' : 's'}`
                    : `Frame ${activeFrameIndex + 1}`
                }}
                · {{ activeLayer?.name }}</span
              >
              <button
                v-tooltip="{
                  text: 'Propose edit',
                  detail: 'Ask the connected model for reviewable pixel operations.',
                  shortcut: 'Ctrl+Enter',
                }"
                type="button"
                :disabled="status === 'working' || !prompt.trim()"
                @click="submitPrompt"
              >
                <LoaderCircle v-if="status === 'working'" class="spin" :size="14" />
                <Sparkles v-else :size="14" />
                {{ status === 'working' ? 'Thinking' : 'Propose' }}
              </button>
            </div>
          </div>

          <div class="suggestion-list">
            <button
              v-for="suggestion in suggestions"
              :key="suggestion"
              type="button"
              @click="prompt = suggestion"
            >
              {{ suggestion }} <ChevronRight :size="13" />
            </button>
          </div>

          <p v-if="errorMessage && !connectionOpen" class="inline-error" role="alert">
            {{ errorMessage }}
          </p>

          <article v-if="proposal" class="proposal-card">
            <span class="eyebrow">Ready to review</span>
            <strong>{{ proposal.summary }}</strong>
            <p>
              {{ proposalOperationCount }} validated operation{{
                proposalOperationCount === 1 ? '' : 's'
              }}
              across {{ proposalFrameCount }} frame{{ proposalFrameCount === 1 ? '' : 's' }} on the
              selected layer.
            </p>
            <div>
              <button type="button" class="button-quiet" @click="discardProposal">
                <X :size="14" /> Discard
              </button>
              <button type="button" class="button-primary" @click="applyProposal">
                <Check :size="14" />
                {{
                  proposal.scope === 'sheet'
                    ? `Apply to ${proposalFrameCount} frame${proposalFrameCount === 1 ? '' : 's'}`
                    : 'Apply edit'
                }}
              </button>
            </div>
          </article>
        </div>

        <ModelConnectionDialog :open="connectionOpen" @close="connectionOpen = false" />
      </aside>
    </Transition>
  </Teleport>
</template>
