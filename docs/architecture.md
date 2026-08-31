# Architecture

## Workspace

- `apps/studio` is a client-rendered Nuxt application. The same static output runs in a browser and in a Tauri 2 webview.
- `apps/studio/src-tauri` owns native packaging, file-system permissions, and desktop metadata.
- `apps/site` is a statically generated Nuxt website intended for GitHub Pages or any static host.
- PGlite runs in the studio's browser context using IndexedDB-backed storage. It stores project JSON and non-secret preferences.

## Editor data model

A project owns an ordered list of frames and layers. Every layer owns one pixel buffer per frame. A pixel is either a CSS hex color or `null` for transparency. This is deliberately straightforward for alpha stability; packed RGBA buffers are a future performance optimization.

```text
Project
├── palette[]
├── frames[] → { id, duration }
└── layers[]
    └── cels[frameId] → Pixel[width × height]
```

All editing operations go through the editor store so they can create undo checkpoints, trigger rendering, mark the project dirty, and autosave. Export flattens visible layers in order using their opacity.

## Desktop and browser boundary

Output helpers detect a Tauri runtime. Desktop builds use Tauri's dialog and filesystem plugins; browser builds use Blob downloads. No project logic is implemented in Rust yet, which keeps the `.zakape` format portable and testable.

## Persistence

PGlite creates a small `projects` table with `id`, `name`, `updated_at`, and JSON data. The latest project is restored at startup. Autosave is debounced. Provider secrets are intentionally excluded from PGlite.

PGlite's WebAssembly loader currently requires eval permission inside the packaged webview. The desktop CSP therefore permits eval for self-hosted application scripts while still disallowing remote scripts. Removing that exception is tracked as a dependency/runtime hardening opportunity.

## Quality gates

Type checks, unit tests, static generation, Rust formatting/lints, Playwright journeys, and UI snapshots run locally and in GitHub Actions. Native release bundles are produced on tagged releases and by manual workflow dispatch.
