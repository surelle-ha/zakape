# Drawing tools and assistant boundaries

Zakape's drawing tools are deterministic, local operations. AI may suggest pixels, palettes,
frames, or layers, but it does not bypass the editor mutation boundary. Every suggestion is previewed
and applied as one undoable operation.

## Tool behavior

- Pencil and eraser use square or circular footprints from 1–64 pixels. Pixel-perfect mode removes
  only redundant single-pixel stair-step corners and can be disabled.
- Line, rectangle, and circle/ellipse show a live integer preview. Rectangle and ellipse share outline
  and filled modes; brush size controls outline thickness.
- Contour accepts successive clicks and commits on double-click. Spray uses a bounded radius and
  density with deterministic uniform, centre-weighted, or edge distributions.
- Fill supports 0–255 weighted color tolerance, 4- or 8-way connectivity, non-contiguous matching,
  and reading visible layers while writing only the active layer. A selection clips the operation.
- Gradients are linear or radial and use ordered dither patterns when selected. They are clipped to
  the active selection or canvas.
- Text is a live, editable layer. It is rasterized with a hard alpha threshold for previews and
  exports; reopening a project preserves its metadata. Installed fonts are allowed, with bundled
  pixel-font fallbacks for missing families.

All coordinates are integer pixel coordinates and image smoothing is disabled. Large canvases reuse
buffers and localized strokes use pixel-delta history instead of cloning the full project per event.
