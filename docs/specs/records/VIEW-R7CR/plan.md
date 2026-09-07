# VIEW-R7CR implementation plan

## Codebase and history evidence

`apps/studio/app/components/AppTitleBar.vue` owns four desktop menu groups and directly binds File, Edit, existing View, Help, About, account, updater, and native-window actions. Its View group currently exposes only `showGrid` and `onionSkin`. `apps/studio/app/pages/index.vue` separately binds Onion skin, Live view, Pixel grid, and Transparency checkerboard beside the zoom slider; its key handler already preserves O, V, G, and Shift+G. `useEditor.ts` owns `showGrid`, `showTransparency`, and `onionSkin`, while Live view is the shared Nuxt state key `live-preview-open`.

`DocumentTabs.vue` renders Home first and owns horizontally scrollable document tabs. Responsive rules in `main.css` move this strip below the timeline at widths below 1024 pixels and hide `AppTitleBar`; phone rules constrain Home and document-tab widths. Existing Playwright coverage in `studio.spec.ts` exercises desktop menus and About/update behavior. `responsive.spec.ts` asserts the title bar is hidden, tabs are below the timeline, shortcut UI is hidden, and Live Preview remains reachable at 412 × 839 and 820 × 1180.

Commit `1b0e600` introduced the expanded desktop controls, `aaad9a4` established the responsive bottom-tab and floating-preview behavior, and `a0500e4` added the current set of canvas view controls. `docs/project-workspace.md` and `docs/qa.md` still describe Live view as a canvas-toolbar toggle and therefore require synchronized updates.

## Proposed approach

Extract the current File/Edit/View/Help menus and their About presentation from `AppTitleBar.vue` into one reusable `ApplicationMenu.vue`. The component will own a single typed command model and execute the existing composable actions. It will render that model in two presentation modes: the current horizontal desktop menu bar and a touch-first Menu tab with expandable File, Edit, View, and Help children. This avoids two independently maintained command implementations while preserving platform-specific visibility and disabled rules.

Extend the shared View group with Transparency checkerboard and Live view, use the existing state refs for checked values, and disable all four display commands whenever `screen !== 'editor'`. Keep the existing keyboard handler in `index.vue` so shortcuts remain independent of menu presentation. Remove Onion skin, Live view, Pixel grid, Transparency checkerboard, and the now-orphaned divider/imports from the canvas toolbar, leaving fit and zoom controls unchanged.

Place the touch-only Menu trigger before Home inside `DocumentTabs.vue`. Its panel opens upward from the bottom tab strip, shows one expanded category at a time, stays within viewport and safe-area bounds, uses at least 42-pixel targets, and closes after an action, outside press, Escape, layout change, or tab navigation. The desktop menu remains hidden below 1024 pixels and the touch trigger remains hidden at desktop widths. Preserve the established product rule that keyboard-shortcut help is not offered on touch layouts; desktop-only native window actions are disabled, while Godot, updater, and account commands retain their existing explicit unavailable or guest behavior.

## Architecture and data flow

`ApplicationMenu.vue` is the presentation boundary for application commands. It reads `screen`, editor capability refs, updater state, account state, project persistence, and native-window capability through their existing composables. Both desktop and touch renderers call the same internal action functions and use the same label, checked, and disabled calculations. No command state is copied into `DocumentTabs.vue`.

Desktop flow: `AppTitleBar` renders the shared component in desktop mode; category activation opens its existing anchored child menu; an item invokes the shared action and closes the menu. Touch flow: `DocumentTabs` places the shared component's Menu trigger before Home; activation opens an upward fixed/absolute panel; selecting a category reveals its children; selecting an enabled child invokes the same action and collapses the hierarchy.

The three editor display refs remain authoritative for the canvas, and `live-preview-open` remains authoritative for mounting `LivePreviewPanel`. Menu checkboxes bind directly to those refs. The Home state changes only action availability, not stored display values. Keyboard shortcuts continue to mutate the same refs, so reopening either menu derives current checkmarks without event synchronization or duplicated state. These are presentation changes only: no project mutation, persistence write, dirty revision, native permission, network contract, or trust boundary changes.

## Affected files

- `apps/studio/app/components/ApplicationMenu.vue` (new): shared command definitions, desktop/touch menu renderers, action execution, availability and checked state, dismissal, and About dialog.
- `apps/studio/app/components/AppTitleBar.vue`: replace embedded menu markup with the shared desktop menu while retaining identity, drag behavior, keyboard handling, and window controls.
- `apps/studio/app/components/DocumentTabs.vue`: insert the touch Menu before Home and close it during document/tab actions.
- `apps/studio/app/pages/index.vue`: remove the four view buttons and unused icon/divider markup while retaining O, V, G, and Shift+G handlers and view state used by the canvas/preview.
- `apps/studio/app/assets/css/main.css`: style the shared desktop menus and upward touch hierarchy, responsive visibility, safe areas, focus/disabled states, touch targets, scrolling, and narrow-tab allocation; remove orphaned zoom-divider rules if unused.
- `apps/studio/tests/e2e/studio.spec.ts`: assert desktop View completeness, checked state, Home disabling, shortcut synchronization, toolbar removal, and unchanged Help actions.
- `apps/studio/tests/e2e/responsive.spec.ts`: assert Menu-before-Home ordering, nested categories, equivalent available actions, disabled View state on Home, view toggling in an editor, dismissal paths, toolbar removal, and phone/tablet viewport containment.
- `apps/studio/tests/e2e/studio.spec.ts-snapshots/studio-workbench.png`: update the intended desktop toolbar baseline.
- `apps/studio/tests/e2e/responsive.spec.ts-snapshots/phone-workbench.png`: update the phone tab/menu and toolbar baseline.
- `apps/studio/tests/e2e/responsive.spec.ts-snapshots/tablet-workbench.png`: update the tablet tab/menu and toolbar baseline.
- `docs/project-workspace.md`: document menu-only display controls and the touch Menu hierarchy.
- `docs/qa.md`: update automated/manual expectations and reviewed snapshot references.
- `docs/ui-snapshots/studio-workbench.png`: refresh the reviewed desktop product snapshot if its toolbar is captured.

## Contracts and migrations

No project schema, PGlite schema, native command, filesystem, network, export, or update-manifest migration is required. Existing view state keys and defaults remain unchanged, so current sessions retain their display settings. The internal component contract adds a presentation mode and editor-active/platform availability inputs; it is not a public API. Rollback is a UI-only revert because no persisted data is transformed.

## Dependencies and sequence

There are no spec dependencies and no pending records. Implementation must establish the shared action model first so desktop and mobile do not fork. Desktop View completion and canvas-toolbar removal can then land as one end-to-end slice. The touch renderer follows using the same model. Desktop and responsive test additions are parallel-safe after the component contract stabilizes; documentation and reviewed snapshots follow confirmed behavior.

## Risks and mitigations

- **Command drift:** rendering both layouts from one typed model and shared callbacks prevents labels, disabled rules, checked state, and outcomes from diverging.
- **Temporary loss of touch access:** add and test the mobile Menu in the same implementation slice that removes toolbar buttons.
- **Viewport and safe-area overflow:** anchor the touch panel upward, cap its width/height against dynamic viewport dimensions, scroll its content, account for safe-area insets, and test phone/tablet plus landscape manually.
- **Home-state mutation:** derive `disabled` from `screen !== 'editor'` and assert that disabled activation leaves each ref unchanged.
- **Shortcut or focus regression:** retain the existing single global keyboard listener, preserve About focus return per visible renderer, add Escape/outside dismissal coverage, and avoid mounting duplicate global shortcut handlers.
- **Unsupported commands on mobile:** omit keyboard-only help, disable native maximize, and route Godot/updater/account actions through their existing capability-aware workflows rather than adding platform branches.
- **Tab compression:** use a compact fixed-width Menu trigger, preserve Home, keep the document list as the only flexible/scrolling region, and visually review the narrow phone baseline.
- **Artwork dirtiness:** bind directly to presentation state only and assert no save/dirty indicator change after toggles.
- **Security/privacy:** no new input, persistence, filesystem, credential, or network boundary is introduced; shared actions retain existing validation.

## Validation strategy

- AC-1/AC-2/AC-4: Desktop Playwright opens View, checks all four `menuitemcheckbox` labels and states, toggles each, exercises O/V/G/Shift+G, and verifies the menu state and canvas/preview result agree.
- AC-3: Desktop and responsive assertions verify the zoom toolbar retains Fit, Zoom out, Canvas zoom, Zoom in, and percentage while no four display buttons or divider remain; zoom interaction still changes magnification.
- AC-5/AC-6: Phone and tablet tests verify Menu precedes Home in layout/DOM order, desktop chrome remains hidden, all four categories are reachable, available representative File/Edit/Help actions use existing flows, and platform-unavailable items are absent or disabled deliberately.
- AC-7: Desktop, phone, and tablet tests open View on Home, verify all four canvas actions are disabled, then enter an editor and verify they enable without state reset.
- AC-8: Responsive tests cover one-category-at-a-time expansion, action-close, outside-tap close, Escape close, and panel bounds inside both reference viewports; manual QA adds phone landscape and safe-area review.
- Visual QA: update the desktop, 412 × 839 phone, and 820 × 1180 tablet snapshots only after full-size inspection for menu overflow, tab compression, toolbar balance, focus, contrast, and canvas occlusion.
- Engineering gates: run focused Playwright tests, studio lint/typecheck/unit tests/build, `pnpm spec validate VIEW-R7CR`, touched-file Prettier checks, and `git diff --check`.

## Rollout and recovery

No feature flag or staged data rollout is necessary because the change is local presentation wiring and ships atomically in every build. CI snapshots and interaction tests gate desktop, phone, and tablet layouts. If menu behavior regresses, reverting the shared component integration restores the existing buttons without data recovery. The four shortcuts remain an immediate desktop recovery path if pointer menu presentation fails; touch release acceptance requires the Menu path to pass before shipping.
