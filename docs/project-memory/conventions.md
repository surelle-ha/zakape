# Durable development conventions

- Use random area-prefixed spec IDs such as `UI-K7M2`; never infer priority or sequence from the suffix.
- Use Vue composition APIs and explicit TypeScript types. Keep pure transformations in utilities.
- Keep mutations behind the owning composable and preserve independent layer/frame ownership.
- Batch canvas paints; avoid deep reactive pixel structures and full snapshots for localized strokes.
- Use semantic controls, accessible names, visible focus, reduced-motion behavior, and touch-sized mobile controls.
- Keep neutral charcoal surfaces with violet reserved for active, focus, selection, and primary-action accents.
- Keep AI development documentation under `docs/ai/`; specification records and cross-agent memory live under `docs/specs/` and `docs/project-memory/`.
- Use Conventional Commits and preserve unrelated user changes.
