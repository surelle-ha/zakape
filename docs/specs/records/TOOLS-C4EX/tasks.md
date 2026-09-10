# TOOLS-C4EX tasks

Tasks are dependency-ordered and independently verifiable. `[P]` means the task is parallel-safe
after its prerequisite contract is merged.

- [x] T01 — Freeze tool/options and live-text schema contracts; document v1→v2 normalization and
      confirm `UI-49ZB` stable-ID compatibility. (AC-7, AC-8, AC-9)
- [x] T02 [P] — Add pure brush footprints, pixel-perfect cleanup, thick-line expansion, filled
      ellipse, and contour rasterizers with deterministic unit fixtures. (AC-1, AC-2, AC-3)
- [x] T03 [P] — Add seeded spray distributions and bounded spray parameter normalization with
      deterministic unit fixtures. (AC-4)
- [x] T04 [P] — Add RGBA-aware distance, contiguous/non-contiguous flood-fill planning, visible
      composite read support, connectivity, and selection clipping helpers. (AC-5)
- [x] T05 [P] — Add linear/radial gradient sampling and ordered dither patterns anchored to integer
      canvas coordinates. (AC-6)
- [x] T06 [P] — Extend project/type contracts with live text-layer metadata, default normalization,
      migration, and safe malformed-record handling. (AC-7, AC-9)
- [x] T07 — Extend render/export compositing with cached hard-edged text rasterization and one shared
      preview/export path; add missing-font fallback diagnostics. (AC-6, AC-7, AC-9)
- [x] T08 — Add editor mutation methods and history entries for brush shape modes, pixel-perfect
      cleanup, spray, fill options, gradients, contour, and text create/edit/rasterize. (AC-1–AC-7,
      AC-9)
- [x] T09 — Refactor PixelCanvas gesture routing into preview/commit/cancel states for all new tools,
      secondary-color input, selection masks, touch/keyboard cancellation, and tiled source mapping.
      (AC-1–AC-8)
- [x] T10 — Add tool definitions, shortcuts, toolbox migration, and compact responsive contextual
      controls for brush, shape, fill, spray, gradient, contour, and text. (AC-1, AC-8, AC-9)
- [ ] T11 — Add focused unit and Playwright regression coverage for algorithms, history, migrations,
      accessibility, touch, desktop, high-resolution interaction, tiled/live previews, and exports.
      (AC-1–AC-9)
- [ ] T12 — Profile 1000×1000 interactions, optimize hot paths, and add a bounded worker fallback only
      where measurements exceed the agreed budget. (AC-4, AC-5, AC-6, AC-9)
- [x] T13 — Update `docs/ai/`, project memory, user-facing tool documentation, and QA evidence with
      pixel-art constraints, font provenance, migration notes, and performance results. (AC-7, AC-8,
      AC-9)
- [ ] T14 — Run full validation, record evidence, finalize the spec, and prepare the feature branch/PR.
      (AC-1–AC-9)
