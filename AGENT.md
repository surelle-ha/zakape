# Zakape development guide for coding agents

This file is the authoritative repository guide for automated coding assistants and human contributors working with them. Read it before changing code, documentation, build configuration, generated assets, or release automation.

## Product mission

Zakape is an open-source pixel-art and sprite-animation studio for desktop, phone, and tablet. The drawing experience is the product. Model assistance is optional and must strengthen the artist's control rather than replace it.

The application should remain:

- Useful without an account, network connection, or model connection.
- Precise and responsive on large pixel canvases and long animation timelines.
- Predictable about persistence, undo, export, and destructive operations.
- Native in behavior: no browser page zoom, accidental text selection, irrelevant browser shortcuts, or default browser context menus.
- Reviewable: model-generated edits are validated, previewed, and reversible.

## Non-negotiable product rules

1. Never make core drawing, animation, project, or export features depend on AI.
2. Keep credentials and model configuration on the user's device. Never commit secrets or log model keys.
3. Treat model output as untrusted input. Parse it through the bounded edit protocol, validate coordinates and limits, preview the result, and make application one undoable operation.
4. Preserve independent frame and layer state. A new layer starts blank; visibility, opacity, names, and pixels must not alias another layer.
5. Preserve pixel fidelity. Use nearest-neighbor rendering and avoid transforms that blur or invent subpixels.
6. Keep mobile and tablet controls touch-sized while protecting canvas space. Desktop-only chrome, shortcut labels, and the status footer must stay hidden on touch layouts.
7. Keep all AI-related development documentation inside `docs/`, preferably `docs/ai/`. Do not add AI planning notes or generated reports to the repository root.

## Repository map

```text
apps/studio/                 Editor UI and native application shell
  app/components/            Reusable editor and shell components
  app/composables/           Editor state, persistence, assistant, updater, and window behavior
  app/utils/                 Project schema, imports, palettes, and pure helpers
  app/assets/css/main.css    Shared application design system and responsive layout
  src-tauri/src/lib.rs       Native commands, local workspace access, import, and Ollama proxy
  src-tauri/icons/           Generated native icon sets
  src-tauri/gen/android/     Committed Android Gradle project and resources
  tests/unit/                Fast logic and state regressions
  tests/e2e/                 Interaction, responsive, and visual snapshot coverage
apps/site/                   Public project website
assets/brand/                Canonical and generated brand artwork
docs/                        Architecture, AI, platform, release, research, and QA documentation
fastlane/metadata/android/   F-Droid and Android listing metadata and imagery
scripts/                     Reproducible build, verification, and asset-generation utilities
.github/workflows/           CI, desktop release, Android, and website deployment
```

## Source-of-truth files

- Project shape and validation: `apps/studio/app/utils/project.ts`.
- Central editor behavior: `apps/studio/app/composables/useEditor.ts`.
- Local workspace persistence: `apps/studio/app/composables/useProjectRepository.ts`.
- Model protocol and session behavior: `apps/studio/app/composables/useAiAssistant.ts`.
- Native commands and filesystem limits: `apps/studio/src-tauri/src/lib.rs`.
- App-wide visual tokens and breakpoints: `apps/studio/app/assets/css/main.css`.
- Native bundle configuration: `apps/studio/src-tauri/tauri.conf.json`.
- Android build and release behavior: `.github/workflows/android.yml` and `docs/android.md`.
- Release versioning: `release-please-config.json`, `.release-please-manifest.json`, and `docs/release.md`.

When two implementations disagree, consolidate behavior around these sources instead of introducing another copy.

## Local setup

Use the pinned versions in `.node-version` and `rust-toolchain.toml` with pnpm 10.17.1. Install platform prerequisites from the Tauri documentation before native builds.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Common commands:

```bash
pnpm dev:site
pnpm check
pnpm format:check
pnpm test:e2e
pnpm build
pnpm build:desktop
pnpm build:android:debug
pnpm build:android:fdroid
pnpm build:android:bundle
```

## Implementation conventions

- Use Vue composition APIs and explicit TypeScript types. Keep pure project transformations in utilities so they can be unit tested without mounting UI.
- Keep editor state mutations behind composable actions. Do not mutate unrelated refs from a component to bypass an existing workflow.
- Use stable IDs for projects, frames, and layers. Clone pixel buffers only where ownership changes.
- For drawing paths, avoid deep watchers, per-pixel reactive allocations, full-project snapshots, and canvas dimension resets. Batch visual paints with `requestAnimationFrame`.
- Use pixel-delta history for strokes and other localized edits. Reserve full snapshots for structural changes that actually require them.
- Use semantic HTML, accessible names, visible keyboard focus, and reduced-motion fallbacks.
- Use Lucide icons already available in the workspace. Do not substitute emoji or one-off icon glyphs.
- Extend the existing CSS token system. Dark neutral surfaces are the base; violet is an accent for focus, selection, state, and primary actions.
- Maintain custom scrolling behavior and prevent browser-native selection, page zoom, and context menus in the application shell.
- Do not hide failures. Present a useful recovery action and preserve unsaved work whenever possible.

## Responsive behavior

Zakape uses three practical layout bands:

- Phone: up to 640 CSS pixels.
- Tablet and compact/touch layouts: 641–1023 CSS pixels.
- Desktop: 1024 CSS pixels and above.

Test both portrait and landscape where a change affects fixed panels, drawers, timeline height, safe areas, or the canvas. Phone and tablet layouts place document tabs at the bottom, omit the desktop title and status bars, hide physical-keyboard hints on coarse pointers, and use sheet-style drawers where appropriate.

Browser-level pinch zoom must remain disabled in the native app. Canvas zoom is an editor operation and must stay bounded, centered predictably, and independent from scaling the application UI.

## Persistence and file safety

- Native projects live under the documented `Documents/zakape` workspace.
- The browser fallback uses local persistence and must remain usable for tests and the web preview.
- Keep `.zakape` readable and validated. Treat imported files as hostile until size, shape, dimensions, frame counts, and layer counts pass validation.
- Do not overwrite user files without an explicit save/export action.
- Closing a project or the application must run through the confirmation and save workflow.
- Preserve forward-compatible fields when practical, but reject malformed or over-limit payloads clearly.

## Model-assistant safety

- Ollama access is restricted to loopback addresses. Hosted endpoints require an explicit user-provided configuration.
- The assistant may propose pixels, palettes, frames, and layers only through supported operations.
- Preserve edit scope: selection, current frame, entire sheet, and other scopes must be visible before generation and confirmation.
- Let the agent inspect its rendered draft and refine within bounded iteration limits, then show the artist a preview instead of applying an invisible mutation.
- Persist conversation history locally without persisting secret keys.
- Document protocol changes, model instructions, privacy implications, and limitations under `docs/ai/`.

## Brand and icon workflow

Canonical artwork lives in `assets/brand/`. After changing the supplied source images, regenerate derived assets:

```bash
python scripts/generate_brand_assets.py
pnpm --filter @zakape/studio tauri icon ../../assets/brand/icon-manifest.json
```

The app icon uses a generated safe-area composition so desktop and mobile masks do not crop the artwork. Keep `src-tauri/icons/android/` and `src-tauri/gen/android/app/src/main/res/` synchronized when icon generation changes Android resources. Review at least the desktop 512 px icon, the Android legacy icon, and the Android adaptive foreground.

## Testing and visual QA

Every change should receive checks proportional to its risk. The normal pre-push baseline is:

```bash
pnpm check
pnpm format:check
pnpm build
pnpm test:e2e
cargo fmt --manifest-path apps/studio/src-tauri/Cargo.toml --check
cargo clippy --manifest-path apps/studio/src-tauri/Cargo.toml --all-targets -- -D warnings
```

For UI work:

1. Test the affected behavior directly.
2. Capture desktop, phone, and tablet screenshots when responsive behavior is involved.
3. Inspect screenshots at full size for clipping, excess whitespace, incorrect stacking, stale colors, unreadable labels, and platform chrome leaks.
4. Update Playwright reference snapshots only when the visual change is intentional:

```bash
pnpm --filter @zakape/studio exec playwright test --update-snapshots
```

5. Record meaningful product snapshots under `docs/ui-snapshots/`; keep temporary reports under `test-results/`.

Add a regression test when fixing a bug. Performance fixes should include a representative canvas-size or interaction benchmark instead of relying only on subjective feel.

## Documentation

- Update documentation in the same change as behavior or workflow changes.
- Use plain language focused on what artists can do, what data leaves the device, and how contributors reproduce a result.
- Keep the README concise. Put detailed architecture, AI, QA, platform, and release material in `docs/`.
- Do not mention competing products in public documentation.
- Keep screenshots current with the UI and avoid mock content where an authentic product state can be shown.

## Android, F-Droid, and releases

- F-Droid builds must work without signing secrets, analytics, proprietary services, or prebuilt application artifacts.
- Keep the Gradle wrapper version and `distributionSha256Sum` aligned.
- Keep Fastlane descriptions, changelogs, screenshots, icon, and feature graphic current.
- The debug/testing APK and the signed Play bundle are separate pipelines. Never commit a keystore or signing password.
- Every tagged release must attach the expected desktop packages and Android APK. Signed bundles run only when the required repository secrets exist.
- Use Release Please for versions and changelogs; do not manually create conflicting release tags.
- Verify updater manifests and signatures before changing updater endpoints or keys.

## Git and change hygiene

- Preserve unrelated user changes and untracked files. Never reset or discard them to make a patch clean.
- Use Conventional Commit messages enforced by commitlint and Husky.
- Keep commits focused and include generated files only when their source or build output intentionally changed.
- Do not commit `.secrets/`, signing material, local databases, Playwright reports, or temporary build outputs.
- Before pushing, inspect `git diff --check`, `git status`, and the staged diff.

## Definition of done

A task is complete when the requested behavior works on its intended platforms, relevant regressions are covered, documentation matches reality, visual changes have been reviewed from screenshots, generated artifacts are synchronized, and CI-equivalent checks pass. If a platform cannot be exercised locally, document the exact limitation and verify it in the corresponding GitHub workflow.
