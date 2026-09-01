# Quality assurance

## Automated gates

- Nuxt/Vue type checks for the studio and website.
- Unit coverage for project construction, color normalization, assistant operation validation, animation frame targeting, and Ollama request construction.
- Playwright journeys for launch/project-home startup, custom chrome, drawing/tool state, frame duplication, entire-sheet assistant edits, website content, and desktop-size visual snapshots.
- Static generation for both Nuxt applications.
- Cargo check, rustfmt, and Clippy for the Tauri shell.
- GitHub Actions runs the same gates on pull requests and `main`.

## Snapshot baselines

Reviewed 1 September 2026 at 1440 px desktop width:

- `docs/ui-snapshots/app-splash.png`
- `docs/ui-snapshots/project-home.png`
- `docs/ui-snapshots/studio-workbench.png`
- `docs/ui-snapshots/assistant-entire-sheet-proposal.png`
- `docs/ui-snapshots/ollama-connection-ready.png`
- `docs/ui-snapshots/ollama-connection-offline.png`
- `docs/ui-snapshots/website-home.png`

The Playwright baselines live beside the end-to-end tests so CI can detect unintended visual drift. The website keeps reviewed Windows and Linux baselines because text rasterization differs between platforms. Snapshots are a review aid, not a substitute for keyboard, interaction, and accessibility assertions.

## Manual review checklist

- Canvas pixels remain crisp at every supported zoom.
- Controls expose visible labels, tooltips, or accessible names.
- Project home, timeline, inspector, and canvas remain usable at the minimum 1024 × 720 window.
- The assistant is clearly optional; connect, scope, proposal, discard, and apply states are distinct.
- Current-frame proposals cannot edit reference frames; entire-sheet proposals report every affected frame and apply as one undo checkpoint.
- API keys never appear in saved preferences or project exports.
- PNG, sprite sheet + JSON, GIF, and `.zakape` downloads open in ordinary tools.
- Website layout is reviewed at desktop and narrow mobile widths with reduced-motion behavior.
- The frameless desktop window remains draggable and exposes minimize, maximize/restore, and close controls from the right side of the titlebar.
- Desktop autosaves create only validated `.zakape` files inside the operating system's `Documents/zakape` directory.
