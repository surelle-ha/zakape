# HELP-JYZY implementation plan

## Codebase and history evidence

- `apps/studio/app/components/ApplicationMenu.vue` owns one computed File/Edit/View/Help command model and renders it as both the desktop title-bar menus and the phone/tablet accordion. Its `execute` path already closes both presentations before running a command. Help currently ends with Account, Check for updates, and About; Keyboard shortcuts is already marked `desktopOnly` and uses the established `?` mapping.
- `apps/studio/app/components/AppTitleBar.vue`, `apps/studio/app/components/DocumentTabs.vue`, and `apps/studio/app/app.vue` show that the shared menu is available from Home and Editor, while `app.vue` is the single stable mount point for an application-wide notice. Mounting feedback inside `ApplicationMenu` would render duplicate notice instances because both desktop and touch menu hosts exist in the component tree.
- `apps/studio/app/pages/index.vue` contains the duplicate `Keyboard` import and `keyboard-shortcut-launch` app-bar button beside Save. `apps/studio/app/utils/commands.ts` and the page-level key handler remain the source for the `?` shortcut, so removing only the app-bar launcher will not remove keyboard access.
- `apps/studio/app/composables/useAppUpdater.ts` obtains the packaged version with `@tauri-apps/api/app.getVersion()` and initializes it from `runtimeConfig.public.appVersion` in browser QA. The new diagnostic composable can reuse `currentVersion` instead of creating another version source.
- `apps/studio/nuxt.config.ts` currently injects only the package version. `.github/workflows/release.yml`, `.github/workflows/android.yml`, and `.github/workflows/macos-unsigned.yml` expose distinct stable, debug/testing, and unnotarized build paths. They need explicit channel/build-type metadata, while the config needs deterministic `ZAKAPE_BUILD_SHA`, `GITHUB_SHA`, checked-out Git SHA, and development fallbacks.
- `apps/studio/src-tauri/src/lib.rs` registers plugins in one builder for all platforms and guards updater/process/single-instance behavior for desktop. `apps/studio/src-tauri/capabilities/default.json` is the main-window capability; it currently grants no OS, opener, shell, or clipboard access. The optional desktop Google flow uses the `open` crate internally and does not provide a reusable or mobile-capable frontend URL contract.
- The current Tauri v2 plugin contracts were checked against the pinned ecosystem: `@tauri-apps/plugin-os` provides `platform()`, `version()`, `arch()`, and async `locale()` on desktop and mobile; `@tauri-apps/plugin-opener` provides `openUrl()` on desktop and mobile with URL scopes; `@tauri-apps/plugin-clipboard-manager` provides `writeText()` on all target platforms. Their capability identifiers allow the plan to grant only four OS reads, `opener:allow-open-url` with exact fixed patterns, and `clipboard-manager:allow-write-text`. No default opener set, hostname, clipboard read, path opening, reveal, or shell permission is required.
- `apps/studio/tests/e2e/studio.spec.ts` already covers desktop Help and the `?` shortcut; `responsive.spec.ts` covers the touch menu, 42-pixel items, viewport containment, and hidden keyboard-only controls. `tests/unit/updater.test.ts` demonstrates dynamic-plugin mocks and Nuxt `useState` stubs suitable for the new composables.
- `docs/privacy.md`, `docs/project-workspace.md`, and `docs/qa.md` are the current user/privacy, command-workflow, and QA contracts. Commit `d760017` centralized the View and Help surfaces in `ApplicationMenu.vue`; commit `606b558` established runtime version injection and the app-wide updater/notice visual language; commit `1d82baa` established the Android/Tauri capability and responsive test paths.

## Proposed approach

1. Add pure diagnostic and build-metadata helpers. `app/utils/systemInfo.ts` will define the approved field shape, normalize missing values to `Unavailable`, reduce a user agent to a generic WebView/browser engine label, and format one stable plain-text block. `build/metadata.ts` will resolve and normalize short Git SHA, release channel, and build type at Nuxt build time without shipping Node or Git access in the application bundle.
2. Add one `useSystemInfo` orchestration composable. It will reuse updater `currentVersion`, read public build metadata, obtain native OS data through dynamically imported Tauri OS bindings, and use conservative `navigator` fallbacks for browser preview. It will never request hostname or high-entropy identifiers and will pass only the approved normalized values to the pure formatter.
3. Keep copying and link opening behind explicit Help actions. Copy will try `navigator.clipboard.writeText` first and use the write-only Tauri clipboard plugin as the packaged fallback. External actions will select one of three compile-time URL constants, use Tauri `openUrl` in packaged desktop/Android builds, and otherwise use a `_blank` browser context with `noopener,noreferrer`. Browser-offline, popup-blocked, plugin, and permission failures become retryable notices rather than navigation or alerts.
4. Add one application-scoped `useActionNotice` state and `ActionNotice.vue`, mounted once in `app.vue`. A new action replaces the current notice and timer, success auto-dismisses and may be dismissed manually, and failure remains non-blocking with Retry and dismiss. The component uses `role="status"` for success, `role="alert"` for failure, visible focus, reduced-motion-safe transitions, and safe-area-aware phone/tablet placement without moving editor focus.
5. Extend the shared Help command array in this order: Quick tour and desktop Keyboard shortcuts; separator; Copy System Info, Report a Bug, Suggest a Feature; existing Account, updater, and About commands; separator; Support Zakape Development. Use Lucide icons already present in the dependency. Remove only the duplicate app-bar Keyboard button/import/style hook, retaining the Help entry and `?` handler.
6. Register the three narrow Tauri plugins, add their JS/Rust dependencies, declare only explicit capabilities, and regenerate committed Tauri capability schemas. Inject honest metadata in stable desktop, released Android debug APK, generic Android CI/Play, and unsigned macOS workflows.
7. Add unit, end-to-end, accessibility, failure/retry, responsive, and visual coverage, then document the local-only diagnostic behavior and Help routes.

## Architecture and data flow

```text
ApplicationMenu command
  -> useSystemInfo.copySystemInfo()
       -> useAppUpdater.currentVersion
       -> public build metadata
       -> Tauri OS plugin (native) or conservative navigator fallback (browser)
       -> pure normalize/format helper
       -> navigator clipboard, then write-only Tauri fallback
       -> shared useActionNotice success/error state

ApplicationMenu external command
  -> fixed destination key (bug | feature | support)
       -> compile-time URL map
       -> scoped Tauri opener (native) or noopener browser tab (preview)
       -> shared useActionNotice only on failure

app.vue
  -> exactly one ActionNotice renderer for Home and Editor
```

`ApplicationMenu.vue` remains the command and presentation owner; neither Home nor the editor receives duplicate command implementations. `useSystemInfo.ts` owns orchestration and platform fallbacks but no editor state. `systemInfo.ts` owns deterministic formatting and parsing and cannot invoke native APIs. `useActionNotice.ts` owns ephemeral feedback only and does not persist or mutate projects.

The Tauri OS, opener, and clipboard plugins are capability-checked native boundaries. OS access is limited to platform, version, architecture, and locale. Opener input is selected from constants and independently constrained by exact escaped capability patterns. Clipboard access is write-only. No frontend-controlled URL, shell process, arbitrary path, hostname, clipboard read, upload, logging, or network-diagnostic command crosses the boundary.

Collection is lazy: Zakape gathers and copies diagnostics only after the user activates Copy System Info. Optional field failures degrade to `Unavailable`; only a failure to produce/write the block triggers the retry state. `execute()` closes the menu once, and the retry closure repeats the failed action directly without reopening or stacking menus. The notice store invalidates the prior auto-dismiss timer before publishing another notice, preventing duplicate stacks or stale timer dismissal.

The formatted contract is labelled and ordered: `Zakape version`, `Build`, `Release`, `Operating system`, `Architecture`, `Locale`, and `Rendering engine`. `Release` combines channel and build type (for example `stable · release`, `stable · debug`, `testing · unnotarized`, or `development · development`) so debug testing artifacts remain honest. The engine parser may inspect the current user agent transiently but returns only a generic engine/product family and major version; it never retains or copies the raw value.

## Affected files

- `apps/studio/app/components/ApplicationMenu.vue` — add the four shared Help commands, fixed command ordering/separators, and system-info/link action wiring.
- `apps/studio/app/pages/index.vue` — remove the duplicate app-bar Keyboard shortcuts launcher and unused `Keyboard` import while keeping the `?` shortcut path.
- `apps/studio/app/app.vue` — mount one global action-notice renderer outside authenticated page content.
- `apps/studio/app/components/ActionNotice.vue` (new) — render accessible success/error, Retry, and dismiss controls.
- `apps/studio/app/composables/useActionNotice.ts` (new) — own replace-in-place transient notice state and timer cleanup.
- `apps/studio/app/composables/useSystemInfo.ts` (new) — collect approved fields, copy once per invocation, safely open fixed destinations, and publish recovery feedback.
- `apps/studio/app/utils/systemInfo.ts` (new) — define types/constants and pure normalization, engine detection, and formatting functions.
- `apps/studio/build/metadata.ts` (new) — resolve sanitized build SHA, channel, and build type from explicit environment, GitHub environment, checked-out Git, or documented fallbacks.
- `apps/studio/nuxt.config.ts` — expose the resolved non-secret build metadata through public runtime config.
- `apps/studio/app/assets/css/main.css` — style the compact notice, actions, desktop/touch Help separation, safe areas, focus states, and reduced-motion behavior; remove obsolete shortcut-launch selector residue.
- `apps/studio/package.json` and `pnpm-lock.yaml` — add matching Tauri OS, opener, and clipboard JavaScript bindings.
- `apps/studio/src-tauri/Cargo.toml` and `apps/studio/src-tauri/Cargo.lock` — add matching cross-platform Tauri plugin crates.
- `apps/studio/src-tauri/src/lib.rs` — register OS, opener, and clipboard plugins without a shell command or custom diagnostic payload.
- `apps/studio/src-tauri/capabilities/default.json` — allow only platform/version/architecture/locale reads, write-text clipboard access, and three exact external URL patterns.
- `apps/studio/src-tauri/gen/schemas/acl-manifests.json`, `capabilities.json`, `desktop-schema.json`, `windows-schema.json`, `mobile-schema.json`, and `android-schema.json` — regenerate committed capability metadata after plugin registration and permission changes.
- `.github/workflows/release.yml` — label checked-out stable desktop builds as release and the attached Android APK as debug while injecting the resolved build commit.
- `.github/workflows/android.yml` — label branch/PR APKs and signed Play bundles with explicit channel/build types while retaining the checked-out commit SHA.
- `.github/workflows/macos-unsigned.yml` — label the ad-hoc package as testing/unnotarized and inject its checked-out commit SHA.
- `apps/studio/tests/unit/system-info.test.ts` (new) — cover formatting, safe fallback collection, clipboard fallback, retry replacement, external URL selection, and prohibited-field absence.
- `apps/studio/tests/unit/build-metadata.test.ts` (new) — cover metadata precedence, sanitization, short-SHA normalization, and deterministic fallbacks.
- `apps/studio/tests/e2e/studio.spec.ts` — cover desktop Help ordering, exact browser URLs, copy success/failure/retry, state neutrality, app-bar removal, and retained `?` access.
- `apps/studio/tests/e2e/responsive.spec.ts` — cover phone/tablet Help visibility, keyboard-help omission, touch target sizing, containment, and feedback safe-area placement.
- `apps/studio/tests/e2e/studio.spec.ts-snapshots/help-support-menu.png` and responsive Help-menu snapshots (new/updated) — lock reviewed desktop, phone, and tablet presentation where stable visual baselines are appropriate.
- `docs/ui-snapshots/help-support-menu.png` and `docs/ui-snapshots/system-info-notice.png` (new) — retain reviewed product-state evidence.
- `docs/privacy.md` — explain explicit local-only diagnostics, exact categories, clipboard behavior, and absence of upload/identity collection.
- `docs/project-workspace.md` — document the expanded Help routes and single keyboard-guide location.
- `docs/qa.md` — add automated and manual checks plus snapshot inventory.

## Contracts and migrations

- **Diagnostic data contract:** internal `SystemInfoFields` contains only `appVersion`, `buildId`, `releaseChannel`, `buildType`, `osFamily`, `osVersion`, `architecture`, `locale`, and `renderingEngine`. Each output field is whitespace/control-character normalized and length-bounded before formatting. The plain-text labels and ordering above are stable for issue pasting. A missing optional source becomes `Unavailable` and never causes another field to be inferred from private data.
- **Destination contract:** `bug`, `feature`, and `support` are the only accepted internal destination keys. They map respectively to `https://github.com/surelle-ha/zakape/issues/new?template=bug.yml`, `https://github.com/surelle-ha/zakape/issues/new?template=feature.yml`, and `https://ko-fi.com/surelle`. Callers cannot provide a scheme or URL.
- **Runtime config contract:** add public strings for build ID, release channel, and build type alongside `appVersion`. Resolution precedence is explicit `ZAKAPE_*` value, then `GITHUB_SHA` for the identifier, then a short checked-out Git SHA, then `development`. Only an ASCII allowlist is accepted; Git identifiers are shortened consistently. These values are release metadata, not secrets.
- **Capability contract:** add the individual `os:allow-platform`, `os:allow-version`, `os:allow-arch`, and `os:allow-locale` permissions; `clipboard-manager:allow-write-text`; and one `opener:allow-open-url` scoped permission whose allow list contains only escaped exact official URLs. Do not use any plugin `default` permission set.
- **Persistence/schema migration:** none. Notices and diagnostic results are ephemeral; no project, preference, account, assistant, database, updater-manifest, or portable-file field changes.
- **Compatibility:** native APIs are dynamically imported only after detecting the Tauri runtime. Browser preview remains static-host compatible. Android and desktop share plugin registration; desktop-only updater and Google-auth feature gates remain unchanged.
- **Dependency/lock migration:** package and Cargo lockfiles change reproducibly through pnpm/Cargo resolution. Committed Tauri schemas are regenerated with the pinned CLI and reviewed to verify that forbidden permissions are absent.

## Dependencies and sequence

`VIEW-R7CR` is completed and advisory. It supplies the shared menu architecture this work extends, so there is no unfinished critical dependency and no override is required. The existing issue forms and `.github/FUNDING.yml` are validated inputs, not implementation dependencies and are not modified.

Implementation should proceed in these dependency-ordered slices:

1. Establish pure diagnostic/build contracts and tests.
2. Add JS/Rust plugins, capability scopes, generated schemas, and CI build metadata.
3. Implement platform orchestration and the shared notice store/component.
4. Wire the authoritative Help model and remove the duplicate launcher.
5. Add browser/native/responsive regression coverage, visual evidence, and documentation.
6. Run all gates, inspect generated permission diffs and screenshots, then record validation evidence.

After the pure contracts are fixed, native plugin/capability work and the notice UI can proceed in parallel because they touch separate ownership boundaries. Desktop and responsive E2E updates are parallel-safe after command labels and selectors stabilize. Lockfiles, `ApplicationMenu.vue`, `main.css`, generated schemas, and final documentation should each have one owner during implementation to avoid conflicting mechanical edits.

## Risks and mitigations

- **Privacy/fingerprinting expansion:** OS plugins also expose hostname and broader default permissions. Mitigate with individual allow permissions, no hostname call, an explicit narrow type/formatter, length/control-character sanitation, prohibited-field unit assertions, and a final capability-schema audit.
- **Over-broad external opening:** opener defaults allow general HTTP(S) and path reveal. Mitigate by omitting `opener:default`, mapping enum-like destination keys to constants, escaping query markers in exact scopes, testing disallowed/unexpected URLs, and verifying generated ACL manifests.
- **Clipboard availability differences:** standards clipboard may be missing or denied in a WebView/browser. Mitigate with one standards attempt, one write-only native fallback in Tauri, no read permission, actionable Retry, and unit/E2E coverage for denial and recovery.
- **Popup/offline ambiguity:** browser popup APIs and external intents cannot prove that a remote page loaded. Mitigate by treating offline detection, a blocked/null browser context, or native launch rejection as retryable failures; opening successfully hands network rendering to the system browser without mutating Zakape.
- **Build metadata drift:** manual release rebuilds may run from a workflow SHA different from the release target, and an Android debug artifact can be mistaken for release mode. Mitigate by injecting the checked-out `HEAD`, explicit channel/type per job, deterministic local resolution, and metadata unit tests.
- **Duplicate/stacked feedback:** desktop and touch menu components coexist and rapid clicks can create multiple timers or writes. Mitigate with one renderer in `app.vue`, one keyed state, timer cancellation/replacement, disabled in-flight copy/open actions, and repeat-click tests.
- **Shortcut regression:** removing the visual button could accidentally remove its import together with the page-level handler or Help command. Mitigate with focused assertions for button absence, desktop Help access, and the existing `?` dispatch; touch remains intentionally shortcut-free.
- **Responsive obstruction:** a global notice or longer Help group could obscure tabs, footer-safe areas, or exceed short screens. Mitigate with existing scrollable menu containment, 42-pixel touch targets, safe-area positioning, reduced-motion CSS, and phone/tablet portrait visual review.
- **Plugin/platform build regression:** new plugins affect Windows, macOS, Linux, and Android dependency graphs. Mitigate by using matching v2 JS/Rust lines, regenerating schemas with the pinned CLI, Cargo checks/clippy on the host, Android CI compilation, and release matrix verification.
- **State mutation through shared actions:** Help is available on Home and Editor. Mitigate by keeping the composables independent of `useEditor`/repository/account/assistant state and asserting document pixel, dirty, undo, and active-screen state before and after actions.

## Validation strategy

- **AC-1 / AC-6 / AC-7:** Playwright asserts exact desktop and touch Help labels/order/separators, desktop-only Keyboard shortcuts, no app-bar shortcut at any layout, retained `?` access, minimum 42-pixel touch rows, viewport/safe-area containment, and Home/Editor availability. Review desktop, 412×915 phone, and 820×1180 tablet snapshots.
- **AC-2 / AC-9:** Vitest verifies exact label order, real and all-`Unavailable` payloads, value sanitation/length bounds, OS/engine normalization for Windows WebView2, macOS/iOS WebKit, Linux WebKitGTK, Android Chromium WebView, Chromium, Firefox, and unknown browser cases, plus explicit absence of hostname, username, paths, projects, account, network, token, endpoint, prompt, credential, and raw-UA material. Metadata tests cover environment/Git precedence and fallbacks.
- **AC-3:** Unit tests prove one clipboard write per successful activation and one replacement notice/timer. Playwright grants/stubs clipboard write, verifies menu closure, copied content, polite atomic announcement, auto-dismiss, and manual dismiss without focus theft.
- **AC-4:** Unit and Playwright tests force standards/native clipboard failure, verify the error alert leaves the canvas/project unchanged, then make Retry succeed and confirm the prior notice is replaced rather than stacked.
- **AC-5:** Unit tests prove destination keys resolve only to the three constants. Playwright records `window.open` arguments for browser preview and verifies exact URLs plus `_blank`/`noopener,noreferrer`; offline/popup-blocked failures expose Retry/dismiss. Native smoke/manual review confirms the system browser receives each URL and returning from Android preserves the active document.
- **AC-8:** A browser E2E journey invokes every action on Home and Editor and compares active tab/document, canvas signature, dirty/save state, undo availability, account/assistant preference sentinels, and menu state before/after.
- **Native/security gates:** run `cargo fmt --manifest-path apps/studio/src-tauri/Cargo.toml --check`, `cargo check --manifest-path ... --all-targets`, and `cargo clippy --manifest-path ... --all-targets -- -D warnings`; run the Tauri capability/schema generation/check path and inspect ACL output for only approved permissions. Let Android CI compile the mobile plugin path and verify APK signing/package metadata; verify Windows locally and macOS/Linux through the release matrix when unavailable locally.
- **Repository gates:** run `pnpm --filter @zakape/studio lint`, `typecheck`, `test`, `build`, focused and full Playwright suites, root `pnpm check`, `pnpm format:check`, `pnpm spec validate HELP-JYZY`, `pnpm spec:validate`, and `git diff --check`. Capture and inspect durable desktop/touch screenshots at full size.

## Rollout and recovery

No feature flag or data migration is required. The commands ship together in the shared Help model. Copy remains offline and useful when optional native facts are unavailable; each missing value degrades independently to `Unavailable`. Browser preview uses standards APIs and never loads native bindings. Packaged builds use the narrowly scoped native fallbacks.

If a platform plugin fails to initialize, Zakape must still start and all drawing/persistence behavior remains unaffected; browser-safe diagnostic values and a retryable copy/open error are the recovery path. If capability review reveals a URL scope cannot be made exact, implementation must stop and replace the frontend opener call with a narrow Rust command that accepts only a destination enum rather than broadening permissions.

Rollback is a focused revert of the Help commands, notice mount, plugins/capabilities, and build metadata. Because no persistent schema changes or remote writes occur, rollback requires no user-data repair. Existing About, updater, Help tour, `?` shortcut, projects, and sessions continue to use their current contracts throughout rollout.
