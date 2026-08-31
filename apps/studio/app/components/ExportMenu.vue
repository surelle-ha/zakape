<script setup lang="ts">
import { FileArchive, Film, Image, LayoutGrid, LoaderCircle } from '@lucide/vue'
import {
  exportAnimatedGif,
  exportCurrentPng,
  exportProjectFile,
  exportSpriteSheet,
} from '~/utils/export'

const emit = defineEmits<{ close: [] }>()
const { project, activeFrameId } = useEditor()
const busy = ref('')
const error = ref('')

const run = async (label: string, task: () => Promise<void>) => {
  busy.value = label
  error.value = ''
  try {
    await task()
    emit('close')
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : 'Export failed.'
  } finally {
    busy.value = ''
  }
}
</script>

<template>
  <div class="export-menu" role="menu" aria-label="Export options">
    <header><span class="eyebrow">Output</span><strong>Take it to your game</strong></header>
    <button
      type="button"
      role="menuitem"
      @click="run('png', () => exportCurrentPng(project, activeFrameId, 4))"
    >
      <Image :size="17" /><span
        ><strong>Current frame</strong><small>PNG · 4× nearest-neighbor</small></span
      >
      <LoaderCircle v-if="busy === 'png'" class="spin" :size="14" />
    </button>
    <button
      type="button"
      role="menuitem"
      @click="run('sheet', () => exportSpriteSheet(project, 1))"
    >
      <LayoutGrid :size="17" /><span
        ><strong>Sprite sheet</strong><small>PNG + JSON metadata</small></span
      >
      <LoaderCircle v-if="busy === 'sheet'" class="spin" :size="14" />
    </button>
    <button type="button" role="menuitem" @click="run('gif', () => exportAnimatedGif(project, 4))">
      <Film :size="17" /><span
        ><strong>Animated GIF</strong><small>Loop · frame timing</small></span
      >
      <LoaderCircle v-if="busy === 'gif'" class="spin" :size="14" />
    </button>
    <button type="button" role="menuitem" @click="run('project', () => exportProjectFile(project))">
      <FileArchive :size="17" /><span
        ><strong>Zakape project</strong><small>Open JSON format</small></span
      >
      <LoaderCircle v-if="busy === 'project'" class="spin" :size="14" />
    </button>
    <p v-if="error" class="inline-error">{{ error }}</p>
  </div>
</template>
