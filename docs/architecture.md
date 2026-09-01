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

All editing operations go through the editor store so they can create undo checkpoints, trigger rendering, mark the project dirty, and autosave. The store owns one editor session per open document, including its project data, active frame and layer, undo/redo stacks, and dirty revision. Export flattens visible layers in order using their opacity.

Line and rectangle tools share integer raster helpers between their live pointer preview and final commit, keeping the preview exact. The mirror pencil reflects a continuous stroke across the vertical axis by default, the horizontal axis while Ctrl is held, or both axes while Shift is held. The dither pencil alternates the selected primary and secondary colors on the global pixel grid. Onion skinning composites the previous frame and paints its occupied pixels as a single tinted silhouette beneath the active frame. Frame insertion accepts an explicit source frame and left/right insertion index so timeline menus can create blank or copied neighbors without a global add control.

New projects persist their color mode and initial background. RGBA drawing retains supplied hex colors, Greyscale converts paint and assistant operations by luminance, and Indexed maps them to the nearest project-palette entry. A black or white background initializes the first cel with opaque pixels; transparent projects initialize it with `null` pixels.

The canvas work surface derives its background-grid interval from the active zoom. Ctrl-wheel zoom preserves the pointer's approximate content position, while the hand tool directly adjusts the canvas scroll container. A client plugin marks the container only while it is moving, allowing the custom scrollbars to fade automatically without reflow.

## Desktop and browser boundary

Output helpers detect a Tauri runtime. Desktop builds use Tauri's dialog and filesystem plugins; browser builds use Blob downloads. The `.zakape` project model and editing logic remain in TypeScript so they stay portable and testable.

The desktop window disables native decorations. A 36 px application titlebar provides the drag region, project title, application menus, and right-side minimize/maximize/close controls. The browser build renders the same chrome for layout parity while window-control actions safely become no-ops.

Rust owns a narrow local transport for Ollama. Its two commands discover installed models and request chat responses. Both commands validate that the configured URL uses a loopback host and append fixed Ollama routes; they cannot proxy arbitrary URLs. Chat requests use a structured response schema and a pixel-art direction contract. Proposals address exact frame IDs and remain bound to the selected layer, allowing one validated undo checkpoint to cover either the current frame or the full animation. Browser builds use the same Ollama API shape through direct fetch requests. Compatible hosted endpoints remain a direct browser/WebView connection.

## Persistence

The project launcher is the first interactive surface after the launch splash. On desktop, Rust creates the operating system's `Documents/zakape` directory and mirrors each autosaved project to `project_id.zakape`. The native commands accept project IDs rather than arbitrary paths, reject traversal characters, validate the project version and JSON identity, and cap project files at 32 MB. PGlite keeps the same project JSON as an indexed local cache and powers browser-mode persistence. The launcher merges both indexes for migration compatibility.

PGlite creates a small `projects` table with `id`, `name`, `updated_at`, and JSON data. It also stores the selected model provider, address, and model ID as preferences. It excludes provider secrets.

PGlite's WebAssembly loader currently requires eval permission inside the packaged webview. The desktop CSP therefore permits eval for self-hosted application scripts while still disallowing remote scripts. Removing that exception is tracked as a dependency/runtime hardening opportunity.

## Quality gates

Type checks, unit tests, static generation, Rust formatting/lints, Playwright journeys, and UI snapshots run locally and in GitHub Actions. Interaction coverage includes document tabs, shape previews, frame-local menus, onion skinning, hand panning, zoom-linked work grids, Ctrl-wheel zoom, context-menu suppression, and browser-shortcut hardening. Native release bundles are produced on tagged releases and by manual workflow dispatch.
