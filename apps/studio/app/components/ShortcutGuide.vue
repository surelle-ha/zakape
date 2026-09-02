<script setup lang="ts">
import { Keyboard, X } from '@lucide/vue'
import { formatShortcut, shortcutGroups } from '~/utils/commands'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()
const closeButton = ref<HTMLButtonElement | null>(null)

const onKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') emit('close')
}

watch(
  () => props.open,
  async (open) => {
    if (!open) return
    await nextTick()
    closeButton.value?.focus()
  },
)
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="shortcut-backdrop" @click.self="emit('close')">
      <section
        class="shortcut-guide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-heading"
        @keydown="onKeydown"
      >
        <header>
          <span class="shortcut-mark"><Keyboard :size="18" /></span>
          <div>
            <span class="eyebrow">Command map</span>
            <h2 id="shortcut-heading">Keyboard shortcuts</h2>
          </div>
          <button
            ref="closeButton"
            type="button"
            aria-label="Close shortcuts"
            @click="emit('close')"
          >
            <X :size="17" />
          </button>
        </header>

        <div class="shortcut-groups">
          <section v-for="group in shortcutGroups" :key="group.label">
            <h3>{{ group.label }}</h3>
            <dl>
              <div v-for="command in group.commands" :key="command.id">
                <dt>
                  <strong>{{ command.label }}</strong>
                  <span>{{ command.description }}</span>
                </dt>
                <dd>
                  <kbd>{{ formatShortcut(command.shortcut) }}</kbd>
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </section>
    </div>
  </Teleport>
</template>
