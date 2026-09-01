# Contributing to Zakape

Thanks for helping build Zakape. Keep changes small enough to review and include tests for behavior that can regress.

## Development

1. Install Node.js 22+, pnpm 10+, Rust stable, and Tauri 2 prerequisites.
2. Run `pnpm install`.
3. Run `pnpm dev` for the editor or `pnpm dev:site` for the website.
4. Before opening a pull request, run `pnpm check` and `pnpm build`.

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
