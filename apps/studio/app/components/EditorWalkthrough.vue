<script setup lang="ts">
import { ArrowLeft, ArrowRight, Check, Grid3X3, Layers3, Sparkles, X } from '@lucide/vue'
import type { Component } from 'vue'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ complete: [] }>()
const step = ref(0)
const nextButton = ref<HTMLButtonElement | null>(null)

const steps: Array<{
  eyebrow: string
  title: string
  copy: string
  note: string
  icon: Component
}> = [
  {
    eyebrow: '01 · Draw',
    title: 'Your tools stay close to the canvas',
    copy: 'Choose a tool on the left, then draw directly on the active layer. Hover or focus any tool to see what it does and the key that selects it.',
    note: 'Try P for Pencil, X to swap colors, and Space to pan.',
    icon: Grid3X3,
  },
  {
    eyebrow: '02 · Build',
    title: 'Layers are independent pixel stacks',
    copy: 'Add a transparent layer from the right inspector. Select, hide, rename, or adjust it without changing neighboring layers.',
    note: 'Use Ctrl+Shift+N for a fresh layer and F2 to rename it.',
    icon: Layers3,
  },
  {
    eyebrow: '03 · Animate',
    title: 'Frames live in the timeline',
    copy: 'Use each frame menu to insert, copy, delete, or rearrange frames. Onion silhouette keeps the previous pose visible while you draw.',
    note: 'Insert adds a blank frame. Ctrl+D copies the active frame.',
    icon: ArrowRight,
  },
  {
    eyebrow: '04 · Optional assist',
    title: 'Invite the assistant when it helps',
    copy: 'The spark button opens a separate art-assistant drawer. Connect your own model and review every proposed pixel edit before applying it.',
    note: 'Press A to open the drawer. Your drawing tools work without it.',
    icon: Sparkles,
  },
]

const finish = () => {
  step.value = 0
  emit('complete')
}

watch(
  () => step.value,
  async () => {
    await nextTick()
    nextButton.value?.focus()
  },
)
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="walkthrough-backdrop">
      <section
        class="walkthrough-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="walkthrough-heading"
      >
        <button type="button" class="walkthrough-skip" aria-label="Skip tour" @click="finish">
          <X :size="15" /> Skip tour
        </button>

        <div class="walkthrough-visual" :data-step="step + 1" aria-hidden="true">
          <span class="walkthrough-icon"><component :is="steps[step]!.icon" :size="25" /></span>
          <div class="mini-workbench">
            <i v-for="index in 48" :key="index" :class="{ lit: (index + step * 3) % 7 < 2 }" />
          </div>
        </div>

        <div class="walkthrough-copy">
          <span class="eyebrow">{{ steps[step]!.eyebrow }}</span>
          <h2 id="walkthrough-heading">{{ steps[step]!.title }}</h2>
          <p>{{ steps[step]!.copy }}</p>
          <small>{{ steps[step]!.note }}</small>
        </div>

        <footer>
          <ol aria-label="Tour progress">
            <li v-for="(_, index) in steps" :key="index" :class="{ active: index === step }">
              <span class="sr-only">Step {{ index + 1 }}</span>
            </li>
          </ol>
          <div>
            <button type="button" class="button-quiet" :disabled="step === 0" @click="step -= 1">
              <ArrowLeft :size="14" /> Back
            </button>
            <button
              ref="nextButton"
              type="button"
              class="button-primary"
              @click="step === steps.length - 1 ? finish() : (step += 1)"
            >
              <Check v-if="step === steps.length - 1" :size="14" />
              <ArrowRight v-else :size="14" />
              {{ step === steps.length - 1 ? 'Start drawing' : 'Next' }}
            </button>
          </div>
        </footer>
      </section>
    </div>
  </Teleport>
</template>
