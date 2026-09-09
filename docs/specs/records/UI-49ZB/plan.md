# UI-49ZB implementation plan

## Codebase and history evidence

- `apps/studio/app/components/ApplicationMenu.vue` owns one computed File/Edit/View/Help model and renders it as both desktop title-bar menus and the phone/tablet Menu accordion. The Edit group currently imports editor history state solely to expose Undo/Redo. Commit `d760017` established this as the authoritative cross-layout command surface, so the group must be renamed and rewired here rather than duplicated in the title bar or mobile tabs.
- `apps/studio/app/utils/commands.ts` separately owns command/shortcut metadata. Its Edit shortcut-guide section includes Undo, Redo, colors, and brush size, while `pages/index.vue` performs the actual global key handling and still renders dedicated Undo/Redo controls. Removing menu commands therefore must not change `editCommands`, the shortcut guide, history stacks, or key dispatch.
- `apps/studio/app/app.vue` is the earliest stable UI mount. It initializes the updater and account while a 4.8-second splash is visible. Appearance hydration belongs here so a cached theme can be applied before ordinary content is exposed; the async repository preference can then be reconciled without putting persistence work in canvas render or stroke paths.
- `app/assets/css/main.css` defines the shared design system, but only a small root token set is semantic and the rest contains many literal dark/violet values. A credible light mode requires a token audit and migration of shared surfaces, text, dividers, overlays, controls, hover/focus/disabled states, custom scrollbars, glass panels, checkerboards, and canvas chrome. A root background inversion would leave unreadable and over-purple islands.
- `useProjectRepository.ts` already provides JSON preference storage through PGlite. Appearance, assistant, and toolbox records can use this device-local store without touching the project schema. Appearance additionally needs a small non-secret localStorage startup cache to avoid a dark-to-light flash before PGlite opens; PGlite remains authoritative and cache corruption is safely ignored.
- `ModelConnectionDialog.vue` currently owns provider/model drafts, connection testing, local preference hydration, and model preference saving; the API key intentionally remains in session state and is omitted from persisted `model-connection`. It is mounted inside `AssistantDrawer.vue`, so it cannot serve the Editor menu from Home. `useWorkspace.ts` owns the existing modal-open state and is the correct place to replace it with an application-level Assistant Settings state plus requested initial tab.
- `useAiAssistant.ts` owns the protected system prompt, provider connection, proposal validation, and request construction. `assistantSkills.ts` exposes six stable skill IDs and nine stable tool names, while the assistant drawer renders all skills. Bounded customization therefore needs one normalized settings contract consumed by prompt construction, visible skill selection, tool advertisement, and proposal validation; merely hiding toggles in the UI would not disable a capability.
- `ToolRail.vue` maps the canonical `toolDefinitions` array to icons and currently renders every entry in fixed order. The page-level key handler resolves the same definitions independently, which naturally preserves shortcuts for hidden rail tools. The preference layer must order/filter rail presentation only and fall back to Pencil when applying a layout that hides the active optional tool.
- Existing dialogs demonstrate focus trapping and return, while current menu/touch tests in `studio.spec.ts` and `responsive.spec.ts` cover shared command labels, 42-pixel touch targets, safe-area containment, and viewport snapshots. `updater.test.ts` and assistant unit tests provide reusable Nuxt-state/PGlite mocking patterns.
- Durable project conventions require neutral surfaces with violet reserved for accents, semantic controls, visible focus, reduced-motion behavior, and no work on drawing hot paths. The frontend design direction is a compact pixel-workbench settings suite: quiet graphite or drafting-paper surfaces, one user-selected accent, dense instrument-like rows, and a miniature tool-rail/theme preview as the distinctive element—not generic oversized settings cards.

## Proposed approach

1. Define pure, versioned preference contracts and normalizers before building UI. Add appearance token derivation/contrast validation, assistant capability normalization, and toolbox order/visibility migration helpers with exhaustive unit tests. Stable catalog IDs—not array positions or translated labels—are the persisted contract.
2. Add focused composables that hydrate/apply each preference without touching project state: `useAppearanceSettings`, `useAssistantSettings`, and `useToolboxSettings`. They expose applied state, draft creation/validation, transactional Apply/Cancel/reset actions, and one-time hydration. Appearance applies CSS variables and `data-theme`; assistant settings feed the existing assistant owner; toolbox settings feed rail presentation.
3. Replace the narrow `modelConnectionOpen` workspace state with editor-settings actions for Appearance, Assistant Settings (including initial tab), and Toolbox Editor. Mount each modal once at page level so commands work from Home and Editor and the assistant drawer can open the same Assistant Settings modal on its Model tab.
4. Refactor `ModelConnectionDialog.vue` into a tabbed `AssistantSettingsDialog.vue` with Model, Instructions, Skills, and Tools panels. Preserve current provider discovery, connection test, API-key non-persistence, and vision control. Test a connection against the draft without saving it; only Apply changes live assistant behavior and persists sanitized settings. Restore defaults affects the draft until Apply.
5. Enforce assistant choices end to end. Filter the drawer to enabled skills and choose a deterministic fallback when necessary; append the bounded user instruction as explicitly lower-priority user configuration; advertise only enabled tools; and make proposal validation reject operations/actions whose tool IDs are disabled. `set_pixels` stays enabled and at least one skill is required.
6. Add `AppearanceDialog.vue` and a semantic theme layer. Offer Dark/Light, curated accents, and the existing custom picker/hex interaction. Live-preview the draft by applying derived variables to the root, roll back on Cancel/Escape/backdrop, persist only on Apply, and restore canonical charcoal/violet defaults on request. Migrate hardcoded shared UI colors to semantic tokens and add a deliberately authored cool drafting-paper light theme rather than an inversion.
7. Add `ToolboxEditorDialog.vue` with the miniature rail preview, visibility controls, drag ordering, and accessible Move up/Move down actions. Pencil, Eraser, and Hand are locked visible. Applying normalizes the list, moves an active newly hidden tool to Pencil, and updates only `ToolRail`; shortcut resolution continues to use the full canonical catalog.
8. Update the shared Editor menu, tests, screenshots, user/AI documentation, and durable architecture memory. Run responsive visual QA at desktop, phone, and tablet sizes in both themes, including constrained-height dialogs and coarse-pointer reorder behavior.

## Architecture and data flow

```text
app.vue startup
  -> useAppearanceSettings.hydrate()
       -> synchronous validated localStorage cache (first paint aid)
       -> PGlite preference reconciliation (authoritative)
       -> documentElement[data-theme] + semantic CSS variables

ApplicationMenu: Editor
  -> useWorkspace.openEditorSetting(kind, optionalTab)
       -> one page-level modal
            AppearanceDialog -> appearance draft -> preview root -> Apply/persist or Cancel/rollback
            AssistantSettingsDialog -> assistant draft -> test draft -> Apply/persist
            ToolboxEditorDialog -> toolbox draft/preview -> Apply/persist

useAssistantSettings applied state
  -> AssistantDrawer enabled skill list + fallback
  -> useAiAssistant request context
       -> protected system prompt (immutable)
       -> bounded user instruction
       -> enabled tool catalog only
       -> proposal validator allowed-tool gate
       -> existing reviewable proposal/apply boundary

useToolboxSettings applied state
  -> normalize against canonical tool IDs
  -> ToolRail ordered visible definitions
  -> page keyboard handler still uses full toolDefinitions catalog
```

The three preference composables own application configuration only. `useEditor` remains the owner of active tools, document mutations, history, and project dirty state. `useAiAssistant` remains the owner of provider calls and untrusted proposal validation. `useProjectRepository` remains the generic storage adapter and receives no project schema changes.

Appearance drafts may temporarily affect root CSS for a truthful preview, but the composable retains an immutable applied snapshot. Cancel, Escape, backdrop close, component teardown, or failed persistence restores that snapshot. Light/dark and accent values become semantic variables (`--surface-*`, `--content-*`, `--border-*`, `--accent-*`, `--status-*`, scrollbar and overlay tokens); legacy mint aliases may remain temporarily only if they resolve to the derived accent tokens. Canvas artwork colors and project palettes are never themed.

Assistant settings persist a version, bounded user instruction, enabled skill IDs, enabled tool IDs, and sanitized connection fields. The API key remains memory-only exactly as today. User instructions are data beneath the immutable Zakape system/safety prompt and are length/control-character bounded. Disabled tools are removed from the model context and independently rejected during response validation, so prompt noncompliance cannot reactivate them. Connection testing accepts a draft object and does not mutate or persist the active connection.

Toolbox settings persist `version`, `knownToolIds`, `order`, and `visibleToolIds`. On first use, all current tools are visible in canonical order. During an upgrade, unknown optional IDs are appended only in the editor catalog as New and remain hidden; required IDs are inserted visibly through the normalizer. Duplicates, unknown IDs, and missing required IDs are repaired before state reaches the rail. Dragging changes only a draft array; buttons provide the equivalent accessible operation.

## Affected files

- `apps/studio/app/app.vue` — hydrate appearance during startup before authenticated content is exposed.
- `apps/studio/app/pages/index.vue` — mount the three settings dialogs once, hydrate assistant/toolbox preferences, preserve global tool and history shortcuts, and handle the active-tool fallback after toolbox Apply.
- `apps/studio/app/components/ApplicationMenu.vue` — rename Edit to Editor, remove Undo/Redo menu wiring, and add the three shared desktop/touch settings commands.
- `apps/studio/app/components/AssistantDrawer.vue` — open canonical Assistant Settings on Model, render only enabled skills, and recover selected-skill fallback.
- `apps/studio/app/components/ModelConnectionDialog.vue` — remove after its behavior is absorbed by Assistant Settings without leaving duplicate preference ownership.
- `apps/studio/app/components/AssistantSettingsDialog.vue` (new) — tabbed Model, Instructions, Skills, and Tools transactional editor.
- `apps/studio/app/components/AppearanceDialog.vue` (new) — dark/light, preset/custom accent, contrast feedback, preview, Apply/Cancel/defaults.
- `apps/studio/app/components/ToolboxEditorDialog.vue` (new) — visible/order editor with drag and keyboard/button alternatives plus miniature rail preview.
- `apps/studio/app/components/SettingsDialogShell.vue` (new) — shared compact modal frame, accessible title/description, focus containment/return, action row, safe-area behavior, and reduced-motion-safe presentation.
- `apps/studio/app/components/ToolRail.vue` — render normalized visible tools in the persisted order while retaining canonical icons and tooltips.
- `apps/studio/app/composables/useWorkspace.ts` — own mutually exclusive settings-open state and Assistant Settings initial-tab routing.
- `apps/studio/app/composables/useAppearanceSettings.ts` (new) — hydrate, preview, apply, roll back, cache, and persist appearance.
- `apps/studio/app/composables/useAssistantSettings.ts` (new) — normalize, hydrate, draft, apply, reset, and persist bounded assistant preferences.
- `apps/studio/app/composables/useToolboxSettings.ts` (new) — normalize catalog evolution, hydrate/apply/reset tool visibility/order, and identify new tools.
- `apps/studio/app/composables/useAiAssistant.ts` — test draft connections, merge bounded instruction/context, filter advertised tools, and validate disabled capabilities.
- `apps/studio/app/types/editor.ts` — add typed appearance, assistant-settings, assistant-tool ID, toolbox preference, and settings-tab contracts.
- `apps/studio/app/utils/appearance.ts` (new) — pure hex normalization, luminance/contrast checking, preset metadata, and semantic token derivation.
- `apps/studio/app/utils/assistantSkills.ts` — type stable tool IDs and expose canonical defaults/metadata suitable for the settings UI.
- `apps/studio/app/utils/editorSettings.ts` (new) — pure versioned assistant/toolbox normalizers, required-tool rules, catalog migration, and allowed-operation mapping.
- `apps/studio/app/utils/commands.ts` — mark required/optional toolbox tools and keep the shortcut-guide Edit group/history commands unchanged.
- `apps/studio/app/assets/css/main.css` — introduce dark/light semantic tokens, migrate hardcoded application chrome, and style the compact settings shell, tabs, previews, sortable rows, touch layouts, focus, scroll, and reduced motion.
- `apps/studio/tests/unit/appearance.test.ts` (new) — validate accent parsing, contrast, derived tokens, theme defaults, and malformed preference recovery.
- `apps/studio/tests/unit/editor-settings.test.ts` (new) — validate assistant/toolbox schemas, minimum capabilities, future/unknown IDs, deduplication, required insertion, and allowed-operation mapping.
- `apps/studio/tests/unit/assistant.test.ts` — cover lower-priority instruction placement, enabled catalog filtering, draft connection tests, and disabled-tool response rejection.
- `apps/studio/tests/e2e/studio.spec.ts` — cover Editor menu, retained history shortcuts, all three modal transactions, persistence/reload, active-tool fallback, hidden-tool shortcuts, and project-state neutrality.
- `apps/studio/tests/e2e/responsive.spec.ts` — cover touch Editor navigation, safe-area/constrained-height dialogs, non-drag reorder controls, touch targets, and no horizontal overflow.
- `apps/studio/tests/e2e/editor-settings-visual.spec.ts` (new) — capture stable dark/light Appearance, Assistant Settings, Toolbox Editor, and themed workspace baselines.
- `docs/ui-snapshots/editor-appearance-dark.png`, `editor-appearance-light.png`, `assistant-settings.png`, `toolbox-editor.png` (new) — retain reviewed product-state evidence.
- `docs/project-workspace.md` — document Editor menu, appearance, and toolbox behavior.
- `docs/ai/model-assistant.md` — document bounded user instructions, skills/tools toggles, protected prompt, credentials, and defaults.
- `docs/privacy.md` — state device-local preference and session-only API-key boundaries.
- `docs/qa.md` — add automated/manual theme, settings, touch, accessibility, migration, and snapshot checks.
- `docs/project-memory/architecture.md` and `docs/project-memory/decisions.md` — retain the application-preference, semantic-theme, bounded-assistant, and stable-tool-ID contracts.

## Contracts and migrations

- **AppearancePreference v1:** `{ version: 1, theme: 'dark' | 'light', accent: '#rrggbb' }`. Values are lowercase opaque six-digit hex. The selected accent must meet the planned non-text 3:1 contrast threshold against the selected theme's primary/raised surfaces; a derived foreground token must meet 4.5:1 for compact text. Invalid persisted values fall back atomically to the canonical dark/violet preference. The localStorage startup cache contains only this record and is reconciled with the PGlite `appearance-settings` value.
- **AssistantPreference v1:** `{ version: 1, userInstruction: string, enabledSkillIds: AssistantSkillId[], enabledToolIds: AssistantToolId[] }`. Instruction text is trimmed, control-character filtered, and capped at 4,000 characters. At least one known skill and `set_pixels` are enforced. Unknown IDs and duplicates are removed; empty/invalid configurations restore defaults rather than silently disabling the assistant. Provider/model preference remains under the existing `model-connection` key for compatibility, with API keys excluded as before.
- **ToolboxPreference v1:** `{ version: 1, knownToolIds: ToolId[], order: ToolId[], visibleToolIds: ToolId[] }`. Normalization deduplicates known IDs, removes retired IDs, preserves relative user order, appends newly discovered optional tools only to the editor list, forces required Pencil/Eraser/Hand visible, and uses canonical order when the record is absent or irrecoverable. Applying a layout that hides the active optional tool selects Pencil once without adding an undo entry or dirtying the project.
- **Assistant capability mapping:** every assistant response action/operation maps to one catalog tool ID. `set_pixels` is required. `fill_rect`, `outline_rect`, `replace_palette_color`, `translate_region`, `flip_region`, `create_layer`, `create_frame`, and `set_frame_duration` may be disabled independently. Request messages include only enabled metadata, and response validation receives the same allowed set.
- **Workspace UI state:** replace `modelConnectionOpen` with mutually exclusive settings kind plus `assistantSettingsTab: 'model' | 'instructions' | 'skills' | 'tools'`. Existing drawer model button routes to `model`; Editor menu routes to the default Model tab. Closing a modal clears ephemeral draft state and returns focus to its invoking control.
- **Compatibility:** project files, exports, authentication, updater data, and assistant chat history do not change. Existing `model-connection` records load unchanged. New preferences are additive JSON rows and require no SQL migration. Browser, Tauri desktop, and Android use the same normalized device-local behavior; no native capability or release-workflow changes are required.

## Dependencies and sequence

`VIEW-R7CR` is completed and advisory; it supplies the shared menu architecture. No unfinished critical dependency or override is required. `EDITOR-7ED4` is completed in the current branch and does not need to become a declared dependency because its selection/palette behavior is orthogonal.

Implementation sequence:

1. Lock pure preference, color, capability, and catalog-migration contracts with tests.
2. Implement composable hydration/application boundaries and startup appearance caching.
3. Refactor assistant request/testing/validation behavior before replacing the model dialog.
4. Build the shared settings shell and three modal surfaces.
5. Wire menu/workspace/assistant drawer/tool rail and preserve shortcuts/history behavior.
6. Complete semantic dark/light token migration and responsive styling.
7. Add E2E, accessibility, persistence/migration, and visual coverage; update docs/memory.
8. Run repository/native-relevant gates and record evidence before implementation completion.

After the contracts stabilize, Appearance UI/theme work and Toolbox UI work are parallel-safe because they own separate composables/components. Assistant UI and assistant request changes must remain sequential around shared state. `ApplicationMenu.vue`, `useWorkspace.ts`, `index.vue`, `main.css`, and the final spec/docs each need one implementation owner to avoid conflicting integration edits.

## Risks and mitigations

- **Incomplete light theme:** literal dark colors can produce unreadable islands. Mitigate with a CSS color audit, semantic tokens for every shared role, automated contrast checks for derived accents, and desktop/phone/tablet snapshots of Home, editor, dialogs, drawers, glass panels, and disabled/focus states.
- **Accent overuse or illegibility:** a custom color could tint backgrounds or disappear. Mitigate by keeping neutral surfaces theme-owned, applying accent only to interaction roles, validating against both key surfaces for the selected theme, and deriving bounded hover/muted/foreground variants.
- **Theme flash or hydration race:** PGlite is asynchronous. Mitigate with a validated non-secret startup cache, idempotent one-time hydration in `app.vue`, authoritative database reconciliation, and splash/auth timing tests.
- **Cancel leaking changes:** live appearance preview or nested model tests could mutate applied state. Mitigate with immutable opening snapshots, draft-only testing, cleanup rollback on every close path/unmount, and tests for Apply, Cancel, Escape, backdrop, and persistence failure.
- **Credential regression:** merging connection settings into a larger record could persist API keys. Mitigate by retaining the existing sanitized `model-connection` payload, keeping the key only in `useState`, asserting stored JSON lacks it, and excluding settings values from logs/project exports.
- **Disabled assistant tools still execute:** prompt-only filtering is insufficient. Mitigate with one stable capability map shared by advertised catalog construction and proposal validation, plus adversarial tests returning each disabled operation/action.
- **Assistant becomes unusable:** all skills or pixel editing could be disabled. Mitigate with UI locks plus normalization that guarantees one known skill and required `set_pixels`, and deterministic fallback to Fix or the first enabled skill.
- **Tool catalog upgrades corrupt layout:** new/retired IDs can duplicate, disappear, or reorder choices. Mitigate with versioned ID-based records, known-ID tracking, pure normalizers, migration fixtures, New badges, and required-tool insertion rules.
- **Hidden active-tool confusion:** applying visibility while an optional tool is active could leave no rail indication. Mitigate by switching to Pencil on Apply; later intentional hidden-tool shortcuts remain supported and the existing status label names the active tool.
- **Drag-only or cramped dialogs:** touch users and keyboard users may be unable to reorder or reach actions. Mitigate with Move up/down controls, 42-pixel coarse-pointer targets, scrollable body/sticky actions, safe-area padding, focus trap/return, constrained-height tests, and reduced motion.
- **Preference failure affects artwork:** settings share the repository adapter. Mitigate by using distinct keys, never changing persistence state/project records for failed settings writes, keeping last applied session state, and presenting a non-blocking retryable error.
- **Scope growth:** full user-defined executable tools would alter the trust boundary. Mitigate by making catalogs compiled and ID-limited, keeping the protected prompt/validation limits immutable, and treating custom tool authoring as a separate future spec.

## Validation strategy

- **AC-1 / AC-2:** Playwright asserts desktop and touch label/order, absence of Undo/Redo in Editor, presence of all settings entries, retained app-bar controls, and functioning Ctrl/Cmd+Z plus redo shortcuts with unchanged history.
- **AC-3 / AC-4:** unit tests verify accent normalization, 3:1/4.5:1 constraints, token derivation, and cache/database recovery. E2E applies and reloads dark/light plus custom accents, cancels every close path, restores defaults, and checks semantic colors/contrast across representative Home/editor/dialog/drawer/menu/footer/canvas states. Visually review 1440×900 desktop, 820×1180 tablet, and 412×915 phone in both themes.
- **AC-5:** unit tests prove instruction bounds, immutable protected prompt placement, enabled skill/tool filtering, required capabilities, draft connection testing, API-key non-persistence, and rejection of every disabled returned tool. E2E verifies four tabs, validation, Apply/Cancel/defaults, model-button routing, reload, and proposal behavior with mocked providers.
- **AC-6 / AC-7:** unit tests cover absent, malformed, duplicate, retired, new optional, and future mandatory tool records. E2E covers pointer drag plus Move up/down, locked core tools, active-tool fallback, persisted order/visibility, New behavior, tooltip/order rendering, and activation of a hidden tool through its shortcut.
- **AC-8:** all settings journeys snapshot the active document ID, pixels, frames, layers, dirty revision, undo/redo availability, recent metadata, and exported project JSON before/after open, cancel, apply, reset, invalid recovery, and reload.
- **Accessibility/responsive:** run semantic-role/name checks, focus containment/return, Escape/backdrop cancellation, error announcement, keyboard tab/order controls, 42-pixel coarse-pointer controls, safe-area/viewport containment, 200% text/zoom resilience, no horizontal overflow, and reduced-motion behavior.
- **Repository gates:** run studio lint, typecheck, unit tests, production build, focused/full Playwright, root spec tests/validation, Prettier on affected files, `pnpm spec validate UI-49ZB`, `git diff --check`, and visual snapshot review. No Rust/Android native code changes are planned, but Android browser-shell CI and release builds remain required downstream gates for responsive/static bundle compatibility.

## Rollout and recovery

The feature ships without a remote flag or project migration. All new preferences are additive, normalized before use, and recoverable through Restore defaults. Existing users begin with canonical dark/violet appearance, every current tool visible in canonical order, every built-in assistant skill/tool enabled, and their existing model connection intact.

If appearance loading fails, Zakape uses canonical theme tokens and clears only the invalid cache. If an assistant/toolbox record fails validation, the corresponding subsystem falls back to defaults without deleting artwork or other settings. If saving fails, the dialog remains open with the draft and a retryable error; applied state changes only after confirmed persistence, except an appearance preview that is rolled back.

Rollback removes the menu entries, dialogs/composables, semantic override layer, and preference consumers. Unknown preference rows can remain inert in PGlite, so rollback requires no destructive cleanup. The existing project schema, model connection key, assistant chat, tool shortcuts, project files, and releases remain readable throughout.
