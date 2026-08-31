# Aseprite and Piskel product research

Research date: 31 August 2026. Sources are the projects' official sites, documentation, and source repositories.

## What Aseprite establishes

Aseprite treats a sprite as a matrix of cels: layers on one axis and frames on the other. Its timeline supports moving and copying layers, frames, and cels; frame tags define loop sections; and onion skinning makes adjacent frames visible as drawing references. Its drawing model includes customizable keyboard shortcuts, temporary tools (for example, hold Space to pan and Alt for the eyedropper), palette and alpha control, pixel-perfect strokes, custom/dither brushes, tiled drawing, shading ink, blend modes, and pixel-aware rotation.

Its production output is broader than “save a picture”: PNG sequences, animated GIF, sprite sheets, JSON metadata, texture atlases, recovery, and CLI automation. Sprite-sheet export can target visible or selected layers and tagged frame ranges.

Sources:

- [Aseprite features](https://www.aseprite.org/)
- [Aseprite documentation index](https://www.aseprite.org/docs/)
- [Timeline](https://www.aseprite.org/docs/timeline/)
- [Keyboard shortcuts and temporary tools](https://www.aseprite.org/docs/keyboard-shortcuts/)
- [Sprite-sheet import/export](https://www.aseprite.org/docs/sprite-sheet/)

## What Piskel establishes

Piskel prioritizes immediate browser use: a new sprite opens directly into a focused editor with a live preview. Its current source exposes pen sizes from 1–4 pixels, pen and mirror pen, bucket, eraser, line, rectangle, circle, move, shape selection, lighten, dithering, and color picker tools. The editor includes frame and layer lists, per-layer opacity, palettes and GPL palette exchange, transforms, grid and tiled previews, onion skinning, configurable shortcuts, local backup, and adjustable FPS.

Piskel exports animated GIF, PNG/sprite sheet, ZIP frame sequences, and data URIs; it imports still images, animated GIFs, and `.piskel` files. Its README confirms a web-first JavaScript/HTML/CSS implementation, offline builds, Playwright end-to-end coverage, and no mobile support.

Sources:

- [Piskel website](https://www.piskelapp.com/)
- [Piskel source and README](https://github.com/piskelapp/piskel)
- [Piskel export templates](https://github.com/piskelapp/piskel/tree/master/src/templates/settings/export)
- [Piskel tool shortcuts](https://github.com/piskelapp/piskel/blob/master/src/js/service/keyboard/Shortcuts.js)

## Product decision for Zakape

Zakape will not reproduce either interface or codebase. The first release combines four ideas:

| Area      | Zakape direction                                                                                                   |
| --------- | ------------------------------------------------------------------------------------------------------------------ |
| Drawing   | Crisp nearest-neighbor canvas; pencil, eraser, fill, picker, line, rectangle, zoom, grid, palette, undo/redo       |
| Structure | Layers × frames data model, frame durations, duplicate/add/delete, opacity/visibility, onion skin                  |
| Output    | `.zakape` JSON, current-frame PNG, PNG + JSON sprite sheet, and animated GIF                                       |
| Assistant | Optional OpenAI-compatible connection that returns validated, previewable operations rather than unrestricted code |

The interaction should feel like a compact workshop: dense enough for repeated use, calmer than a dashboard, with keyboard access and labels/tooltips wherever icon meaning is ambiguous.

## Explicit first-release boundaries

Tilemaps, scripting/plugins, advanced blend modes, indexed-color profiles, vector text, and Aseprite file compatibility are not claimed for the first alpha. They remain roadmap items so the foundation can be tested before the surface area expands.

## Licensing note

Aseprite's source has project-specific licensing terms; Piskel is Apache-2.0. Zakape uses original code and an MIT license. Researching workflows does not grant permission to reuse product artwork, trademarks, or non-compatible source.
