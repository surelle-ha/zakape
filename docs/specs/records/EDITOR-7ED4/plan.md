# EDITOR-7ED4 implementation plan

## Codebase and history evidence

- `apps/studio/app/components/AppSplash.vue` and `AuthenticationPage.vue` render dedicated `.splash-field` and `.authentication-grid` decorative elements. `apps/studio/app/assets/css/main.css` also applies two-axis grid images directly to `.home-workspace` and `.home-brand-canvas`. The page-level auth radial light and foreground card treatments are separate and can remain.
- `apps/studio/app/components/PixelCanvas.vue` keeps selection geometry in `selection.points`, captures one `PixelSample` for every selected coordinate, and uses those same arrays for preview bounds and transform handles. This geometry must remain intact even when pixel writes are alpha-filtered.
- `apps/studio/app/composables/useEditor.ts` currently clears every selected source coordinate and writes captured `null` values during `moveSelection`; `transformSelection` has the same clear/write behavior. Both paths use a project checkpoint, so the corrected mutation can remain a single undo/redo step.
- `apps/studio/app/utils/raster.ts` performs nearest-neighbor resize/rotation over a complete rectangular or lasso sample map. Keeping transparent samples in the geometric transform preserves holes and the user-selected bounds; filtering belongs at the pixel mutation boundary, not in the geometry algorithms.
- `apps/studio/app/components/ProjectLauncher.vue` already renders six presets and a Custom card, but initializes Custom with the first preset, rejects zero colors, prevents removing the last custom color, and has no Skip card. `createBlankProject` in `utils/project.ts` silently replaces an explicit empty palette with a default palette and always substitutes a fixed greyscale ramp.
- `coercePixelToColorMode` constrains indexed colors to the current palette once one exists. The regular drawing paths call it but do not register first-used colors, while assistant edits have separate palette-push logic. A centralized indexed-color registration contract is needed to prevent empty-palette behavior from diverging between pencil, shapes, fill, dither, and assistant operations.
- `tests/unit/raster.test.ts` covers transform sampling; `tests/unit/project.test.ts` covers palette normalization and project parsing; `tests/e2e/studio.spec.ts` covers project palette creation and selection gestures; `responsive.spec.ts` covers splash/auth/Home at phone sizes. These are the existing regression surfaces to extend.
- Commit `02625e8` introduced pixel selection, `a0500e4` added smart resize/rotation, `0a5065b` introduced custom color tools, and `96066cc` most recently adjusted the workspace/canvas. The plan preserves those ownership boundaries and interaction patterns.

## Proposed approach

1. Remove the decorative grid layers from the three entry experiences. Delete the unused splash/auth grid elements and their selectors, and remove grid `background-image`/`background-size` rules from both the Home page and its brand-art panel. Keep the approved dark neutral fills, subtle non-grid lighting, cards, logo motion, progress motion, and reduced-motion fallbacks.
2. Separate selection geometry from pixel mutation. Add small pure selection helpers that capture only colored source samples and apply a cut transform by clearing only colored source coordinates and writing only colored destination samples. `selection.points` and full transform previews remain the mask/bounds source, so transparent holes, rectangle/lasso shape, handles, and rotation center do not collapse around the artwork.
3. Update `moveSelection` to translate and clip the complete selection mask while applying the colored source samples only. Update resize/rotate commit to pass the full transformed mask for the next selection geometry but filter source clears and destination writes through the same helper. Do not create a checkpoint, dirty revision, or success message for an all-transparent/no-change operation.
4. Make palette intent explicit in the launcher. Add a Skip radio-card, initialize Custom as an empty list, allow removal of its last color, remove the zero-color submission error, and show honest summary text for zero-color choices. Preserve the existing design-system `ColorPicker`, validation, touch targets, and keyboard radio semantics.
5. Change project creation so an explicitly supplied empty palette remains empty; only an omitted palette argument receives the existing default. Normalize non-empty greyscale starting colors into unique greyscale values rather than silently replacing a chosen preset/custom set. Existing saved projects remain valid because the schema already permits empty arrays.
6. Centralize indexed first-use color registration in project/editor helpers. An indexed project below 256 colors accepts and registers a new normalized drawing color once; at 256 colors it uses nearest-palette coercion. All editor drawing paths and assistant pixel/recolor operations use the same rule. Palette growth is project metadata and remains after pixel-only undo, matching the existing separation between palette state and stroke history.
7. Add unit and end-to-end regressions for alpha-safe move/resize/rotate, overlap, clipping, empty selections, empty/custom/skipped palettes, indexed first-use registration/cap behavior, and plain desktop/mobile entry surfaces. Capture and inspect stable UI snapshots for splash, auth, Home, and the new-project palette choices.

## Architecture and data flow

`PixelSelection.points` remains the authoritative geometric mask tied to one frame and layer. On move, the editor captures non-null source samples before mutation, translates the full mask for selection feedback, then calls a pure cut/apply helper. On resize or rotation, `PixelCanvas` continues transforming the full sample grid for stable nearest-neighbor geometry; `useEditor.transformSelection` applies only non-null samples and keeps the transformed full-mask coordinates as the new selection. The owning composable performs one checkpoint immediately before a real mutation.

Palette intent flows from `ProjectLauncher` as an explicit array: omitted means the programmatic default, while `[]` means the user intentionally chose Skip or an empty Custom palette. `createBlankProject` preserves that distinction and the version-1 persisted schema remains unchanged. Drawing-color resolution normalizes the requested color, applies greyscale rules when needed, registers new indexed colors while capacity remains, and falls back to nearest indexed color only at capacity. Editor and assistant callers share this utility rather than maintaining separate palette-growth rules.

Entry-surface changes are presentation-only. Components stop emitting decorative grid nodes where they serve no semantic purpose; `main.css` retains dark neutral surfaces and approved non-grid accents. No native API, filesystem, network, authentication, or persistence boundary changes.

## Affected files

- `apps/studio/app/components/AppSplash.vue` — remove the decorative splash grid element while retaining splash content and motion.
- `apps/studio/app/components/AuthenticationPage.vue` — remove the decorative authentication grid element while retaining the radial light and card.
- `apps/studio/app/components/ProjectLauncher.vue` — add Skip, make Custom genuinely empty-capable, and update validation/summary/accessibility.
- `apps/studio/app/components/PixelCanvas.vue` — preserve geometric masks while supplying alpha-safe samples and transform commits.
- `apps/studio/app/composables/useEditor.ts` — apply colored-only selection mutations and shared indexed first-use palette registration.
- `apps/studio/app/utils/selection.ts` (new) — provide pure capture/translate/apply helpers for non-transparent selection mutation.
- `apps/studio/app/utils/project.ts` — distinguish omitted/default from explicit empty palettes and centralize color-mode/indexed registration behavior.
- `apps/studio/app/utils/assistant.ts` — reuse the indexed registration contract for assistant-applied pixels and recolors.
- `apps/studio/app/pages/index.vue` — present a compact empty-palette hint in the canvas palette strip.
- `apps/studio/app/assets/css/main.css` — remove entry-surface grid rules/elements and style Skip/empty palette states responsively.
- `apps/studio/tests/unit/selection.test.ts` (new) — cover colored-only cut/apply, overlap, clipping, empty masks, and destination preservation.
- `apps/studio/tests/unit/project.test.ts` — cover explicit empty palettes, omitted defaults, greyscale normalization, indexed growth, deduplication, and capacity fallback.
- `apps/studio/tests/unit/assistant.test.ts` — confirm assistant operations follow the shared indexed palette rule.
- `apps/studio/tests/e2e/studio.spec.ts` — cover launcher choices and rectangular/lasso move/resize/rotate behavior with transparent holes and undo/redo.
- `apps/studio/tests/e2e/editor-7ed4-visual.spec.ts` (new) — capture the grid-free authentication entry surface before Guest access.
- `apps/studio/tests/e2e/responsive.spec.ts` — cover plain splash/auth/Home presentation and palette choice containment on phone/tablet.
- `docs/ui-snapshots/` — update reviewed splash/auth/Home and project-creation evidence where the existing QA workflow stores it.
- `docs/qa.md` — document the new visual and interaction regression coverage.
- `docs/project-memory/architecture.md` — record the durable separation between selection-mask geometry and colored pixel mutation if implementation confirms this boundary.

## Contracts and migrations

- **Selection contract:** transparent means `null` in the active cel. Selection masks may contain transparent coordinates for geometry and hit testing, but move/resize/rotate clears only source coordinates that contained a color at gesture start and writes only non-null transformed samples. Destination values under transparent mask cells are preserved.
- **Undo contract:** each selection gesture with a real pixel change is one project-history operation. An all-transparent or unchanged gesture does not add history or mark the document dirty.
- **Palette input contract:** omitted palette input uses the programmatic default; an explicit empty array is preserved. Skip and empty Custom therefore serialize as `palette: []` without a schema-version change.
- **Indexed contract:** normalized new colors are registered without duplicates until the existing 256-color limit. At capacity, requested colors resolve to the nearest existing palette entry. Invalid colors remain rejected by existing normalization/parse validation.
- **Greyscale contract:** an empty palette remains empty; non-empty selected colors are normalized into unique greyscale values, and drawn pixels remain greyscale-coerced.
- **Persistence migration:** none. `parseSpriteProject` already accepts zero-length palette arrays and version-1 files remain compatible. Existing projects and imported files are not rewritten until normal save behavior occurs.
- **Native/security contract:** none. No capabilities, secrets, paths, network access, or platform APIs are added.

## Dependencies and sequence

No unfinished specification dependency exists, so implementation is ready without an override. Completed selection and workspace work are historical inputs only.

Implementation order:

1. Add pure selection and palette contract tests, then implement their utilities.
2. Integrate alpha-safe mutation and palette registration into `useEditor`, `PixelCanvas`, and assistant operations.
3. Update launcher intent handling and the empty canvas-palette state.
4. Remove entry-surface grids and adjust responsive styling.
5. Add desktop/touch E2E coverage and review screenshots.
6. Update QA/project memory and run all validation gates.

The pure selection helper/tests and presentation grid removal are parallel-safe because they share no files. Project/palette utilities must land before launcher/editor/assistant integration. `studio.spec.ts`, `main.css`, and final documentation should each have one owner during implementation to avoid conflicting edits.

## Risks and mitigations

- **Selection bounds collapse:** filtering transparent samples too early would move handles and change rotation centers. Keep full geometric masks through preview and filter only at the mutation boundary; test artwork that does not touch mask edges.
- **Destination erasure or overlap smearing:** clearing/writing in one pass can destroy captured values. Capture all colored source samples first, clear their source indices, then write colored destination samples; test overlapping moves in both directions.
- **Incorrect empty-selection history:** checkpointing before discovering there is no colored work creates false undo entries. Compute the mutation first and checkpoint only when it will change source/destination pixels.
- **Indexed palette drift:** separate editor and assistant rules could create pixels absent from the palette or stop growth after the first color. Use one normalized registration helper, deduplicate case-insensitively, enforce 256 entries, and test every caller class.
- **Palette undo expectations:** automatically registered colors will outlive pixel-only undo. Treat registration as reusable project metadata, document it in the plan, and verify undo still restores pixels exactly.
- **Misleading greyscale choices:** storing colored preset values in greyscale mode would disagree with rendered pixels. Normalize chosen entries to greyscale and deduplicate them.
- **Over-removing useful visuals:** broad gradient removal could flatten cards or remove the transparency checker. Target only grid elements/images identified in the spec and compare desktop/phone screenshots.
- **Responsive overflow:** an extra palette option and empty hint can expand the launcher. Retain existing responsive grid behavior, use touch-sized controls, and test phone/tablet containment and scrolling.
- **Performance regression:** selection fixes must stay proportional to the selected mask/samples and avoid per-pointer-move project snapshots. Mutation occurs once on pointer-up and preview remains animation-frame scheduled.

## Validation strategy

- **AC-1:** Playwright desktop and phone/tablet checks assert the decorative nodes are absent and computed entry-surface backgrounds contain no grid image; visually review splash, auth, Home, and Home brand artwork snapshots.
- **AC-2/AC-3/AC-8:** unit-test pure selection application and Playwright-test mixed transparent/colored rectangular and lasso masks through move, resize, rotation, overlap, and edge clipping. Sample destination pixels to prove transparent holes preserve prior artwork.
- **AC-4:** Playwright-test one-step undo/redo after move and transform, including exact source/destination restoration; unit-test all-transparent/no-change operations.
- **AC-5/AC-6/AC-7/AC-9:** unit-test project/palette contracts and Playwright-test Preset, empty Custom, and Skip creation, accurate summary/hints, custom design-system picker use, persistence, indexed first-use growth, and 256-color fallback.
- Run studio lint, typecheck, unit tests, production build, focused and full Playwright where practical, desktop/phone/tablet screenshot review, spec validation, formatting checks on changed files, and `git diff --check`.

## Rollout and recovery

No flag or data migration is required. The change ships through the normal desktop/Android/web release paths. Rollback is a code-only revert because existing project files remain schema-compatible; projects created with an empty palette also remain readable by the current parser. If indexed auto-registration causes an unforeseen problem, its centralized helper can be reverted independently while leaving explicit empty palettes and the UI choices intact.
