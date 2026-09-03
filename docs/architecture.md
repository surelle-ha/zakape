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

Line and rectangle tools share integer raster helpers between their live pointer preview and final commit, keeping the preview exact. Box and lasso tools rasterize a bounded selection onto the active frame and layer; dragging inside that selection moves its complete pixel region, including transparency, as one undoable action. Delete clears selected pixels before falling back to frame deletion. The mirror pencil reflects a continuous stroke across the vertical axis by default, the horizontal axis while Ctrl is held, or both axes while Shift is held. The dither pencil alternates the selected primary and secondary colors on the global pixel grid. Left-click paints with the primary color and right-click paints with the secondary color without opening a browser context menu. Onion skinning composites the previous frame and paints its occupied pixels as a single tinted silhouette beneath the active frame. Frame insertion accepts an explicit source frame and left/right insertion index so timeline menus can create blank or copied neighbors without a global add control. Frame reordering changes only the ordered frame list, so keyed cel buffers and durations travel with their frame, and the editor records the move as an undoable project checkpoint.

New projects persist their color mode and initial background. RGBA drawing retains supplied hex colors, Greyscale converts paint and assistant operations by luminance, and Indexed maps them to the nearest project-palette entry. A black or white background initializes the first cel with opaque pixels; transparent projects initialize it with `null` pixels.

The canvas work surface derives its background-grid interval from the active zoom. Ctrl-wheel and two-finger pinch zoom preserve the pointer or gesture midpoint's approximate content position, while the hand tool directly adjusts the canvas scroll container. A client plugin marks every scrolling container only while it is moving, allowing the shared violet scrollbars to fade automatically without reflow.

## Native and browser boundary

Output helpers detect a Tauri runtime. Native builds use Tauri's dialog and filesystem plugins; browser builds use Blob downloads. The `.zakape` project model and editing logic remain in TypeScript so they stay portable and testable. A bounded Rust importer decodes compatible layered binary sprite files into the same validated TypeScript project contract; browser builds reject that binary path with native-specific guidance.

The desktop window disables native decorations. A 36 px application titlebar provides the drag region, project title, application menus, and right-side minimize/maximize/close controls. A permanent Home tab precedes the document tabs and switches the shell to recent work, release notes, and workspace status; document tabs sit above the active project's title/export command bar. Both custom and operating-system close requests are intercepted until the shared confirmation state saves every open project. Confirmation then uses Tauri's force-close operation, avoiding a second close-request cycle; the capability grants that operation only to the main window. A desktop-only single-instance plugin brings that main window forward when the executable is launched again. The browser build renders the same chrome for layout parity while window-control actions safely become no-ops.

At widths below 1024 px, the native shell removes desktop-only window chrome and minimum-size constraints. Tablets retain the vertical tool rail and timeline while moving the inspector into a right sheet. Phone portrait moves the tools into a horizontal dock and presents layers in a bottom sheet. The canvas uses Pointer Events for mouse, pen, and touch input; a fit control and the hand tool provide touch-friendly navigation. Safe-area insets protect controls around display cutouts and system navigation.

Rust owns a narrow local transport for Ollama. Its two commands discover installed models and request chat responses. Both commands validate that the configured URL uses a loopback host and append fixed Ollama routes; they cannot proxy arbitrary URLs. Chat requests use a structured response schema and a silhouette-first pixel-art direction contract with native-resolution, palette, dithering, lighting, outline, and timing constraints. The assistant applies a validated draft to an in-memory clone, sends the resulting grids through at least one visual-review pass, and combines at most three incremental passes into a single proposal. That proposal may address exact available frame/layer IDs or safely create frames and transparent layers, while one user-controlled apply action creates one undo checkpoint. Per-project chat transcripts persist in PGlite preferences; provider secrets do not. Browser builds use the same Ollama API shape through direct fetch requests. Compatible hosted endpoints remain a direct browser/WebView connection.

## Persistence

The project launcher is the first interactive surface after the launch splash. On desktop, Rust creates the operating system's `Documents/zakape` directory and mirrors each autosaved project to `project_id.zakape`. Android uses the app-private data directory to avoid broad storage permissions and scoped-storage failures. The native commands accept project IDs rather than arbitrary paths, reject traversal characters, validate the project version and JSON identity, and cap project files at 32 MB. PGlite keeps the same project JSON as an indexed local cache and powers browser-mode persistence. The launcher merges both indexes for migration compatibility.

PGlite creates a small `projects` table with `id`, `name`, `updated_at`, and JSON data. Recent-project summaries derive a bounded 48 × 48 composite of the first frame from that data, so the Home shelf and launcher show real artwork rather than a placeholder. Desktop-only entries hydrate a limited number of previews from their validated project files. PGlite also stores the selected model provider, address, model ID, and capped per-project assistant conversations as preferences. It excludes provider secrets.

PGlite's WebAssembly loader currently requires eval permission inside the packaged webview. The desktop CSP therefore permits eval for self-hosted application scripts while still disallowing remote scripts. Removing that exception is tracked as a dependency/runtime hardening opportunity.

## Quality gates

Type checks, unit tests, static generation, Rust formatting/lints, Playwright journeys, and UI snapshots run locally and in GitHub Actions. Interaction coverage includes the permanent Home tab, document tabs, the custom color mixer, guarded project/application closing, independent layer creation/visibility/renaming, undoable frame reordering, shape and selection previews, frame-local menus, onion skinning, hand panning, zoom-linked work grids, Ctrl-wheel zoom, custom tooltips, command shortcuts, the first-project tour, assistant chat/scope/review, context-menu suppression, and browser-shortcut hardening. Native release bundles are produced on tagged releases and by manual workflow dispatch; a dedicated release job builds, verifies, renames, and attaches the matching Android APK before publication.
