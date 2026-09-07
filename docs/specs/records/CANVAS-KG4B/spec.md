# CANVAS-KG4B — Interactive tiled canvas mode

## Problem and evidence

Zakape has no way to preview or paint artwork as a seamless repeating texture. Artists must infer whether opposite edges join correctly or repeatedly export and inspect the image elsewhere. The shared View menu added by `VIEW-R7CR` is the established home for canvas presentation modes, while `PixelCanvas.vue` currently renders and maps input against only one source canvas. The feature must extend that architecture without multiplying project state or repeating expensive editor mutations for every visual copy.

## Desired outcome

Artists can enable **Tiled Mode** from View and see the active frame repeated in a 3-column by 3-row grid. Every tile is an interactive view of the same source artwork: drawing within any copy, including across its boundary, maps through wrapped coordinates to one source canvas and immediately appears in all nine copies. The artist can configure rows and columns independently while ordinary project files and exports remain unchanged.

## User journeys

- From an editor document, the artist enables **View → Tiled Mode** or presses **Shift+T**. A 3×3 repeated work surface replaces the single-canvas presentation, with the center/source tile subtly outlined and the current zoom applied uniformly.
- The artist paints on any repeated tile. Pencil, eraser, mirror pencil, dithering, line, rectangle, circle, fill, and color picker map the pointer through modulo source coordinates. A stroke crossing an edge continues on the opposite source edge and all visible copies update in the same animation frame.
- The artist opens **View → Tiled Mode settings**, selects 2×2, 3×3, or 5×5, or enters independent column and row values from 2 through 9. Values above 5 on either axis show a non-blocking performance warning. Applying valid settings updates the current view and stores the preference on the device.
- On phone or tablet, the artist uses the existing bottom Menu → View hierarchy for both Tiled Mode and its settings. The tiled surface preserves touch drawing, pinch zoom, hand panning, safe areas, and usable tile scale; overflow is scrollable instead of shrinking all copies to fit.
- The artist returns Home or switches documents. Home disables the command without clearing its state; returning to an editor restores the mode and device-level dimensions. Turning Tiled Mode off restores the ordinary single canvas without changing artwork or dirty state.
- With a selection tool active, selection and transform interaction is available only on the outlined center/source tile. Pointer attempts on surrounding copies do not start or mutate a selection and provide clear unavailable cursor/feedback.

## Functional requirements

- FR-1: Add **Tiled Mode** as a checked command in the shared desktop and touch View menus, disabled on Home, with **Shift+T** as its keyboard shortcut.
- FR-2: When enabled, render the active frame as a 3×3 grid by default, with a restrained accent outline identifying the center/source tile.
- FR-3: Treat every rendered tile as a view of one authoritative project/frame/layer state; never create duplicate cels, layers, frames, pixels, or undo entries for visual copies.
- FR-4: Map pencil, eraser, mirror, dither, line, rectangle, circle, fill, and picker input from any repeated tile to source coordinates using positive modulo wrapping.
- FR-5: Continue pointer-driven strokes and shape previews across source edges, wrapping every rasterized point so opposite edges can be authored seamlessly.
- FR-6: Update every visible tile from the same bounded render pass after a source mutation; a gesture creates the same single undo checkpoint it would in normal mode.
- FR-7: Repeat the source artwork, transparency checkerboard, pixel grid, and onion-skin presentation consistently in every tile. Keep Live Preview as one independent preview.
- FR-8: Apply zoom uniformly to every tile. Preserve pointer-centered wheel zoom, two-finger pinch zoom, hand panning, custom scrollbars, and fit behavior against the tiled work surface.
- FR-9: Restrict box/lasso selection creation, moving, resizing, and rotation to the outlined center/source tile while Tiled Mode is active.
- FR-10: Add a Tiled Mode settings dialog reachable from View on desktop, phone, and tablet, with independent Columns and Rows integer fields constrained to 2–9 and presets for 2×2, 3×3, and 5×5.
- FR-11: Default both axes to 3. Show a non-blocking performance warning when either value exceeds 5, reject or clamp invalid values, and keep the last valid settings if the dialog is cancelled.
- FR-12: Store enabled state and dimensions as local device preferences, not project data. Project autosave, `.zakape` files, imports, exports, recent thumbnails, and dirty revision must ignore Tiled Mode.
- FR-13: Turning the mode off, changing documents, opening Home, resizing the viewport, or changing dimensions must not lose pending committed artwork or reset unrelated canvas display settings.
- FR-14: The renderer must remain responsive for the supported project limit and must not perform one editor mutation, deep pixel clone, or full project recomposition per visual tile during pointer movement.

## Acceptance criteria

- AC-1: View exposes checked Tiled Mode and Tiled Mode settings commands in desktop and touch menus; Tiled Mode is disabled on Home and **Shift+T** keeps menu state synchronized.
- AC-2: First activation shows exactly nine copies arranged in three columns and three rows, with one identifiable center/source tile and identical active-frame pixels in every copy.
- AC-3: Drawing or picking on each of the center and surrounding copies resolves to the same source coordinate and refreshes all copies without duplicated undo history.
- AC-4: A pencil stroke and each supported shape that crosses the right, left, top, or bottom source boundary wraps to the opposite edge with the expected source pixels.
- AC-5: Pencil, eraser, mirror, dither, line, rectangle, circle, fill, picker, grid, checkerboard, and onion skin behave consistently in Tiled Mode; Live Preview remains singular.
- AC-6: Selection creation and transform work from the center tile and cannot begin from surrounding copies; existing normal-mode selection behavior remains unchanged.
- AC-7: Presets and valid independent values from 2–9 produce the requested grid; values above 5 show a warning, invalid input cannot be applied, and Cancel preserves prior dimensions.
- AC-8: Enabled state and dimensions survive an application restart on the same device but do not alter project JSON, dirty state, exports, or undo history.
- AC-9: Desktop, 412×839 phone, 820×1180 tablet, and phone-landscape layouts keep menus, settings, tiled work surface, zoom, panning, and scrollbars usable without viewport overflow or browser-native gestures.
- AC-10: A representative 120×120 project at the default 3×3 setting keeps a continuous pointer stroke bounded to one scheduled render per animation frame and avoids per-tile project mutation or pixel-buffer cloning.

## Edge cases and failure behavior

- Empty/fully transparent frames still show nine bounded checkerboard tiles with a visible center outline.
- Positive modulo mapping handles negative or overflow coordinates at all four edges and corners; diagonal strokes crossing a corner wrap on both axes.
- Rows/columns reject empty, fractional, NaN, below-2, and above-9 values. Cancel and Escape close the dialog without saving drafts; Apply requires valid values.
- Values above 5 are allowed after warning because the supported upper bound is explicit, but rendering remains lazy/batched and the UI must not freeze.
- Switching active frame, layer, document, visibility, color mode, onion skin, grid, checkerboard, or zoom redraws the tiled view without stale copies.
- Pointer cancellation ends or rolls back the same mutation checkpoint as normal mode. Pinch gestures and hand panning never paint wrapped pixels.
- When no exact geometric center exists for an even row or column count, the source interaction tile is the upper-left tile of the central 2×2 region; the dialog explains or the UI consistently marks that tile.
- Home disables Tiled Mode commands but retains the last enabled state and dimensions for the next editor document.

## Constraints

Tiled Mode is presentation and coordinate mapping over the existing editor state. It must remain local-first, offline, deterministic, and independent of AI or account access. No project schema or native permission changes are allowed. Rendering must follow the existing batched-canvas convention, avoid deep reactive pixel structures, and preserve the mobile large-canvas performance work. Controls need semantic checked/dialog roles, visible focus, at least 42-pixel touch targets, Escape/cancel recovery, safe-area containment, and reduced-motion compatibility. Neutral charcoal remains the surface color; violet is limited to source outline, focus, and active state.

## Assumptions

The user’s “3 canvas row and column” means three columns and three rows, totaling nine interactive views. All tiles edit the same source rather than creating a larger document. Existing editor tools ultimately mutate source pixel coordinates through `useEditor`, so tiled input should translate coordinates before invoking those mutations rather than replaying the command nine times. `VIEW-R7CR` established `ApplicationMenu.vue` as the shared desktop/touch View command boundary. These assumptions were verified against the user’s clarification, current `PixelCanvas.vue`, `useEditor.ts`, responsive tests, and completed spec history.

## Out of scope

- Exporting the 3×3 preview or changing PNG, GIF, sprite-sheet, Godot, or `.zakape` output dimensions.
- Creating tilemaps, tilesets, multiple editable source tiles, pattern brushes, symmetry/kaleidoscope modes, or offset/brick repetition.
- Cross-boundary box/lasso selections or transforms spanning more than one source wrap.
- Persisting Tiled Mode inside project files or syncing its preference between devices/accounts.
- Changing Live Preview playback, animation timing, frame/layer ownership, canvas-size limits, or project checker tile size.

## Clarification record

1. **Challenge:** Did “9×9 canvas” mean 81 copies or a 3×3 grid totaling nine? **Answer:** Three canvases per row and column. **Decision:** Default is 3 columns × 3 rows, totaling nine copies.
2. **Challenge:** Are copies passive previews or should drawing anywhere map back through wrapped source coordinates? **Answer:** Use wraparound editing. **Decision:** Every copy is interactive for supported drawing tools, and edge-crossing input authors seamless source edges.
3. **Challenge:** Which tools can operate outside the source tile? **Answer:** Use the recommended drawing-tool set. **Decision:** Pencil, eraser, mirror, dither, line, rectangle, circle, fill, and picker work on any copy; selection/transform stays restricted to the center/source tile.
4. **Challenge:** Is grid size fixed, and where is configuration exposed? **Answer:** Make it configurable using the proposed contract. **Decision:** View opens a settings dialog with independent 2–9 axes, 2×2/3×3/5×5 presets, default 3×3, device persistence, and a warning above 5×5.
5. **Challenge:** Which layouts support the mode? **Answer:** Desktop, tablet, and phone. **Decision:** Both shared View presentations expose equivalent commands and responsive interaction.
6. **Challenge:** Should tiled presentation affect project data, exports, zoom, display modes, or Live Preview? **Answer:** Accept all proposed boundaries. **Decision:** It is device-local view state; zoom/grid/checkerboard/onion skin repeat, the center is outlined, Live Preview stays singular, and exports remain source-sized.

## Dependencies

`VIEW-R7CR` is a completed architectural dependency because it owns the shared View menu used by both desktop and touch layouts. Since it is complete, it does not block planning or implementation. No unfinished specification dependency was detected. The implementation must integrate with the existing canvas performance safeguards established in project history rather than undoing them.

## Open questions

None.
