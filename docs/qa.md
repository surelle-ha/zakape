# Quality assurance

## Automated gates

- Nuxt/Vue type checks for the studio and website.
- Unit coverage for project construction, color normalization, and the assistant operation validator.
- Playwright journeys for editor startup, drawing/tool state, frame duplication, website content, and desktop-size visual snapshots.
- Static generation for both Nuxt applications.
- Cargo check, rustfmt, and Clippy for the Tauri shell.
- GitHub Actions runs the same gates on pull requests and `main`.

## Snapshot baselines

Reviewed 1 September 2026 at 1440 px desktop width:

- `docs/ui-snapshots/studio-workbench.png`
- `docs/ui-snapshots/website-home.png`

The Playwright baselines live beside the end-to-end tests so CI can detect unintended visual drift. Snapshots are a review aid, not a substitute for keyboard, interaction, and accessibility assertions.

## Manual review checklist

- Canvas pixels remain crisp at every supported zoom.
- Controls expose visible labels, tooltips, or accessible names.
- Timeline, inspector, and canvas remain usable at the minimum 1024 × 680 window.
- The assistant is clearly optional; connect, proposal, discard, and apply states are distinct.
- API keys never appear in saved preferences or project exports.
- PNG, sprite sheet + JSON, GIF, and `.zakape` downloads open in ordinary tools.
- Website layout is reviewed at desktop and narrow mobile widths with reduced-motion behavior.
