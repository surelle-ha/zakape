import type { ToolId } from '~/types/editor'

export interface CommandDefinition {
  id: string
  label: string
  description: string
  shortcut: string
}

export interface ToolDefinition extends CommandDefinition {
  id: ToolId
}

export const toolDefinitions: ToolDefinition[] = [
  {
    id: 'pencil',
    label: 'Pencil',
    description: 'Draw crisp pixels with the active color and brush size.',
    shortcut: 'P',
  },
  {
    id: 'mirror',
    label: 'Mirror pencil',
    description: 'Draw across the vertical axis. Hold Ctrl for horizontal or Shift for both.',
    shortcut: 'M',
  },
  {
    id: 'dither',
    label: 'Dither pencil',
    description: 'Paint an alternating pattern with the primary and secondary colors.',
    shortcut: 'T',
  },
  {
    id: 'eraser',
    label: 'Eraser',
    description: 'Remove pixels from the active layer without changing layers below it.',
    shortcut: 'E',
  },
  {
    id: 'fill',
    label: 'Fill',
    description: 'Replace one connected area of matching pixels with the active color.',
    shortcut: 'F',
  },
  {
    id: 'picker',
    label: 'Eyedropper',
    description: 'Sample a visible pixel. You can also hold Alt while using another tool.',
    shortcut: 'I',
  },
  {
    id: 'line',
    label: 'Line',
    description: 'Drag a straight pixel line; release when the preview is in place.',
    shortcut: 'L',
  },
  {
    id: 'rectangle',
    label: 'Rectangle',
    description: 'Drag an outlined pixel rectangle; release to commit the preview.',
    shortcut: 'R',
  },
  {
    id: 'hand',
    label: 'Hand',
    description: 'Drag the workspace to pan. Hold Space for temporary hand mode.',
    shortcut: 'H',
  },
]

export const fileCommands: CommandDefinition[] = [
  {
    id: 'new',
    label: 'New sprite',
    description: 'Create another sprite document.',
    shortcut: 'Mod+N',
  },
  {
    id: 'open',
    label: 'Open project',
    description: 'Open the project launcher.',
    shortcut: 'Mod+O',
  },
  {
    id: 'save',
    label: 'Save project',
    description: 'Save the active project now.',
    shortcut: 'Mod+S',
  },
  {
    id: 'close',
    label: 'Close document',
    description: 'Close the active sprite after confirmation.',
    shortcut: 'Mod+W',
  },
  { id: 'export', label: 'Export', description: 'Open the output menu.', shortcut: 'Mod+Shift+E' },
  {
    id: 'cycle',
    label: 'Next document',
    description: 'Switch to the next open sprite tab.',
    shortcut: 'Mod+Tab',
  },
]

export const editCommands: CommandDefinition[] = [
  { id: 'undo', label: 'Undo', description: 'Undo the last editable action.', shortcut: 'Mod+Z' },
  {
    id: 'redo',
    label: 'Redo',
    description: 'Restore the most recently undone action.',
    shortcut: 'Mod+Shift+Z',
  },
  {
    id: 'swap-colors',
    label: 'Swap colors',
    description: 'Exchange the primary and secondary colors.',
    shortcut: 'X',
  },
  {
    id: 'reset-colors',
    label: 'Reset colors',
    description: 'Restore black and white drawing colors.',
    shortcut: 'D',
  },
  {
    id: 'smaller-brush',
    label: 'Smaller brush',
    description: 'Decrease the brush size by one pixel.',
    shortcut: '[',
  },
  {
    id: 'larger-brush',
    label: 'Larger brush',
    description: 'Increase the brush size by one pixel.',
    shortcut: ']',
  },
]

export const layerCommands: CommandDefinition[] = [
  {
    id: 'add-layer',
    label: 'New layer',
    description: 'Add a fresh transparent layer above the stack.',
    shortcut: 'Mod+Shift+N',
  },
  {
    id: 'rename-layer',
    label: 'Rename layer',
    description: 'Rename the selected layer in place.',
    shortcut: 'F2',
  },
  {
    id: 'delete-layer',
    label: 'Delete layer',
    description: 'Delete the selected layer when another layer remains.',
    shortcut: 'Shift+Delete',
  },
]

export const animationCommands: CommandDefinition[] = [
  {
    id: 'previous-frame',
    label: 'Previous frame',
    description: 'Select the previous animation frame.',
    shortcut: ',',
  },
  {
    id: 'next-frame',
    label: 'Next frame',
    description: 'Select the next animation frame.',
    shortcut: '.',
  },
  {
    id: 'blank-frame',
    label: 'New blank frame',
    description: 'Insert a fresh frame after the active frame.',
    shortcut: 'Insert',
  },
  {
    id: 'duplicate-frame',
    label: 'Duplicate frame',
    description: 'Copy the active frame to its right.',
    shortcut: 'Mod+D',
  },
  {
    id: 'delete-frame',
    label: 'Delete frame',
    description: 'Delete the active frame when another frame remains.',
    shortcut: 'Delete',
  },
  {
    id: 'playback',
    label: 'Play or pause',
    description: 'Toggle the animation preview.',
    shortcut: 'K',
  },
  {
    id: 'onion-skin',
    label: 'Onion skin',
    description: 'Show or hide the previous frame drawing guide.',
    shortcut: 'O',
  },
]

export const viewCommands: CommandDefinition[] = [
  {
    id: 'zoom-in',
    label: 'Zoom in',
    description: 'Increase canvas magnification.',
    shortcut: 'Mod++',
  },
  {
    id: 'zoom-out',
    label: 'Zoom out',
    description: 'Decrease canvas magnification.',
    shortcut: 'Mod+-',
  },
  {
    id: 'zoom-reset',
    label: 'Reset zoom',
    description: 'Return the canvas to 100%.',
    shortcut: 'Mod+0',
  },
  { id: 'grid', label: 'Pixel grid', description: 'Show or hide pixel grid lines.', shortcut: 'G' },
  {
    id: 'transparency',
    label: 'Transparency',
    description: 'Show or hide the checkerboard background.',
    shortcut: 'Shift+G',
  },
  {
    id: 'assistant',
    label: 'AI assistant',
    description: 'Open or close the optional art-assistant drawer.',
    shortcut: 'A',
  },
  {
    id: 'shortcuts',
    label: 'Keyboard shortcuts',
    description: 'Open the complete command reference.',
    shortcut: '?',
  },
]

export const shortcutGroups = [
  { label: 'Tools', commands: toolDefinitions },
  { label: 'File', commands: fileCommands },
  { label: 'Edit', commands: editCommands },
  { label: 'Layers', commands: layerCommands },
  { label: 'Animation', commands: animationCommands },
  { label: 'View', commands: viewCommands },
]

export const commandById = new Map(
  shortcutGroups.flatMap((group) => group.commands).map((command) => [command.id, command]),
)

const isApplePlatform = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

export const formatShortcut = (shortcut: string) => {
  const apple = isApplePlatform()
  return shortcut
    .split('+')
    .map((part) => {
      if (part === 'Mod') return apple ? '⌘' : 'Ctrl'
      if (part === 'Shift') return apple ? '⇧' : 'Shift'
      if (part === 'Alt') return apple ? '⌥' : 'Alt'
      if (part === 'Delete') return apple ? '⌫' : 'Delete'
      return part
    })
    .join(apple ? '' : '+')
}
