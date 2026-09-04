# Quality assurance

## Automated gates

- Nuxt/Vue type checks for the studio and website.
- Unit coverage for rectangular project construction and checker-size migration, bounded recent-art previews, rasterized line, rectangle, circle, box-selection, lasso-selection, nearest-neighbor selection resize, and rotation output, custom color-space conversion, color normalization, imported-payload validation, assistant operation/action validation, frame/layer creation, art-direction constraints, animation frame targeting, and Ollama request construction.
- Playwright journeys for the dedicated Guest/Google entry gate, launcher-hidden Home startup, footer profile and artwork drawer, nested sprite suites and project assignments, the modal new-project flow and checker size, researched preset and custom palettes, the permanent Home tab, real recent-art thumbnails, in-app changelog, the custom color mixer, the first-project tour, desktop command shortcuts, touch-hidden shortcut labels, accessible custom tooltips, independent layer creation/visibility/renaming, named custom canvases, color mode and background selection, mouse-selected drawing colors, mirrored and dithered strokes, brush-size dots, responsive document tabs, project/application close confirmation, mouse and touch-hold frame ordering with undo, line/rectangle/circle previews, resizable and rotatable selections, frame-local insertion/copy/deletion, per-frame context-menu timing, onion skinning, Live View visibility, timeline collapse, hand panning, pointer-anchored wheel and two-finger pinch zoom, zoom-linked grids, custom scrollbars, contextual menus, browser-behavior suppression, assistant drawer and entire-sheet edits, exports, and desktop/tablet/phone visual snapshots.
- Static generation for both Nuxt applications.
- Cargo check, rustfmt, and Clippy for the Tauri shell.
- Rust importer tests decode a minimal binary sprite fixture and assert bounded, deterministic conversion.
- A Windows UI Automation smoke test launches the packaged executable offscreen, confirms the custom exit dialog, and asserts the native process terminates (`pnpm --filter @zakape/studio test:native-close`).
- GitHub Actions runs the same gates on pull requests and `main`.

## Snapshot baselines

Reviewed 4 September 2026 at 1440 px desktop width:

- `docs/ui-snapshots/app-splash.png`
- `docs/ui-snapshots/authentication-entry.png`
- `docs/ui-snapshots/project-launcher.png`
- `docs/ui-snapshots/new-canvas-dialog.png`
- `docs/ui-snapshots/studio-workbench.png`
- `docs/ui-snapshots/first-project-walkthrough.png`
- `docs/ui-snapshots/shortcut-guide.png`
- `docs/ui-snapshots/custom-tool-tooltip.png`
- `docs/ui-snapshots/custom-color-picker.png`
- `docs/ui-snapshots/workspace-home-tab.png`
- `docs/ui-snapshots/project-suites-home.png`
- `docs/ui-snapshots/profile-artwork-drawer.png`
- `docs/ui-snapshots/independent-layers.png`
- `docs/ui-snapshots/assistant-drawer.png`
- `docs/ui-snapshots/line-tool-preview.png`
- `docs/ui-snapshots/circle-tool-preview.png`
- `docs/ui-snapshots/box-selection.png`
- `docs/ui-snapshots/selection-transform-handles.png`
- `docs/ui-snapshots/frame-actions-onion-skin.png`
- `docs/ui-snapshots/live-view-frame-timing.png`
- `docs/ui-snapshots/rearrange-frames.png`
- `docs/ui-snapshots/exit-confirmation.png`
- `docs/ui-snapshots/canvas-pan-scrollbars.png`
- `docs/ui-snapshots/mirror-dither-tools.png`
- `docs/ui-snapshots/compact-minimum-workbench.png`
- `docs/ui-snapshots/assistant-entire-sheet-proposal.png`
- `docs/ui-snapshots/ollama-connection-ready.png`
- `docs/ui-snapshots/ollama-connection-offline.png`
- `docs/ui-snapshots/website-home.png`

Responsive Playwright baselines live beside `responsive.spec.ts`: `phone-workbench.png` and `tablet-workbench.png`. The obsolete tablet-launcher baseline was removed because every build now opens on Home with the launcher hidden.

The Playwright baselines live beside the end-to-end tests so CI can detect unintended visual drift. The website keeps reviewed Windows and Linux baselines because text rasterization differs between platforms. Snapshots are a review aid, not a substitute for keyboard, interaction, and accessibility assertions.

## Manual review checklist

- Canvas pixels remain crisp at every supported zoom.
- The entry page appears after the splash only until Guest or Google access is chosen; the project launcher remains hidden after startup on desktop and touch builds.
- Home contains no floating profile card; the footer account name opens the profile and artwork drawer on desktop.
- Sprite suites support root folders, nested variant folders, filtering, assignment, and direct new-project destinations in both Home and the launcher.
- Palette presets reproduce their documented hex values, custom colors use the in-app mixer, and the canvas palette blocks select the primary color.
- Controls expose visible labels, tooltips, or accessible names.
- Tooltips appear for pointer and keyboard focus, describe the control's purpose, and show its shortcut when available.
- Project launcher, document tabs, timeline, inspector, and canvas remain usable at the minimum 1024 × 720 window.
- Line, rectangle, and circle previews match their committed pixels; left-click paints with the primary color and right-click paints with the secondary color without opening a native context menu.
- Box and lasso selection boundaries match the chosen region; dragging inside moves all selected pixels, corner handles resize with nearest-neighbor sampling, the round handle rotates without smoothing, transformed bounds stay inside the canvas, and Delete clears the selection before it can delete a frame.
- Primary and secondary swatches can each be selected with the pointer; the active swatch is visually explicit, and neither opens the browser's native color dialog.
- Mirror-pencil output is symmetrical across the requested axis combination, and dithering alternates both selected colors without gaps in fast strokes.
- The previous-frame silhouette disappears when onion skinning is unchecked and never wraps from frame one to the last frame.
- Direct frame dragging exposes a clear insertion marker, retains frame content and duration after a move, and restores the prior sequence with one undo.
- Touch frame ordering waits for a deliberate 400 ms hold, keeps horizontal timeline scrolling available before activation, and suppresses the release click after a move.
- The work-surface grid changes interval with zoom, wheel zoom keeps the pointed canvas pixel stable when scrolling is available, two-finger pinch uses the gesture midpoint, and hand dragging pans an overflowing canvas.
- Native browser context menus, application-wide text selection, Ctrl+A, reload, print, source, location, history, and developer-tool shortcuts do not leak into the workbench. Text editing shortcuts remain available inside form controls.
- The assistant is clearly optional; its small model-management control, persistent chat, scope, agent-pass activity, proposal, discard, and apply states are distinct.
- The assistant opens without canned prompt suggestions, leaving art direction entirely to the artist.
- The 4.8-second branded splash remains stable while Anime.js sequences its short entrance; Motion surface entrances do not block controls, and animation is disabled when reduced motion is requested.
- New layers begin with transparent, independent cels; visibility affects only the chosen layer; inline rename preserves pixels and frame buffers.
- The first-project tour can be completed or skipped, and both the tour and command map remain available from Help.
- Current-frame proposals cannot edit reference frames; entire-sheet proposals report every affected frame and apply as one undo checkpoint. The model reviews its in-memory rendered output at least once and no more than twice before handoff, and validated project actions create only safe frames and fresh layers.
- API keys never appear in saved preferences or project exports.
- PNG, sprite sheet + JSON, GIF, and `.zakape` downloads open in ordinary tools.
- Website layout is reviewed at desktop and narrow mobile widths with reduced-motion behavior.
- The frameless desktop window remains draggable and exposes minimize, maximize/restore, and close controls from the right side of the titlebar.
- Document tabs remain above the project title/export bar on desktop and below the timeline on phone/tablet; project/application close controls always open the save-before-close confirmation dialog.
- Phone layouts omit the footer, keyboard-only labels, and shortcut dialog; Live Preview remains visible outside the independently hideable Layers drawer.
- Charcoal surfaces remain visually neutral; violet is limited to focus, selection, borders, and active controls. The matching Layers and Assistant drawers plus Timeline glass retain adequate contrast while separating themselves from the canvas.
- The timeline collapse control restores the frame strip without losing selection, frame delay edits live in the selected frame's context menu, the Live View toolbar toggle controls preview visibility, and the footer update monitor rechecks periodically and after the app regains focus or network access.
- Desktop autosaves create only validated `.zakape` files inside the operating system's `Documents/zakape` directory.
- Reopening the desktop executable focuses the existing main window instead of creating another editor process.
- The generated Android icon shows the supplied Zakape mark at every density, and the ARM64 APK reports the expected package ID, version, SDK range, ABI, and signature.
