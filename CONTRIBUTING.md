# Contributing to Zakape

Thanks for helping build Zakape. Keep changes small enough to review and include tests for behavior that can regress.

## Development

1. Install the Node.js and Rust versions pinned by `.node-version` and `rust-toolchain.toml`, pnpm 10.17.1, and the Tauri 2 prerequisites.
2. Run `pnpm install`.
3. Run `pnpm spec resume` to discover pending specifications and durable project context.
4. Run `pnpm dev` for the editor or `pnpm dev:site` for the website.
5. Before opening a pull request, run `pnpm check` and `pnpm build`.

Rust changes also need:

```bash
cargo fmt --manifest-path apps/studio/src-tauri/Cargo.toml --check
cargo clippy --manifest-path apps/studio/src-tauri/Cargo.toml --all-targets -- -D warnings
```

## Pull requests

- Explain the user problem and the chosen interaction.
- Use Conventional Commit titles: `fix:` for patches, `feat:` for minor releases, and `feat!:` or a `BREAKING CHANGE:` footer for major releases.
- Attach before/after screenshots for UI changes.
- Update files under `docs/` for architecture, provider, data-format, or AI behavior changes.
- Do not commit API keys, model responses containing private art, generated build artifacts, or telemetry dumps.
- Keep keyboard shortcuts discoverable and avoid icon-only controls without accessible names.

## AI-assisted contributions

AI tools may be used, but contributors remain responsible for licensing, security, accessibility, tests, and the accuracy of every submitted line. Development notes about model integrations and AI behavior belong in `docs/`.

## Dependency-aware specifications

Substantial features and cross-cutting changes use repository-native records under `docs/specs/`. IDs such as `AUTH-K7M2` are random, stable identifiers—not sequence numbers. Anyone can select a viable pending spec directly; the workflow never assumes the newest record is current.

```bash
pnpm spec resume
pnpm spec inspect AUTH-K7M2
pnpm spec dependencies AUTH-K7M2
pnpm spec validate AUTH-K7M2
```

Use `specify` to create and rigorously clarify a request, `plan` to produce the implementation plan and actionable tasks together, and `implement` to enter dependency-gated delivery. Unfinished critical dependencies block by default; explicit overrides require a recorded reason. See [`docs/specs/README.md`](docs/specs/README.md) for the full command reference and `docs/project-memory/` for durable architecture and decision context.
