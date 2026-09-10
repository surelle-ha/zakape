# TOOLS-C4EX — Advanced painting and typography tools

## Problem and evidence

Zakape exposes a useful first set of pixel tools, but several requested workflows remain either
absent or too fixed for deliberate production work. Repository inspection confirms Pencil,
Mirror pencil, Dither pencil, Eraser, contiguous exact-color Fill, Eyedropper, Line, outlined
Rectangle, outlined Circle/Ellipse, Box/Lasso selection, and Hand tools. Current brushes use only a
square footprint; Fill reads only the active layer and has no tolerance or non-contiguous mode;
shapes are outline-only; and no contour, spray, gradient, or text model exists.

The existing editor already provides the correct mutation boundary to extend: localized pixel
changes are batched into one undo entry, previews render separately from authoritative pixels, and
the active layer/frame remain the mutation target. New behavior must preserve those guarantees,
especially on 1000×1000 and larger projects where per-pointer full-canvas work would regress the
performance improvements already captured in project memory.

## Desired outcome

Artists can choose a brush footprint and size, make clean freehand strokes, erase with the same
footprint controls, preview and commit outlined or filled geometry, draw connected contours, spray
controlled pixel distributions, sample composited color, fill regions using configurable matching
rules, lay down pixel-art gradients, and add text with deliberate raster output. Every completed
gesture is predictable, bounded to the intended frame/layer, independently undoable, responsive on
desktop and touch devices, and visible in tiled/live views through the existing render path.

## User journeys

- An artist selects Pencil or Pixel-perfect Pencil, chooses size and square/circle footprint, draws
  a continuous stroke, and undoes it as one operation.
- An artist chooses a shape, switches between Outline and Filled mode, drags a live preview, then
  commits or cancels without leaving partial pixels.
- An artist places contour vertices, previews the next connected edge, and explicitly closes or
  finishes the contour; Escape/back cancels the pending contour.
- An artist configures spray radius/density/distribution and paints a reproducible-looking scatter
  without freezing a high-resolution canvas.
- An artist fills an active-layer region using a tolerance and contiguous mode, optionally reading
  boundaries from the visible composite while still writing only the active cel.
- An artist drags a linear or radial gradient between primary and secondary colors, optionally
  using an ordered pixel dither pattern, previews it, and commits it as one edit.
- An artist adds text, adjusts its content and typography controls, places it, and can recover from
  unsupported fonts, oversized bounds, cancellation, or project reload according to the text model
  selected during clarification.

## Functional requirements

- FR-1: Preserve current Pencil, Eraser, Line, Rectangle/Ellipse, Eyedropper, and Fill behavior while
  expanding them through shared brush, shape, and fill settings.
- FR-2: Provide square and circle brush footprints with bounded integer sizes for Pencil,
  Pixel-perfect Pencil, and Eraser, with a live cursor footprint.
- FR-3: Pixel-perfect freehand must remove only the redundant diagonal corner pixel produced by the
  active stroke algorithm; it must not simplify intentional isolated details or alter earlier work.
- FR-4: Line thickness must use the selected brush footprint/size and preserve a gap-free discrete
  raster at every slope.
- FR-5: Rectangle and Ellipse tools must support Outline and Filled modes, modifier-key/touch
  affordances for constrained squares/circles where applicable, and non-destructive previews.
- FR-6: Contour must support a sequence of integer canvas vertices, connected-edge preview,
  explicit finish/close, cancellation, and a defined filled/outline relationship.
- FR-7: Spray must expose bounded radius and density plus a defined distribution, avoid unbounded
  work per pointer event, and produce one undo entry per gesture.
- FR-8: Eyedropper must sample the combined visible result at the chosen coordinate and choose the
  primary or secondary color consistently with existing left/right input conventions.
- FR-9: Fill must support tolerance, contiguous/non-contiguous matching, and an optional visible-
  layers boundary source while writing only to the active layer.
- FR-10: Fill matching must define RGBA distance, transparent-pixel behavior, color-mode handling,
  and upper bounds suitable for large canvases.
- FR-11: Gradient must support at least linear and radial geometry between primary and secondary
  colors, a bounded preview, and one undoable commit.
- FR-12: Gradient dithering must use stable ordered patterns anchored to canvas coordinates rather
  than random noise, preserving repeatability across frames and tiled views.
- FR-13: Text must expose content, font, integer size, alignment, spacing, and color, render without
  smoothing into discrete pixels, and follow the persistence/editability decision resolved during
  clarification.
- FR-14: Every new tool/settings surface must support pointer, keyboard, and touch operation,
  accessible names, shortcuts where unambiguous, and compact responsive presentation.
- FR-15: New tool IDs and settings must normalize safely with the device-local customizable toolbox
  and must not invalidate older project or preference records.

## Acceptance criteria

- AC-1: Representative Pencil, Pixel-perfect Pencil, Eraser, and thick Line gestures produce the
  expected exact pixel coordinates and each undo in one step.
- AC-2: Outline/Filled Rectangle and Ellipse previews match their committed pixels and cancel
  without modifying the cel.
- AC-3: Contour finish/close and cancellation behave consistently with mouse, keyboard, and touch.
- AC-4: Spray settings visibly affect radius/density while one continuous gesture remains one undo
  entry and stays responsive on a 1000×1000 canvas.
- AC-5: Fill tolerance boundaries, contiguous/non-contiguous mode, visible-layer reads, active-layer
  writes, transparency, and indexed/grayscale normalization pass deterministic fixtures.
- AC-6: Linear/radial gradients and ordered dither variants match deterministic fixtures, use the
  selected colors, and never introduce smoothed edge pixels through interpolation artifacts.
- AC-7: Text survives the agreed lifecycle and project round-trip, clips safely at canvas bounds,
  uses discrete pixel output, and never silently substitutes a materially different result.
- AC-8: New tools are discoverable through the rail/toolbox editor and usable at desktop, tablet,
  and phone sizes without horizontal overflow or inaccessible hover-only controls.
- AC-9: Existing projects load unchanged, existing tools retain expected shortcuts and undo
  behavior, and exports/live/tiled previews show the authoritative result.

## Edge cases and failure behavior

Empty or unchanged gestures create no history entry. Pointer cancellation, Escape/back, document
switching, layer/frame switching, window blur, and touch interruption cancel previews or explicitly
commit according to one consistent gesture contract. Values outside supported brush, tolerance,
spray, gradient, font, or spacing bounds are clamped or rejected with visible feedback. Operations
clip to canvas bounds and tolerate empty/hidden layers, fully transparent targets, one-pixel shapes,
zero-length gradients, repeated contour points, and malformed persisted settings. Visible-layer
fill must not write through locked/hidden/non-active layers. Indexed mode must not exceed the
256-color limit; grayscale mode must normalize generated colors through the shared resolver.

## Constraints

Core drawing remains offline, guest-accessible, and independent from AI or authentication. New
tools cannot expand native filesystem/network permissions. Text fonts must be distributable or
system-resolved without bundling unlicensed assets, and projects must have explicit behavior when a
font is unavailable. New project data requires a versioned migration and backward-compatible load
path. Hot pointer paths may not clone full projects, deep-react entire pixel arrays, allocate a full
canvas per sample, or scan the full canvas for ordinary localized strokes. Pixel output uses hard
integer coordinates and disabled image smoothing. AI-development documentation remains under
`docs/`.

## Assumptions

- `useEditor.ts` owns authoritative mutations/history, verified from project memory and source.
- `PixelCanvas.vue` owns pointer/touch gesture routing and transient previews, verified from source.
- `utils/raster.ts` is the appropriate pure-algorithm boundary for deterministic raster fixtures.
- The current project schema stores only per-cel pixel arrays; persistent editable text would
  require a new project-data contract rather than a UI-only change.
- The current circle tool already creates an ellipse when dragged non-square despite its label.
- The in-progress `UI-49ZB` toolbox preference normalizes stable `ToolId` values; new optional tools
  must use its migration rule rather than rewriting user order.

## Out of scope

Vector illustration, arbitrary Bézier paths, anti-aliased painting, cloud fonts, online font
downloads, arbitrary brush-import formats, pressure-sensitive opacity, layer effects, and assistant
tool expansion are not implied unless clarification explicitly brings them into scope.

## Clarification record

Repository fact: many named baseline tools already exist. Decision: enhance those canonical tools
instead of adding duplicate rail entries; add separate IDs only for genuinely distinct modes whose
settings and shortcuts must be independently selectable.

Repository fact: the project currently persists pixels, not editable objects. An explicit text
lifecycle decision is required before the schema, history, selection, export, and font fallback
contracts can be finalized.

1. **Challenge:** What lifecycle makes text genuinely editable after placement? **Answer:** Go with
   the recommended live text-layer model. **Decision:** Placing text creates a dedicated live text
   layer that remains editable after reopening; export and explicit Rasterize Text convert it to
   hard pixel output. This keeps ordinary pixel cels clean and makes font fallback, selection,
   history, and schema migration explicit.

2. **Challenge:** Which shape tools share one mode control versus appearing as separate rail items?
   **Answer:** Use the recommendation. **Decision:** Keep Rectangle and Circle/Ellipse as separate
   tools with one shared Outline/Filled mode and shared thickness settings; do not multiply toolbox
   entries or shortcuts.
3. **Challenge:** What exact Pixel-perfect Freehand cleanup rule should apply at joins and stroke
   intersections? **Answer:** Use the recommendation. **Decision:** Remove only redundant single-
   pixel corner stair-step artifacts when the neighboring stroke path proves the pixel is a duplicate;
   preserve intentional isolated pixels and intersections.
4. **Challenge:** Which spray distributions and deterministic/repeatable behavior are required?
   **Answer:** Use the recommendation. **Decision:** Ship deterministic seeded uniform scatter by
   default, plus Gaussian/center-weighted and edge-preserving distributions; replaying the same
   gesture uses the same seed for stable previews, undo, and tests.
5. **Challenge:** Which color-distance model and tolerance scale should Fill use? **Answer:** Use the
   recommendation. **Decision:** Use RGBA-aware weighted color distance with a 0–255 tolerance,
   4-way contiguous matching by default, optional 8-way connectivity, and non-contiguous all-
   matching-pixels mode.
6. **Challenge:** What area/selection masking contract applies to gradient and text placement?
   **Answer:** Use the recommendation. **Decision:** An active selection clips gradients and
   rasterized text; without one, operations clip to the canvas. Text starts at the clicked anchor and
   never writes outside canvas bounds.
7. **Challenge:** Which bundled/system pixel fonts are supported, and what happens when a font is
   missing? **Answer:** Use the recommendation. **Decision:** Bundle OFL-licensed Pixelify Sans and
   Silkscreen, permit installed system fonts, and show a warning while falling back to a bundled
   pixel font when a selected font is unavailable.
8. **Challenge:** What brush-size and computational ceilings define performance acceptance? **Answer:**
   Use the recommendation. **Decision:** 1000×1000 remains interactive during brush/shape preview
   without full-project cloning per pointer event; localized strokes target a 16 ms frame budget,
   full-canvas fill/gradient commits may use a worker or bounded batch up to 100 ms, brush size is
   capped at 64, and spray radius at 64.

## Dependencies

`UI-49ZB` is an advisory unfinished dependency because it owns toolbox preference normalization and
the UI used to arrange or hide new tools. Its current migration contract is sufficient to design
new stable IDs independently, but overlapping files may require sequencing before implementation.
Completed selection, tiled-canvas, and centralized-view specs establish reusable history, preview,
and input boundaries rather than blocking dependencies.

## Open questions

None. The clarification tree is ready for explicit confirmation before finalization.
