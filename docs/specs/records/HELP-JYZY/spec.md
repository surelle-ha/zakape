# HELP-JYZY — Support and system information commands

## Problem and evidence

Zakape's shared Help menu currently exposes the quick tour, keyboard shortcut guide, account, updater, and About dialog, but it does not provide a safe diagnostic summary, direct contribution routes, or a funding route. Users reporting a defect must manually find the repository and transcribe version/platform details already known to the app. The existing bug and feature issue forms live at `.github/ISSUE_TEMPLATE/bug.yml` and `feature.yml`, and funding metadata names Ko-fi `surelle`, so the app can route users to maintained project destinations instead of duplicating forms.

The editor app bar also renders a second Keyboard shortcuts button beside Save. `VIEW-R7CR` established `ApplicationMenu.vue` as the shared desktop/touch command model, and Help already contains the canonical desktop-only shortcut entry. Keeping the duplicate app-bar button creates competing navigation and unnecessary chrome.

## Desired outcome

Help becomes the single discoverable support surface. Users can copy a privacy-safe, paste-ready Zakape diagnostic summary, open the correct GitHub form for a bug or feature, support development through Ko-fi, and access keyboard shortcuts only from Help. These actions work consistently in desktop and touch menus where applicable, provide accessible success/failure feedback, and never disclose personal, project, account, or assistant data.

## User journeys

- The user chooses **Help → Copy System Info**. Zakape gathers version, build, release-channel, operating-system, architecture, locale, and rendering-engine fields, writes a labelled plain-text summary to the clipboard, closes the menu, and announces **System information copied**.
- If clipboard permission or native diagnostics fail, the app closes the menu and shows a non-blocking accessible error with **Retry**. Editing remains available and no diagnostic data is sent anywhere.
- The user chooses **Report a Bug** or **Suggest a Feature** on desktop, phone, or tablet. The matching maintained GitHub issue form opens externally; the app does not navigate away or pre-submit content.
- The user chooses **Support Zakape Development**, placed below About Zakape, and the Ko-fi page for `surelle` opens externally.
- A desktop user opens **Keyboard shortcuts** from Help. The duplicate app-bar icon beside Save is absent. Touch Help continues to omit the keyboard-only command while retaining the four new support commands.

## Functional requirements

- FR-1: Add **Copy System Info**, **Report a Bug**, and **Suggest a Feature** to the shared Help group on desktop and touch.
- FR-2: Add **Support Zakape Development** after **About Zakape**, visually separated from ordinary help/update commands, on desktop and touch.
- FR-3: Copy a stable, labelled plain-text diagnostic block containing Zakape version, build identifier, release channel/build type, OS family and version, CPU architecture, system locale, and WebView/browser engine.
- FR-4: Explicitly exclude username, hostname, device identifiers, IP/network address, filesystem paths, artwork/project metadata, account identity, tokens, model endpoints, prompts, and credentials.
- FR-5: Source native machine fields from a narrow Tauri diagnostics command on supported native builds and use capability-safe browser/mobile fallbacks when native fields are unavailable. Do not request broad shell access or execute system commands.
- FR-6: Derive app version from the existing updater/runtime version source and inject a deterministic build identifier and release channel at build time with clear development fallbacks.
- FR-7: Write to the clipboard only after the explicit menu action. Prefer the standards clipboard API where supported and provide a scoped native fallback only if required by packaged platforms.
- FR-8: After success, close menus and show a brief accessible **System information copied** notice. On failure, show a non-blocking error with Retry; repeated activation must not stack notices or duplicate clipboard writes.
- FR-9: Open Bug directly at `https://github.com/surelle-ha/zakape/issues/new?template=bug.yml` and Feature directly at `https://github.com/surelle-ha/zakape/issues/new?template=feature.yml` in the system browser or a new safe browser context.
- FR-10: Open Support at `https://ko-fi.com/surelle` externally.
- FR-11: External opening must prevent opener access, preserve the Zakape session, tolerate offline/blocked-opening failure, and present a non-blocking retryable error rather than silently failing.
- FR-12: Remove the Keyboard shortcuts icon from the editor app bar and its now-unused import/styles while preserving Help → Keyboard shortcuts and the existing `?` shortcut on desktop.
- FR-13: Keep touch behavior deliberate: all four new commands are visible with touch-sized targets; Keyboard shortcuts remains omitted because it is desktop-only.
- FR-14: The commands must work from Home and Editor, must not mutate project state or dirty revision, and must not require authentication, AI, or network access for Copy System Info.

## Acceptance criteria

- AC-1: Desktop and touch Help menus expose Copy System Info, Report a Bug, Suggest a Feature, and Support Zakape Development in the specified order; Support is below About and appropriately separated.
- AC-2: A copied diagnostic block contains exactly the approved labelled categories with real or explicit `Unavailable` values, includes the current app version and deterministic build identifier, and contains none of the prohibited personal/project/credential fields.
- AC-3: Successful copy closes the menu, writes once, and produces a screen-reader-announced success notice that dismisses automatically and can be manually dismissed.
- AC-4: Clipboard or diagnostic failure preserves the workspace and displays a non-blocking error with a working Retry and dismiss action.
- AC-5: Bug and Feature open their exact issue-template URLs, Support opens the exact Ko-fi URL, every action retains Zakape state, and blocked/offline opening produces retryable feedback.
- AC-6: The app-bar Keyboard shortcuts button and its divider/style residue are absent at desktop and compact sizes, while desktop Help and `?` still open the guide.
- AC-7: Phone and tablet Help show all four new support commands with at least 42-pixel targets and safe-area containment but continue to omit Keyboard shortcuts.
- AC-8: Invoking any new Help action from Home or Editor leaves open documents, pixels, undo history, save state, account, and assistant configuration unchanged.
- AC-9: Windows, macOS, Linux, Android, and browser-preview fallbacks format useful diagnostics without panics, shell execution, new broad permissions, or unsupported API errors.

## Edge cases and failure behavior

- Missing native version, architecture, OS version, locale, build SHA, or rendering-engine data is rendered as `Unavailable`; the whole copy does not fail because one optional field is absent.
- Development builds identify themselves as development and use a documented build fallback rather than fabricating a release SHA.
- Locale values are normalized as reported by the platform and never expanded into timezone, region history, or geolocation.
- Browser user-agent parsing may report a generic engine instead of exposing the raw user-agent string; the copied block must not include the full UA.
- Clipboard denial, insecure browser context, external browser launch failure, offline state, and repeated fast clicks produce one current notice with Retry, never an alert, crash, or duplicate window storm.
- Menu actions close using the existing shared execution path. About focus behavior and Escape/outside dismissal remain unchanged.
- On Android, an external intent may leave and resume Zakape; the active project and menu state remain intact.

## Constraints

Diagnostics are user-initiated, local-only, minimal, and plain text. Zakape must not automatically attach, upload, log, or place them into an issue URL. Native collection must use library/platform APIs behind the Tauri trust boundary, not shell commands, and expose only the approved fields. External URLs are compile-time constants under the official repository/funding domains and must never accept user-controlled schemes. No account, assistant, project-schema, persistence, export, updater-manifest, or release-version migration is permitted.

The shared Help command model remains authoritative for desktop and touch. Feedback uses existing neutral-charcoal/violet design, semantic status/alert roles, focus visibility, reduced-motion behavior, and coarse-pointer targets. Copy remains usable offline. Issue and funding destinations naturally require connectivity but failures must not block editing.

## Assumptions

`ApplicationMenu.vue` remains mounted on Home and Editor and is the correct shared command boundary. `useAppUpdater().currentVersion` supplies the packaged version with the package version as browser fallback. Nuxt runtime configuration can receive build SHA/channel from CI without exposing secrets. Tauri's Rust layer can collect approved native facts without adding shell permission. The existing GitHub issue forms and Ko-fi handle are canonical; all were verified in the repository.

## Out of scope

- Automatically creating GitHub issues, authenticating GitHub, uploading logs/screenshots/projects, or attaching system information to URLs.
- Collecting hostname, username, device identifiers, IP/network state, file paths, hardware serials, RAM/storage inventory, GPU identifiers, crash dumps, artwork, account, or AI data.
- Adding an in-app issue composer, telemetry, crash reporting, analytics, log archive, diagnostics file export, or automatic clipboard collection.
- Changing issue form fields, funding providers, account behavior, About content, shortcut mappings, or mobile hardware-keyboard support.

## Clarification record

1. **Challenge:** Which machine fields are useful without creating a privacy leak? **Answer:** Use the proposed privacy-safe payload. **Decision:** Copy only version, build identifier, release channel/type, OS family/version, architecture, locale, and generic engine; explicitly exclude identity, network, paths, projects, accounts, and credentials.
2. **Challenge:** Should reporting open generic Issues or maintained forms? **Answer:** Open the matching forms directly. **Decision:** Bug and Feature use the repository's exact `bug.yml` and `feature.yml` template URLs.
3. **Challenge:** Which configured funding destination is primary? **Answer:** Ko-fi. **Decision:** Support opens `https://ko-fi.com/surelle`.
4. **Challenge:** Which layouts receive the commands and how should keyboard help behave? **Answer:** Add new commands everywhere and retain the recommended keyboard boundary. **Decision:** Four support commands appear on desktop/touch; Keyboard shortcuts stays desktop-only under Help.
5. **Challenge:** What feedback and recovery are required for copy failure? **Answer:** Accept the recommendation. **Decision:** Success announces a transient confirmation; failure is non-blocking and offers Retry.

## Dependencies

`VIEW-R7CR` is an advisory, completed dependency because it established `ApplicationMenu.vue` as the shared desktop/touch command surface and the keyboard-help platform rule. No unfinished critical dependency exists. Existing updater/version and Tauri native boundaries are implementation surfaces, not separate pending specifications.

## Open questions

None.
