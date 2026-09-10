# TOOLS-C4EX implementation plan

## Codebase and history evidence

Repository inspection on 2026-09-10 found the following ownership boundaries:

- `apps/studio/app/composables/useEditor.ts` owns active tool state, pixel mutations, localized
  history entries, project checkpoints, color registration, and flood fill. Existing strokes batch
  original pixel values into one undo record.
- `apps/studio/app/components/PixelCanvas.vue` owns display-to-pixel mapping, pointer/touch
  routing, previews, tiled source mapping, pinch zoom, selection transforms, and incremental frame
  surface patching. It currently previews Line/Rectangle/Circle but commits outline-only geometry.
- `apps/studio/app/utils/raster.ts` contains pure integer rasterizers for lines, rectangles, circles,
  lasso masks, selection resize/rotation, and tiled wrapping. It is the correct home for new shape,
  brush, contour, spray, gradient, and pixel-perfect algorithms.
- `apps/studio/app/utils/render.ts` composites visible pixel layers with a reusable image surface and
  disabled image smoothing. It currently assumes every layer has per-frame pixel cels and must gain
  a live-text compositing branch.
- `apps/studio/app/types/editor.ts` defines `ToolId`, `Layer`, project version 1, and assistant
  operations. New settings and text-layer data need stable IDs and a migration path.
- `apps/studio/app/components/ToolRail.vue`, `utils/commands.ts`, `useToolboxSettings.ts`, and the
  in-progress `UI-49ZB` customization surface define the canonical tool catalog and stable shortcut
  behavior.
- `apps/studio/app/pages/index.vue` owns the compact brush controls and project-level editor chrome;
  it currently limits brush sizes to 1–4 and contains desktop/mobile shortcut routing.
- Existing unit coverage in `tests/unit/raster.test.ts`, `render.test.ts`, `project.test.ts`, and
  `selection.test.ts`, plus browser coverage in `tests/e2e/studio.spec.ts` and `responsive.spec.ts`,
  provides regression seams. Project memory requires no deep reactive pixel structures and no full
  project cloning in hot pointer paths.
- Completed selection and tiled-canvas specs establish transparent-safe mutation, one undoable
  gesture, and one authoritative source composition. Completed view/editor specs establish shared
  tool/menu IDs and device-local preferences.

## Proposed approach

1. Extend the pure raster utility layer first. Add brush footprints, pixel-perfect cleanup,
   thick-line expansion, filled ellipse, contour edges/fill, seeded spray distributions,
   deterministic color-distance/flood-fill helpers, linear/radial gradient sampling, and ordered
   dither masks. Every algorithm returns bounded integer points or color samples and has no Vue or
   DOM dependency.
2. Extend the editor mutation boundary with a `ToolOptions` state and operation-specific mutation
   methods. Localized stroke methods continue recording only changed indexes; expensive whole-canvas
   operations use one bounded batch and may be scheduled off the UI thread when profiling warrants
   it. Fill reads a composite buffer when requested but always writes the active cel.
3. Generalize `PixelCanvas.vue` gesture state into a preview/commit state machine for brush strokes,
   shape fill mode, contour vertex placement, spray, and gradient. Pointer, secondary-button, touch,
   Escape/back, blur, and pointer-cancel paths share cancellation and undo semantics. Selection masks
   clip gradients and text rasterization.
4. Add a versioned live-text layer contract. A text tool creates a dedicated text layer containing
   bounded content, font family, integer size, alignment, spacing, color, anchor, and optional
   selection mask. Rendering rasterizes it to a cached offscreen surface with smoothing disabled;
   editing updates metadata, export and explicit Rasterize Text produce pixels, and missing fonts
   fall back to a bundled OFL pixel font with an announced warning.
5. Add compact tool option controls and discoverable commands without forking desktop/touch command
   behavior. Preserve existing IDs/shortcuts, let `UI-49ZB` normalize newly added optional tools,
   and expose contextual controls for fill tolerance/connectivity, spray, gradient mode/dither,
   shape fill, contour finish, and text editing.
6. Profile and optimize the high-resolution path. Reuse typed buffers, cache composite inputs for a
   gesture, avoid full redraws for localized strokes, and add measured 1000×1000 fixtures before
   introducing worker scheduling. Use a bounded synchronous fallback for platforms where workers
   are unavailable.

## Architecture and data flow

Input flows from `PixelCanvas` into a `ToolGesture` state containing source tile, integer points,
preview samples, and options. Pure raster helpers produce samples; `useEditor` resolves color mode,
palette registration, selection clipping, and active-layer writes. Each gesture starts one localized
history transaction and either commits one pixel/text-layer entry or restores the pre-gesture state.

Pixel layers remain `cels: Record<frameId, Pixel[]>`. A new `kind: 'text'` layer stores a `text`
record and has no editable pixel cel until rasterized; render/export composites text layers in layer
order through a cached hard-edged raster surface. Rasterize Text replaces the text layer with a pixel
layer in one project checkpoint. Text metadata is persisted in project files but never in assistant
credentials or device preferences.

Fill obtains either the active cel or a cached visible composite based on `FillOptions.source`,
compares pixels with the RGBA weighted distance, traverses 4-way (default) or 8-way neighbors, and
writes only matching coordinates into the active cel. Gradients sample primary→secondary colors at
integer pixel centers and apply an ordered pattern anchored to canvas coordinates when dithering is
enabled. A selection mask is applied before any generated sample reaches the mutation boundary.

The native Rust boundary is unchanged: these are local in-memory operations and require no new
filesystem, network, account, or model permissions. Any future worker uses structured clone data
only and cannot access native commands.

## Affected files

- `apps/studio/app/types/editor.ts` — ToolId/options, text-layer schema, versioned project unions,
  and operation/history types.
- `apps/studio/app/utils/raster.ts` — pure footprints, pixel-perfect cleanup, thick/filled geometry,
  contour, spray, gradient, and ordered dither helpers.
- `apps/studio/app/utils/color.ts` — bounded RGBA-aware distance and color interpolation helpers if
  current color parsing does not already provide them.
- `apps/studio/app/utils/project.ts` — text-layer defaults, schema normalization/migration, and safe
  clone/load handling.
- `apps/studio/app/utils/render.ts` — text-layer raster cache/compositing and export-safe hard-edge
  rendering.
- `apps/studio/app/composables/useEditor.ts` — tool options, fill variants, shape modes, gradient,
  spray, text-layer mutation/rasterization, and undo integration.
- `apps/studio/app/components/PixelCanvas.vue` — gesture state machine, previews, selection clipping,
  contour/text interaction, and cancellation/performance scheduling.
- `apps/studio/app/components/ToolRail.vue` and `apps/studio/app/utils/commands.ts` — canonical new
  tool labels, descriptions, shortcuts, and option affordances.
- `apps/studio/app/pages/index.vue` and `apps/studio/app/assets/css/main.css` — compact contextual
  controls, text inspector, brush/shape/fill settings, touch targets, and status feedback.
- `apps/studio/app/composables/useToolboxSettings.ts` / `utils/editorSettings.ts` — migration and
  normalization for optional tool IDs coordinated with `UI-49ZB`.
- `apps/studio/tests/unit/raster.test.ts`, `color.test.ts`, `render.test.ts`, `project.test.ts`,
  and new tool/editor tests — deterministic algorithm, schema, compositing, and mutation fixtures.
- `apps/studio/tests/e2e/studio.spec.ts`, `responsive.spec.ts`, and a focused
  `tools-c4ex.spec.ts` — desktop/touch previews, settings, cancellation, text editing, and
  high-resolution responsiveness.
- `docs/ai/` and `docs/project-memory/` — assistant/tool guidance, pixel-art constraints, and durable
  schema/performance decisions; no credentials or private artwork.

## Contracts and migrations

- Keep `SpriteProject.version: 1` readable. Introduce a backward-compatible project version 2 only
  when live text metadata is added; v1 projects normalize to pixel-only layers and continue to save
  without change.
- Normalize malformed text records (empty content, invalid font/size, out-of-bounds anchor,
  unsupported alignment, excessive spacing) to safe defaults; do not discard neighboring layers.
- Persist text layers in `.zakape` and imported/exported project representations only after explicit
  schema versioning. PNG/GIF/sheet exports always rasterize visible text in layer order.
- Device-local tool options may be versioned independently and must not contain API keys, endpoints,
  assistant prompts, or account data. Unknown optional tool IDs remain hidden until migrated.
- Undo/redo entries must restore either changed pixel indexes or the previous text-layer record; no
  whole-project snapshot is permitted for ordinary brush/preview gestures.

## Dependencies and sequence

`UI-49ZB` is advisory and unfinished. Coordinate stable tool IDs and migration with its toolbox
catalog, but pure algorithms and editor mutation tests are parallel-safe. Sequence implementation as:

1. types, algorithms, color math, project migration, and render contracts;
2. editor mutations/history and text-layer operations;
3. canvas gesture previews/input and contextual UI;
4. toolbox/menu/settings integration;
5. focused tests, profiling, docs, and full validation.

Do not block on UI-49ZB unless its eventual merge changes the canonical tool-ID contract; isolate
catalog additions behind normalization so an explicit override remains safe.

## Risks and mitigations

- Full-canvas fill/gradient can freeze phones: cap dimensions/options, reuse buffers, profile 1000×1000
  fixtures, and move only measured expensive commits to workers.
- Shape thickening can create uneven corners: define integer footprint semantics and golden fixtures
  at shallow, steep, degenerate, and clipped bounds.
- Pixel-perfect cleanup can erase intentional art: conservative path-provenance checks and an option
  to disable cleanup per gesture.
- Composite fill can accidentally write hidden or inactive layers: separate read buffer from active
  write target and assert layer IDs in tests.
- Text font substitution can change appearance: bundle licensed fallbacks, persist resolved family,
  warn on substitution, and provide explicit Rasterize Text.
- New tools can break customized rails/shortcuts: stable IDs, preference normalization, and required
  Pencil/Eraser/Hand invariants.
- Touch hover affordances do not exist: all actions have visible controls, long-press or tap paths,
  and keyboard alternatives on desktop.
- Text-layer rendering may diverge between Canvas2D and exports: use one hard-edge raster helper for
  preview/export and compare pixel fixtures.

## Validation strategy

- AC-1/2/3: unit-test brush footprints, pixel-perfect joins, thick lines, outline/filled shape points,
  contour closure, cancellation, and one-entry undo; run focused pointer/touch Playwright flows.
- AC-4: deterministic spray fixtures plus 1000×1000 browser timing/interaction smoke test.
- AC-5: fixture matrix for RGBA tolerance, transparent targets, 4/8-way contiguous, non-contiguous,
  visible-layer read, indexed 256-color cap, grayscale normalization, and selection masks.
- AC-6: linear/radial gradient and ordered-pattern fixtures, hard-edge render assertions, and tiled
  source parity.
- AC-7: text-layer create/edit/reopen/rasterize/export fixtures, missing-font warning, clipping, and
  migration from v1.
- AC-8/9: desktop, tablet, phone screenshots and overflow/accessibility checks; regression run for
  existing tools, shortcuts, exports, live preview, tiled view, and older projects.
- Run affected-file Prettier, studio lint/typecheck/unit/build, focused/full Playwright, root checks,
  `pnpm spec validate TOOLS-C4EX`, and `git diff --check`.

## Rollout and recovery

No remote feature flag is needed. Existing projects remain readable; malformed new metadata falls
back to pixel-only behavior and reports a recoverable notice. A failed text rasterization/export
leaves the live layer and undo history intact. A failed worker or unsupported font uses the bounded
synchronous path/fallback font. New tool options default to current behavior, and users can restore
tool defaults through the existing toolbox settings surface.
