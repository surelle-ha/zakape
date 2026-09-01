# Zakape

Zakape is an open-source pixel-art and sprite-animation workbench for the desktop. It keeps the dependable parts of a traditional sprite editor: precise tools, layers, frames, onion skinning, palettes, and production exports. An optional model assistant proposes reviewable pixel operations through local Ollama or a compatible API you choose.

The desktop app is built with Tauri 2, Rust, Nuxt, Vue, Tailwind CSS, Lucide, and PGlite. The public website is a separate Nuxt app in the same pnpm workspace.

## Project status

Zakape is in early alpha. The current milestone focuses on a reliable editor loop and a safe, local-first assisted workflow. Project files use the open JSON-based `.zakape` format.

## Quick start

Prerequisites: Node.js 22+, pnpm 10+, Rust stable, and the [Tauri 2 platform prerequisites](https://v2.tauri.app/start/prerequisites/).

```bash
pnpm install
pnpm dev
```

Useful commands:

```bash
pnpm dev:site       # public website
pnpm check          # lint, type checks, and tests
pnpm test:e2e       # studio interaction and snapshot tests
pnpm build          # static web builds
pnpm build:desktop  # native Tauri bundle
```

## Repository map

```text
apps/studio/        Nuxt sprite editor and Tauri shell
apps/site/          Public project website
docs/               Architecture, AI, release, and QA notes
.github/             CI, release, Pages, and contribution workflows
```

## Principles

- The pixel editor remains complete and usable without any AI connection.
- Your model credentials stay on your device and are never committed.
- Model output is parsed into a small, validated edit language and previewed before application.
- Exports are ordinary files: PNG, sprite-sheet PNG + JSON, GIF, and `.zakape` project JSON.
- Visual quality and keyboard accessibility are tested as product behavior, not treated as polish debt.

Before making a large change, read the [architecture](docs/architecture.md) and [contribution guide](CONTRIBUTING.md). The [project workspace](docs/project-workspace.md), [model assistant guide](docs/ai/model-assistant.md), and [release process](docs/release.md) cover their respective workflows.

## License

[MIT](LICENSE).
