# CANVAS-KG4B implementation plan

## Codebase and history evidence

`apps/studio/app/components/ApplicationMenu.vue` owns one typed File/Edit/View/Help command model for desktop and touch. Its View group binds editor presentation refs directly and derives Home availability from `useWorkspace().screen`; Tiled Mode and its settings belong in this shared model rather than in either presentation. `apps/studio/app/pages/index.vue` owns the only global shortcut listener, the `.canvas-scroll` host, fit-to-workspace math, and pointer-centered wheel zoom. It also hydrates and saves device preferences through `useProjectRepository().loadPreference/savePreference`, so it is the correct lifecycle boundary for tiled preferences and `Shift+T`.

`apps/studio/app/components/PixelCanvas.vue` owns one physical canvas, render scheduling, pointer/touch mapping, shape previews, selection transforms, hand panning, and pinch zoom. Its `scheduleRedraw()` coalesces mutations into one `requestAnimationFrame`; its dimensions, coordinate mapping, pinch focus, and selection hit testing currently assume one source tile. `apps/studio/app/utils/render.ts` rasterizes layer pixels through a reusable source-sized buffer, but `drawProjectFrame()` recomposes the project on every call. Tiled rendering must therefore compose the active presentation once per scheduled redraw and blit it across the visible grid, not invoke project composition for every copy.

`apps/studio/app/composables/useEditor.ts` owns pixel writes and undo. A stroke records original values by source-pixel index and commits one compact pixel-history entry. The current paint, dither, and shape methods clip brush footprints and endpoints to source bounds; calling them once per tile or wrapped point would either lose edge pixels or amplify work. The canvas needs a bounded exact-sample mutation API that accepts deduplicated source-coordinate samples inside one stroke and atomically commits a shape as one history entry. Fill and picker only need a wrapped seed coordinate and can retain their contracts.

`apps/studio/app/utils/raster.ts` contains deterministic line, rectangle, circle, selection, resize, and rotate algorithms and is the correct home for positive modulo, tiled layout/source-tile calculation, display-to-source mapping, brush expansion, and wrapped-point deduplication. Existing unit coverage in `raster.test.ts` and `render.test.ts` provides the pure-test seam. `studio.spec.ts` already covers View commands, shapes, selection, zoom, right-click color, and exports. `responsive.spec.ts` covers touch menus, pinch/hand behavior, 412×839 and 820×1180 layouts, and instruments a 120×120 canvas to prevent resize writes, excessive clears, and per-pixel `fillRect` regressions.

Commit `385b075` replaced deep canvas watchers and immediate redraws with localized pixel history, reusable buffers, and animation-frame batching; those safeguards are non-negotiable. Commit `a0500e4` established shape previews, selection transforms, zoom/pan behavior, and mobile canvas controls. Commit `d760017` centralized desktop/touch View commands and removed canvas-toolbar view toggles. `docs/project-workspace.md`, `docs/qa.md`, and the reviewed desktop/phone/tablet snapshots describe those contracts.

## Proposed approach

Implement Tiled Mode as a presentation over one source project and one physical HTML canvas representing the repeated surface. Add `useTiledMode` with stable Nuxt state for `enabled`, `columns`, `rows`, settings-dialog visibility, and hydration status. It validates the 2–9 range, exposes the deterministic source tile (`floor((axis - 1) / 2)`, choosing the upper-left central member for even dimensions), and reads/writes one versioned device preference object. No tiled field enters an editor document or project schema.

Extend the shared View model with a checked **Tiled Mode** item and **Tiled Mode settings…** action. Both remain disabled on Home without resetting state. Keep shortcut handling in `index.vue`; process `Shift+T` before plain `T` selects Dither, only when an editor is active and no text/modal control owns the event. Mount one accessible settings dialog at the page boundary. It copies saved values into drafts on open, supplies 2×2, 3×3, and 5×5 presets, rejects non-integer/out-of-range input, warns without blocking above 5 on either axis, applies both axes atomically, and discards drafts on Cancel, Escape, or backdrop dismissal.

Refactor `PixelCanvas.vue` around a coordinate record containing display-grid pixel, wrapped source pixel, tile row/column, and source-tile membership. Normal mode uses the same helpers with a 1×1 layout. Strokes and shapes retain unbounded display coordinates for the gesture, rasterize in display space, expand the brush footprint, positive-modulo every sample to source dimensions, and deduplicate by source index before mutation. This keeps all edges and corners continuous. Mirror and dither operate on wrapped source coordinates so axes and pattern remain tied to the artwork. Fill and picker map only their seed. Shape previews use the same wrapped generator as commit and repeat visually across all copies.

Add an editor-owned exact-sample path: write validated, bounded, deduplicated `PixelSample` entries into the active compact mutation, plus an atomic wrapper for completed shape samples. Continuous pencil/eraser/mirror/dither gestures write between one `beginStroke` and `endStroke`; line/rectangle/circle call the atomic wrapper once. Existing normal-mode methods may delegate to the primitives without behavior changes. One gesture produces at most one undo checkpoint and dirty-revision increment regardless of tile count.

Render one zoomed presentation tile per scheduled frame into a reusable offscreen canvas: checkerboard or opaque base, previous-frame onion silhouette, and composited active frame. Blit it across the physical canvas with image smoothing disabled, then draw wrapped shape/cursor previews, the pixel grid, and a restrained violet source-tile outline. Translate selection overlays/handles into that tile only. Do not create nine Vue components, canvas nodes, project composites, pixel arrays, or editor writes. Reuse offscreen elements and resize only when source dimensions or zoom change.

When mode or dimensions change, preserve the viewport’s logical focus by relocating the source coordinate under the viewport center to the designated source tile after resize. Fit math uses `source width × columns` and `source height × rows` while retaining the 4–24 zoom bound; compact devices may scroll rather than make pixels unusably small. Wheel/pinch focus calculations use display-surface coordinates, and hand panning continues to move `.canvas-scroll`. CSS supplies custom overflow, neutral surfaces, source outline, unavailable selection feedback, and safe dialog geometry.

## Architecture and data flow

The authoritative flow is `device preference → useTiledMode state → menu/dialog + page zoom lifecycle + PixelCanvas presentation`. `index.vue` hydrates after repository initialization and persists only after hydration, preventing defaults from overwriting saved values. The stored object is `{ version: 1, enabled: boolean, columns: number, rows: number }`; malformed values normalize to 3×3 defaults without touching artwork. Apply updates state once and schedules one resize/redraw. View and `Shift+T` change only `enabled` through the same persistence path.

`PixelCanvas` derives effective axes as 1×1 when off and configured axes when on. A scheduled redraw builds one source presentation bitmap from project/frame/layer visibility, checker state, onion state, zoom, and dirty revision, then repeats that bitmap with `drawImage`. Physical dimensions are `project.width × zoom × effectiveColumns` by `project.height × zoom × effectiveRows`. Grid lines span the full surface because boundaries align to integer pixels. Outline, preview, cursor, and selection decorations never enter source pixels.

A pointer maps through the canvas bounds to an unclamped display-grid coordinate. The helper returns `source = positiveModulo(display, sourceSize)` and tile identity. Continuous tools interpolate between display points before wrapping; shapes rasterize from display start/end before brush expansion and wrapping. The canvas turns results into unique bounded `PixelSample` objects, and `useEditor` validates again at mutation. Fill/picker receive one wrapped coordinate. Selection creation, moving, hit testing, resize, and rotate require the pointer inside the source tile, subtract its origin, and use existing bounded math; surrounding copies return unavailable feedback without clearing or mutation.

The Rust boundary, filesystem, database schema, project serialization, import/export, thumbnails, updater, authentication, and assistant are unchanged. Preference failures are recoverable: the session uses safe values, errors do not dirty artwork, and later saves can replace the preference.

## Affected files

- `apps/studio/app/components/ApplicationMenu.vue`: shared View commands, checked/disabled state, settings access, and shortcut label.
- `apps/studio/app/components/TiledModeDialog.vue` (new): accessible draft fields, presets, validation/warning, Apply/Cancel/Escape, focus return, and touch layout.
- `apps/studio/app/composables/useTiledMode.ts` (new): presentation state, axis normalization, source-tile choice, versioned preference lifecycle, and dialog control.
- `apps/studio/app/components/PixelCanvas.vue`: tiled dimensions/rendering, display mapping, wrapped tools/previews, source-only selections, source outline, pinch focus, and batching.
- `apps/studio/app/composables/useEditor.ts`: validated exact-sample writes and one-checkpoint atomic raster commits preserving compact history.
- `apps/studio/app/pages/index.vue`: preference lifecycle, dialog mount, Shift+T, repeated-surface fit/wheel math, and focus preservation.
- `apps/studio/app/utils/raster.ts`: modulo, layout/mapping, brush expansion, and wrapped/deduplicated sample helpers.
- `apps/studio/app/utils/render.ts`: one-composition/many-blits presentation helper preserving layer opacity.
- `apps/studio/app/assets/css/main.css`: repeated-surface/dialog styling, selection feedback, safe areas, touch targets, and reduced motion.
- `apps/studio/tests/unit/raster.test.ts`: edge/corner, negative-coordinate, even-grid source-tile, brush-wrap, and deduplication tests.
- `apps/studio/tests/unit/render.test.ts`: reusable source composition and repeated blit assertions.
- `apps/studio/tests/e2e/studio.spec.ts`: desktop menu/settings/tools/seams/undo/selection/persistence/export/dirty-state coverage.
- `apps/studio/tests/e2e/responsive.spec.ts`: phone/tablet menus/dialog, pinch, hand pan, containment, landscape, and 120×120 performance coverage.
- `apps/studio/tests/e2e/studio.spec.ts-snapshots/studio-workbench.png`: reviewed desktop tiled baseline.
- `apps/studio/tests/e2e/responsive.spec.ts-snapshots/phone-workbench.png`: reviewed 412×839 tiled baseline.
- `apps/studio/tests/e2e/responsive.spec.ts-snapshots/tablet-workbench.png`: reviewed 820×1180 tiled baseline.
- `docs/ui-snapshots/studio-workbench.png`: refreshed reviewed product snapshot if Tiled Mode is represented there.
- `docs/project-workspace.md`: user-facing behavior, tools, settings, persistence, selection, and export boundaries.
- `docs/qa.md`: functional, performance, accessibility, responsive, and snapshot verification.

## Contracts and migrations

No project, `.zakape`, PGlite table, native command, permission, network, export, or updater migration is required. One device preference key stores a versioned JSON object. Hydration treats missing, malformed, fractional, or out-of-range axes as 3, never silently clamps an invalid dialog draft on Apply, and ignores unknown properties. State is shared across documents and excluded from clone/save/export/thumbnail data and dirty revision.

Internal TypeScript contracts add tiled configuration/layout, display-to-source mapping, and an editor exact-sample mutation method. Editor samples remain bounded and are coerced to the project color mode before writing. User files and exports stay source-sized and backward compatible. Rollback leaves an unused preference row that older builds ignore.

## Dependencies and sequence

`VIEW-R7CR` is advisory and completed, so there is no implementation block. Implement pure raster/layout helpers and tests first, then state/preferences. Stabilize the exact-sample editor boundary before canvas input. Build the repeated renderer and coordinate pipeline as one vertical slice, then add menu, shortcut, settings, fit/focus, and selection gating. Desktop and responsive E2E work is parallel-safe only after these contracts stabilize. Documentation, snapshots, validation, and evidence follow verified behavior.

## Risks and mitigations

- **Large-canvas regression:** use one physical canvas, one source composition, cached surfaces, `drawImage` blits, compact history, deduplicated source samples, and one scheduled redraw. Extend 120×120 instrumentation with composition/mutation counts.
- **Wrong seam mapping:** retain display coordinates through each gesture and unit-test modulo for negatives, all edges/corners, non-square sources, long drags, and every 2–9 layout.
- **Preview/commit mismatch:** use the same raster → brush expansion → wrap → dedupe pipeline and assert equality for line, rectangle, and circle.
- **Brush/mirror/dither edge errors:** expand before wrapping, calculate mirror axes and dither parity in source space, and deduplicate overlaps by source index.
- **Undo amplification:** exact writes share one mutation and atomic shapes commit once; E2E asserts one Undo removes a gesture from any copy.
- **Selection corruption:** render/translate selections only in the designated source tile and reject surrounding starts before changing state; test odd/even layouts and all transforms.
- **Zoom jumps:** use repeated display coordinates for wheel/pinch focus and preserve viewport center during layout changes; test scrolled copies and zoom extremes.
- **Mobile overload:** retain minimum zoom and scroll overflow, constrain dialog/menu to safe areas, warn above five axes, and review portrait/landscape.
- **Preference races/dirtiness:** persist only after hydration, validate stored data, and assert no change to dirty revision, undo, project JSON, or exports.
- **Checker/onion/opacity drift:** blit one complete presentation tile instead of relying on a continuous CSS checker phase or opacity-flattening array.
- **Accessibility:** use checked menu roles, labelled inputs, associated errors/warnings, modal semantics, focus return, Escape, visible focus, and ≥42-pixel touch targets.
- **Security/privacy:** no new native, filesystem, account, model, or network input exists; bound numeric preferences at UI and composable boundaries.

## Validation strategy

- AC-1: desktop/touch Playwright verifies both View commands, Home disabling without reset, checked synchronization, settings access, editor-only Shift+T, and plain T still selecting Dither.
- AC-2/AC-3: E2E verifies initial 3×3 dimensions/outline, identical content in nine copies, mapping from center and surrounding copies, immediate repeat, and one Undo per gesture.
- AC-4/AC-5: unit/E2E tests exercise all supported tools at each edge/corner, compare shape preview and commit, and verify grid, checker, onion skin, layer opacity, and singular Live Preview.
- AC-6: desktop/touch tests cover box/lasso create/move/resize/rotate in the source tile and confirm surrounding starts/handles do not clear or mutate selection; 1×1 regressions remain green.
- AC-7: tests cover presets, independent 2–9 values, even-axis source choice, >5 warning, invalid/decimal/empty input, Cancel/Escape, and preservation of valid settings.
- AC-8: reload tests verify local persistence while project JSON/export dimensions, dirty state, autosave, undo, thumbnails, and another document remain independent.
- AC-9: Playwright and full-size review cover desktop, 412×839 phone, 820×1180 tablet, and phone landscape for touch Menu, dialog bounds, custom scrollbars, pinch focus, hand pan, fit, safe areas, selection feedback, and no browser overflow/gestures.
- AC-10: extend the 120×120 mobile probe to count canvas resizes, scheduled clears, source composition/traversal, blits, and editor mutations during a 3×3 stroke. Require no pointer-time dimension writes, no per-tile project/pixel clone or mutation, one source composition per scheduled redraw, and bounded frame work.
- Engineering gates: run focused Vitest/Playwright, then studio lint, typecheck, unit tests, static build, full Playwright, `pnpm spec validate CANVAS-KG4B`, `pnpm format:check`, and `git diff --check`. Inspect every updated snapshot full-size.

## Rollout and recovery

Ship atomically because this is offline presentation state without a schema migration. Tiled Mode defaults off; first activation uses 3×3. The >5 warning is advisory, and users can recover performance by choosing a smaller preset or turning the mode off. Invalid saved values fall back safely, persistence errors do not prevent editing, and Home retains but cannot execute state.

If input/rendering regresses, disabling Tiled Mode restores the established 1×1 path without altering pixels. Reverting code requires no data recovery; the unused preference is harmless. Release acceptance requires source-sized export checks, mobile 120×120 performance evidence, and reviewed desktop/phone/tablet visuals.
