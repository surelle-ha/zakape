# Quality assurance

## Automated gates

- Nuxt/Vue type checks for the studio and website.
- Unit coverage for rectangular project construction, rasterized line and rectangle previews, custom color-space conversion, color normalization, imported-payload validation, assistant operation validation, art-direction constraints, animation frame targeting, and Ollama request construction.
- Playwright journeys for modal launcher startup, the permanent Home tab, in-app changelog, the custom color mixer, the first-project tour, command shortcuts, accessible custom tooltips, independent layer creation/visibility/renaming, named custom canvases, color mode and background selection, mouse-selected drawing colors, mirrored and dithered strokes, multiple document tabs, project/application close confirmation, direct drag-and-drop frame ordering with undo, shape previews, frame-local insertion/copy/deletion, onion skinning, hand panning, Ctrl-wheel zoom, zoom-linked grids, custom scrollbars, contextual menus, browser-behavior suppression, assistant drawer and entire-sheet edits, exports, and desktop-size visual snapshots.
- Static generation for both Nuxt applications.
- Cargo check, rustfmt, and Clippy for the Tauri shell.
- Rust importer tests decode a minimal binary sprite fixture and assert bounded, deterministic conversion.
- A Windows UI Automation smoke test launches the packaged executable offscreen, confirms the custom exit dialog, and asserts the native process terminates (`pnpm --filter @zakape/studio test:native-close`).
- GitHub Actions runs the same gates on pull requests and `main`.

## Snapshot baselines

Reviewed 2 September 2026 at 1440 px desktop width:

- `docs/ui-snapshots/app-splash.png`
- `docs/ui-snapshots/project-launcher.png`
- `docs/ui-snapshots/new-canvas-dialog.png`
- `docs/ui-snapshots/studio-workbench.png`
- `docs/ui-snapshots/first-project-walkthrough.png`
- `docs/ui-snapshots/shortcut-guide.png`
- `docs/ui-snapshots/custom-tool-tooltip.png`
- `docs/ui-snapshots/custom-color-picker.png`
- `docs/ui-snapshots/workspace-home-tab.png`
- `docs/ui-snapshots/independent-layers.png`
- `docs/ui-snapshots/assistant-drawer.png`
- `docs/ui-snapshots/line-tool-preview.png`
- `docs/ui-snapshots/frame-actions-onion-skin.png`
- `docs/ui-snapshots/rearrange-frames.png`
- `docs/ui-snapshots/exit-confirmation.png`
- `docs/ui-snapshots/canvas-pan-scrollbars.png`
- `docs/ui-snapshots/mirror-dither-tools.png`
- `docs/ui-snapshots/compact-minimum-workbench.png`
- `docs/ui-snapshots/assistant-entire-sheet-proposal.png`
- `docs/ui-snapshots/ollama-connection-ready.png`
- `docs/ui-snapshots/ollama-connection-offline.png`
- `docs/ui-snapshots/website-home.png`

The Playwright baselines live beside the end-to-end tests so CI can detect unintended visual drift. The website keeps reviewed Windows and Linux baselines because text rasterization differs between platforms. Snapshots are a review aid, not a substitute for keyboard, interaction, and accessibility assertions.

## Manual review checklist

- Canvas pixels remain crisp at every supported zoom.
- Controls expose visible labels, tooltips, or accessible names.
- Tooltips appear for pointer and keyboard focus, describe the control's purpose, and show its shortcut when available.
- Project launcher, document tabs, timeline, inspector, and canvas remain usable at the minimum 1024 × 720 window.
- Line and rectangle previews match their committed pixels; right-click never paints the canvas.
- Primary and secondary swatches can each be selected with the pointer; the active swatch is visually explicit, and neither opens the browser's native color dialog.
- Mirror-pencil output is symmetrical across the requested axis combination, and dithering alternates both selected colors without gaps in fast strokes.
- The previous-frame silhouette disappears when onion skinning is unchecked and never wraps from frame one to the last frame.
- Direct frame dragging exposes a clear insertion marker, retains frame content and duration after a move, and restores the prior sequence with one undo.
- The work-surface grid changes interval with zoom, Ctrl-wheel changes zoom, and hand dragging pans an overflowing canvas.
- Native browser context menus, application-wide text selection, Ctrl+A, reload, print, source, location, history, and developer-tool shortcuts do not leak into the workbench. Text editing shortcuts remain available inside form controls.
- The assistant is clearly optional; connect, scope, proposal, discard, and apply states are distinct.
- New layers begin with transparent, independent cels; visibility affects only the chosen layer; inline rename preserves pixels and frame buffers.
- The first-project tour can be completed or skipped, and both the tour and command map remain available from Help.
- Current-frame proposals cannot edit reference frames; entire-sheet proposals report every affected frame and apply as one undo checkpoint.
- API keys never appear in saved preferences or project exports.
- PNG, sprite sheet + JSON, GIF, and `.zakape` downloads open in ordinary tools.
- Website layout is reviewed at desktop and narrow mobile widths with reduced-motion behavior.
- The frameless desktop window remains draggable and exposes minimize, maximize/restore, and close controls from the right side of the titlebar.
- Document tabs remain above the project title/export bar, and project/application close controls always open the save-before-close confirmation dialog.
- Desktop autosaves create only validated `.zakape` files inside the operating system's `Documents/zakape` directory.
