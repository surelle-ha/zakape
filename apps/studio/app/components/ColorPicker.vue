<script setup lang="ts">
import { Check, X } from '@lucide/vue'
import {
  hexToHsv,
  hexToRgb,
  hsvToHex,
  normalizeHexColor,
  rgbToHex,
  type HsvColor,
  type RgbColor,
} from '~/utils/color'

const props = defineProps<{
  modelValue: string
  label: string
  open: boolean
  active?: boolean
  swatchClass: 'primary' | 'secondary'
  palette?: string[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  toggle: []
  close: []
  select: []
}>()

const trigger = ref<HTMLButtonElement | null>(null)
const panel = ref<HTMLElement | null>(null)
const colorField = ref<HTMLElement | null>(null)
const hsv = reactive<HsvColor>(hexToHsv(props.modelValue))
const hexDraft = ref(normalizeHexColor(props.modelValue).toUpperCase())
const draggingField = ref(false)
const popoverStyle = ref<Record<string, string>>({})
const colorName = computed(() => props.label.replace(/ color$/i, ''))
const rgb = computed(() => hexToRgb(props.modelValue))
const hueColor = computed(() => 'hsl(' + Math.round(hsv.h) + ' 100% 50%)')
const paletteOptions = computed(() => {
  const colors = [
    props.modelValue,
    ...(props.palette ?? []),
    '#16221c',
    '#ffffff',
    '#ff875f',
    '#ffd36a',
    '#7ed0aa',
    '#5e81ac',
    '#b48ead',
  ]
  return [...new Set(colors.map((color) => normalizeHexColor(color)))].slice(0, 12)
})

const syncFromValue = (value: string) => {
  const next = hexToHsv(value)
  hsv.h = next.h
  hsv.s = next.s
  hsv.v = next.v
  hexDraft.value = normalizeHexColor(value).toUpperCase()
}

const emitHsv = () => emit('update:modelValue', hsvToHex(hsv))

const updateField = (event: PointerEvent) => {
  const bounds = colorField.value?.getBoundingClientRect()
  if (!bounds) return
  hsv.s = Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100))
  hsv.v = Math.max(0, Math.min(100, (1 - (event.clientY - bounds.top) / bounds.height) * 100))
  emitHsv()
}

const startField = (event: PointerEvent) => {
  draggingField.value = true
  colorField.value?.setPointerCapture(event.pointerId)
  updateField(event)
}

const moveField = (event: PointerEvent) => {
  if (draggingField.value) updateField(event)
}

const stopField = (event: PointerEvent) => {
  draggingField.value = false
  if (colorField.value?.hasPointerCapture(event.pointerId))
    colorField.value.releasePointerCapture(event.pointerId)
}

const updateHue = (event: Event) => {
  hsv.h = Number((event.target as HTMLInputElement).value)
  emitHsv()
}

const commitHex = () => {
  const normalized = normalizeHexColor(hexDraft.value, '')
  if (!normalized) {
    hexDraft.value = normalizeHexColor(props.modelValue).toUpperCase()
    return
  }
  emit('update:modelValue', normalized)
}

const updateChannel = (channel: keyof RgbColor, event: Event) => {
  const value = Number((event.target as HTMLInputElement).value)
  if (!Number.isFinite(value)) return
  emit('update:modelValue', rgbToHex({ ...rgb.value, [channel]: value }))
}

const choosePaletteColor = (color: string) => emit('update:modelValue', color)

const updatePosition = async () => {
  if (!props.open) return
  await nextTick()
  const anchor = trigger.value?.getBoundingClientRect()
  const picker = panel.value?.getBoundingClientRect()
  if (!anchor || !picker) return
  const gap = 8
  const edge = 8
  const desktopPlacement =
    window.innerWidth > 640 && anchor.right + gap + picker.width < window.innerWidth
  const left = desktopPlacement
    ? anchor.right + gap
    : Math.max(edge, Math.min(anchor.left, window.innerWidth - picker.width - edge))
  const requestedTop = desktopPlacement ? anchor.top - 8 : anchor.top - picker.height - gap
  const top = Math.max(edge, Math.min(requestedTop, window.innerHeight - picker.height - edge))
  popoverStyle.value = { left: left + 'px', top: top + 'px' }
}

const onWindowPointerDown = (event: PointerEvent) => {
  const target = event.target as Node
  if (props.open && !trigger.value?.contains(target) && !panel.value?.contains(target))
    emit('close')
}

const onWindowKeydown = (event: KeyboardEvent) => {
  if (props.open && event.key === 'Escape') {
    event.stopPropagation()
    emit('close')
    trigger.value?.focus()
  }
}

watch(() => props.modelValue, syncFromValue)
watch(
  () => props.open,
  (open) => {
    if (open) void updatePosition()
  },
)

onMounted(() => {
  window.addEventListener('pointerdown', onWindowPointerDown)
  window.addEventListener('keydown', onWindowKeydown, true)
  window.addEventListener('resize', updatePosition)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', onWindowPointerDown)
  window.removeEventListener('keydown', onWindowKeydown, true)
  window.removeEventListener('resize', updatePosition)
})
</script>

<template>
  <button
    ref="trigger"
    v-tooltip="{
      text: label,
      detail:
        (swatchClass === 'primary' ? 'Left' : 'Right') +
        '-click drawing uses this color. Open the Zakape color mixer to edit it.',
    }"
    type="button"
    class="tool-color"
    :class="[swatchClass, { active }]"
    :style="{ '--swatch-color': normalizeHexColor(modelValue) }"
    :aria-label="colorName + ' drawing color'"
    aria-haspopup="dialog"
    :aria-expanded="open"
    @pointerdown="emit('select')"
    @click.stop="emit('toggle')"
  >
    <span />
  </button>

  <Teleport to="body">
    <section
      v-if="open"
      ref="panel"
      class="color-picker"
      :style="popoverStyle"
      role="dialog"
      :aria-label="colorName + ' color picker'"
      @pointerdown.stop
      @contextmenu.prevent
    >
      <header class="color-picker-heading">
        <span class="color-picker-chip" :style="{ background: modelValue }" />
        <div>
          <span>{{ swatchClass }} ink</span><strong>{{ hexDraft }}</strong>
        </div>
        <button type="button" aria-label="Close color picker" @click="emit('close')">
          <X :size="14" />
        </button>
      </header>

      <div
        ref="colorField"
        class="color-field"
        :style="{ '--hue-color': hueColor }"
        aria-label="Saturation and brightness"
        @pointerdown.prevent="startField"
        @pointermove.prevent="moveField"
        @pointerup="stopField"
        @pointercancel="stopField"
      >
        <span class="color-field-cursor" :style="{ left: hsv.s + '%', top: 100 - hsv.v + '%' }" />
      </div>

      <label class="hue-field">
        <span>Hue</span>
        <input
          :value="hsv.h"
          type="range"
          min="0"
          max="359"
          step="1"
          aria-label="Hue"
          @input="updateHue"
        />
      </label>

      <div class="color-value-fields">
        <label class="hex-field">
          <span>HEX</span>
          <input
            v-model="hexDraft"
            type="text"
            maxlength="7"
            spellcheck="false"
            aria-label="Hex color"
            @blur="commitHex"
            @keydown.enter.prevent="commitHex"
          />
        </label>
        <label v-for="channel in ['r', 'g', 'b'] as const" :key="channel">
          <span>{{ channel.toUpperCase() }}</span>
          <input
            :value="rgb[channel]"
            type="number"
            min="0"
            max="255"
            :aria-label="channel.toUpperCase() + ' color channel'"
            @change="updateChannel(channel, $event)"
          />
        </label>
      </div>

      <div class="color-palette">
        <span>Project colors</span>
        <div>
          <button
            v-for="color in paletteOptions"
            :key="color"
            type="button"
            :class="{ selected: normalizeHexColor(modelValue) === color }"
            :style="{ '--palette-color': color }"
            :aria-label="'Use ' + color"
            @click="choosePaletteColor(color)"
          >
            <Check v-if="normalizeHexColor(modelValue) === color" :size="10" />
          </button>
        </div>
      </div>
    </section>
  </Teleport>
</template>
