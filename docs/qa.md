# Quality assurance

## Automated gates

- Nuxt/Vue type checks for the studio and website.
- Unit coverage for rectangular project construction, rasterized line and rectangle previews, color normalization, assistant operation validation, animation frame targeting, and Ollama request construction.
- Playwright journeys for modal launcher startup, named custom canvases, color mode and background selection, mouse-selected drawing colors, mirrored and dithered strokes, multiple document tabs, shape previews, frame-local insertion/copy/deletion, onion skinning, hand panning, Ctrl-wheel zoom, zoom-linked grids, custom scrollbars, contextual menus, browser-behavior suppression, entire-sheet assistant edits, exports, and desktop-size visual snapshots.
- Static generation for both Nuxt applications.
- Cargo check, rustfmt, and Clippy for the Tauri shell.
- GitHub Actions runs the same gates on pull requests and `main`.

## Snapshot baselines

Reviewed 1 September 2026 at 1440 px desktop width:

- `docs/ui-snapshots/app-splash.png`
- `docs/ui-snapshots/project-launcher.png`
- `docs/ui-snapshots/new-canvas-dialog.png`
- `docs/ui-snapshots/studio-workbench.png`
- `docs/ui-snapshots/line-tool-preview.png`
- `docs/ui-snapshots/frame-actions-onion-skin.png`
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
- Project launcher, document tabs, timeline, inspector, and canvas remain usable at the minimum 1024 × 720 window.
- Line and rectangle previews match their committed pixels; right-click never paints the canvas.
- Primary and secondary swatches can each be selected with the pointer; the active swatch is visually explicit.
- Mirror-pencil output is symmetrical across the requested axis combination, and dithering alternates both selected colors without gaps in fast strokes.
- The previous-frame silhouette disappears when onion skinning is unchecked and never wraps from frame one to the last frame.
- The work-surface grid changes interval with zoom, Ctrl-wheel changes zoom, and hand dragging pans an overflowing canvas.
- Native browser context menus, application-wide text selection, Ctrl+A, reload, print, source, location, history, and developer-tool shortcuts do not leak into the workbench. Text editing shortcuts remain available inside form controls.
- The assistant is clearly optional; connect, scope, proposal, discard, and apply states are distinct.
- Current-frame proposals cannot edit reference frames; entire-sheet proposals report every affected frame and apply as one undo checkpoint.
- API keys never appear in saved preferences or project exports.
- PNG, sprite sheet + JSON, GIF, and `.zakape` downloads open in ordinary tools.
- Website layout is reviewed at desktop and narrow mobile widths with reduced-motion behavior.
- The frameless desktop window remains draggable and exposes minimize, maximize/restore, and close controls from the right side of the titlebar.
- Desktop autosaves create only validated `.zakape` files inside the operating system's `Documents/zakape` directory.
