<script setup lang="ts">
import zakapeMark from '../../../../assets/brand/zakape-icon.png'

const props = withDefaults(defineProps<{ menusEnabled?: boolean }>(), { menusEnabled: true })
const { screen, requestNew, requestOpen } = useWorkspace()
const { project } = useEditor()
const { saveProject } = useProjectRepository()
const win = useAppWindow()
const documentTitle = computed(() => (screen.value === 'editor' ? project.value.name : 'Projects'))
const save = async () => {
  if (screen.value === 'editor') await saveProject(project.value)
}
const onKeydown = (event: KeyboardEvent) => {
  if (!props.menusEnabled || !(event.ctrlKey || event.metaKey)) return
  const key = event.key.toLowerCase()
  if (key === 'n') {
    event.preventDefault()
    requestNew()
  } else if (key === 'o') {
    event.preventDefault()
    requestOpen()
  } else if (key === 's') {
    event.preventDefault()
    void save()
  }
}
const onTitleDoubleClick = (event: MouseEvent) => {
  if ((event.target as HTMLElement).closest('button, [role="menu"]')) return
  void win.toggleMaximize()
}
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  void win.refreshMaximized()
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <header
    class="app-titlebar"
    data-tauri-drag-region
    data-testid="app-titlebar"
    @dblclick="onTitleDoubleClick"
  >
    <div class="title-identity" data-tauri-drag-region>
      <img class="title-mark" :src="zakapeMark" alt="" aria-hidden="true" />
      <strong data-tauri-drag-region>ZAKAPE STUDIO</strong>
      <span data-tauri-drag-region>{{ documentTitle }}</span>
    </div>
    <ApplicationMenu v-if="menusEnabled" variant="desktop" />
    <div class="title-drag-space" data-tauri-drag-region />
    <WindowControls />
  </header>
</template>
