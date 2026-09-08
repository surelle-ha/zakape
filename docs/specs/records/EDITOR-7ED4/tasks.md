# EDITOR-7ED4 tasks

- [x] T01 — Add pure selection regressions for colored-only capture/apply, transparent destination preservation, overlapping moves, clipping, empty masks, and unchanged results. (AC-2, AC-3, AC-4, AC-8)
- [x] T02 — Implement reusable selection mutation helpers and integrate move so the full rectangle/lasso mask translates while only colored source/destination samples mutate pixels. (AC-2, AC-3, AC-4)
- [x] T03 — Integrate the same alpha-safe boundary into resize and rotation without changing nearest-neighbor geometry, mask bounds, handles, rotation center, or one-step history. (AC-3, AC-4, AC-8)
- [x] T04 — Add project/palette unit contracts for omitted defaults, explicit empty arrays, greyscale normalization, indexed first-use growth/deduplication, and 256-color nearest fallback. (AC-5, AC-7, AC-9)
- [x] T05 — Implement the shared palette creation/color-resolution contract in project, editor drawing, and assistant operations while preserving version-1 persistence compatibility. (AC-5, AC-7, AC-9)
- [x] T06 — Update the new-project launcher with an accessible Skip card, empty-capable Custom path, removable final swatch, accurate zero-color summary, and no native browser color input. (AC-5, AC-6, AC-7, AC-9)
- [x] T07 — Add a compact canvas-strip empty-palette hint and verify tools remain usable before indexed colors are first registered. (AC-5, AC-7, AC-9)
- [x] T08 [P] — Remove decorative grid nodes and grid-image CSS from splash, authentication, Home, and the Home brand-art panel while retaining dark neutral fills, non-grid lighting, foreground hierarchy, motion, and reduced-motion behavior. (AC-1)
- [x] T09 — Extend desktop Playwright journeys for preset/empty Custom/Skip creation, indexed palette growth, rectangle/lasso move/resize/rotate transparency safety, overlap/clipping, and single-step undo/redo. (AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9)
- [x] T10 [P] — Extend phone/tablet Playwright coverage for grid-free entry surfaces, launcher choice containment, touch targets, scrolling, empty-palette hints, and reviewed snapshots. (AC-1, AC-5, AC-7, AC-9)
- [x] T11 — Update `docs/qa.md`, reviewed UI snapshots, and durable project memory for the confirmed selection geometry/pixel-mutation boundary. (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9)
- [x] T12 — Run studio lint, typecheck, unit tests, production build, focused/full Playwright and visual review, changed-file formatting, spec validation, and Git diff checks; record exact evidence before completion. (AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9)
