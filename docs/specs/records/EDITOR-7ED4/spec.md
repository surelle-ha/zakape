# EDITOR-7ED4 — Plain entry surfaces and precise selection moves

## Problem and evidence

Three parts of the studio currently conflict with the intended interaction model:

- The home workspace, authentication page, and splash page use decorative grid fields. The user wants these entry surfaces to be visually quiet, solid dark surfaces without a moving or static grid backdrop.
- Rectangular and lasso selections represent every coordinate inside their geometry. `moveSelection` currently clears and writes all of those coordinates, including `null` pixels, so transparent cells can erase colored destination pixels even though the user intended to move only artwork.
- The new-project launcher selects the first preset palette by default. Although a custom-palette card exists in source, the workflow has no explicit way to start without choosing a preset and the custom path is not sufficiently clear to the user.

## Desired outcome

Entry surfaces use a plain dark background, selection moves affect only colored pixels, and project creation clearly supports preset, custom, and intentionally skipped starting-palette paths without making ordinary drawing unusable.

## User journeys

- A user launches Zakape, chooses an identity, and arrives at Home without seeing a decorative grid backdrop on the splash, authentication, or Home surfaces.
- A user selects a region containing both colored and transparent pixels, drags it, and sees only colored pixels cut from their source locations and placed at the destination. Transparent holes do not erase unrelated destination artwork.
- A user creates a project with a preset palette, builds a custom palette, or explicitly skips a starting palette, subject to the final color-mode contract.
- If a selection move is undone, all affected source and destination pixels return exactly to their previous values in one undo action.

## Functional requirements

- **FR-1:** The splash, authentication, and Home workspace backgrounds must not render decorative grid elements, grid images, or grid motion.
- **FR-2:** Those surfaces must retain a readable dark neutral base and the existing content hierarchy, accessibility, and reduced-motion behavior.
- **FR-3:** Rectangular and lasso movement must capture, clear, and write only non-transparent pixels from the active frame and active layer.
- **FR-4:** A transparent coordinate inside a selection must not overwrite or clear a destination pixel.
- **FR-5:** A successful move must remain one undoable editor operation and must translate the selection geometry without collapsing its rectangular or lasso mask to only colored coordinates.
- **FR-6:** The project launcher must make preset, custom, and skip/no-preset starting-palette choices explicit and keyboard/touch accessible.
- **FR-7:** The custom choice must expose the existing color editor and support adding/removing valid unique colors within the 256-color project limit.
- **FR-8:** Choosing Skip must create an empty project palette for RGBA, greyscale, and indexed modes instead of silently substituting the default preset.
- **FR-9:** In indexed mode, the first use of a valid color must add that color to an empty or partially populated project palette until the 256-color limit is reached; at the limit, existing nearest-palette coercion applies.
- **FR-10:** Selection move, resize, and rotation must transform only non-transparent pixel samples; transparent samples must not clear or paint pixels while the selection mask and transform handles remain usable.
- **FR-11:** The Custom palette path may be submitted with zero colors and must preserve an empty palette.

## Acceptance criteria

- **AC-1:** Visual inspection and snapshots show no grid backdrop on splash, authentication, or Home at desktop and phone viewport sizes.
- **AC-2:** Moving a mixed opaque/transparent rectangular selection over existing artwork moves the opaque pixels and leaves destination pixels under transparent selection cells unchanged.
- **AC-3:** The same behavior passes for a lasso selection, including transparent holes and canvas-edge clipping.
- **AC-4:** Undoing and redoing either move restores and reapplies all source and destination pixels as a single history step.
- **AC-5:** The new-project form visibly offers preset, custom, and skip/no-preset paths and accurately summarizes the chosen palette behavior before creation.
- **AC-6:** A custom palette can be created with the existing design-system color picker without falling back to a native browser color input.
- **AC-7:** A skipped palette persists as empty in a newly created RGBA or greyscale project; a skipped indexed palette begins empty and records each newly used drawing color without duplicates.
- **AC-8:** Resize and rotation tests with mixed opaque/transparent selections show no destination erasure or transparent painting, while colored samples remain correctly transformed.
- **AC-9:** A custom palette with zero colors can create a project and remains empty until colors are added.

## Edge cases and failure behavior

- Moving a selection containing no colored pixels performs no project mutation and creates no misleading history entry.
- Colored pixels moved beyond canvas bounds are removed only according to the existing bounded cut-and-move behavior; transparent coordinates never affect in-bounds destination artwork.
- Overlapping source and destination regions must use captured source values so write order cannot smear pixels.
- Duplicate custom colors normalize to one value; invalid colors and palettes over 256 entries remain rejected.
- Desktop pointer, phone/tablet touch, keyboard focus, and reduced-motion preferences retain usable behavior.

## Constraints

- Preserve local-first/offline behavior and the `.zakape` version-1 schema unless clarification proves a schema change necessary.
- Do not change canvas transparency checker rendering; this request concerns the entry-surface decorative grids only.
- Preserve nearest-neighbor pixel fidelity, active-layer/frame isolation, and one-step undo semantics.
- Avoid per-pointer-move deep project cloning or work proportional to the entire canvas when the selection contains comparatively few colored pixels.
- Retain dark neutral surfaces with violet used as an accent rather than a page background.

## Assumptions

- “Home page” refers to `HomeWorkspace.vue`, “auth” to `AuthenticationPage.vue`, and “splash page” to `AppSplash.vue`; verified from the application shell and existing E2E tests.
- “Inactive pixels” means `null`/transparent cells in the active layer cel, not colored pixels hidden by another layer; verified against the `Pixel` and selection model.
- Plain backgrounds may retain foreground cards, typography, progress animation, and normal accent styling; only decorative background grids are removed.
- The existing custom palette UI is a valid foundation but must be made unambiguous alongside the new skip path.

## Out of scope

- Removing the transparency checker from canvases or document previews.
- Changing selection resize/rotation behavior beyond any shared transparent-pixel correctness required to keep transforms consistent.
- Adding palette extraction, palette import/export, or global palette-library management.
- Redesigning authentication, Home content, or the splash duration.

## Clarification record

1. **Question:** When moving a selection containing transparent cells, should the operation cut colored pixels or copy them? **User answer:** Use option 1. **Decision:** Move only non-transparent pixels, clear those colored source pixels, and preserve transparent holes so they never erase destination content.
2. **Question:** What should Skip starting palette create across color modes? **User answer:** Use the recommendation. **Decision:** RGBA and greyscale projects may retain an empty palette; indexed projects also begin empty and add valid colors as they are first used, up to the 256-color limit, rather than silently falling back to a preset.
3. **Question:** How plain should the three entry surfaces be? **User answer:** A. **Decision:** Remove the grid motif and animated grid only; retain subtle non-grid lighting/gradient accents and foreground cards.
4. **Question:** Should transparent-safe behavior cover selection resize and rotation? **User answer:** A. **Decision:** Yes. Transform only colored samples; transparent cells never clear or paint pixels, while the selection mask and handles remain usable.
5. **Question:** Should Custom allow an empty palette? **User answer:** A. **Decision:** Yes. Custom may be submitted empty and colors can be added later.
6. **Question:** Does the clarified design tree reflect the shared understanding? **User answer:** Yes. **Decision:** The requirements are approved for specification finalization.

## Dependencies

No unfinished specification dependency was found. The work touches established editor selection behavior from the completed selection-transform work and presentation conventions from prior UI work, but those capabilities are already present and do not block independent delivery.

## Open questions

None.
