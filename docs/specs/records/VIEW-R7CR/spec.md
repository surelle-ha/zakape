# VIEW-R7CR — Centralize canvas views in the View menu

## Problem and evidence

The desktop View menu is incomplete. `AppTitleBar.vue` currently exposes Pixel grid and Onion skin, while the canvas zoom toolbar in `index.vue` exposes Onion skin, Live view, Pixel grid, and Transparency checkerboard. This splits related view state across two control surfaces and makes the title-bar menu look stale.

## Desired outcome

Artists can discover and control every supported canvas display mode from the View menu. Redundant display toggles no longer crowd the zoom controls, while zoom and fit controls remain immediately available.

## User journeys

On desktop, an artist opens View, sees the current checked state of every canvas display mode, and toggles one without affecting artwork. On phone or tablet, the artist taps Menu before Home in the bottom tab pane, chooses File, Edit, View, or Help, and then chooses the equivalent child action. Keyboard changes and menu changes remain synchronized. On Home, canvas-specific View actions remain visible but disabled.

## Functional requirements

- FR-1: Add Live view and Transparency checkerboard to the View menu as checkable items.
- FR-2: Keep menu checkmarks synchronized with the actual canvas and preview state.
- FR-3: Remove the agreed redundant view controls from beside the zoom controls without removing Fit, Zoom out, the zoom slider, Zoom in, or the percentage display.
- FR-4: Remove all four display controls—Onion skin, Live view, Pixel grid, and Transparency checkerboard—from the canvas zoom toolbar on every layout.
- FR-5: Add a phone-and-tablet-only Menu control immediately before Home in the bottom document tab pane.
- FR-6: The mobile Menu must contain File, Edit, View, and Help categories whose child actions mirror the desktop title-bar menus, including existing labels, availability rules, state, and outcomes.
- FR-7: Preserve O, V, G, and Shift+G as keyboard shortcuts and keep them synchronized with the menu state.
- FR-8: Disable canvas-specific View actions while Home is active without changing their stored values.
- FR-9: Nested touch menus must support dismissal, visible focus, accessible expanded/checked/disabled semantics, viewport-safe positioning, and touch-sized targets.

## Acceptance criteria

- AC-1: The desktop View menu lists Pixel grid, Transparency checkerboard, Onion skin, and Live view with accurate checked states.
- AC-2: Selecting each item updates the corresponding canvas or preview immediately and selecting it again restores the prior state.
- AC-3: The zoom toolbar contains no display-mode controls selected for removal and all zoom operations still work.
- AC-4: Existing state changes from any retained shortcut or alternate platform control are reflected when the View menu next opens.
- AC-5: At phone and tablet widths, Menu appears directly before Home and the desktop title bar remains hidden.
- AC-6: Mobile Menu exposes File, Edit, View, and Help children and each available action produces the same result as its desktop counterpart.
- AC-7: Canvas-specific View actions are disabled on Home and enabled in an editable document on desktop and touch layouts.
- AC-8: Tapping outside, choosing an action, pressing Escape when a keyboard is present, or switching layout closes the mobile menu without changing unrelated editor state.

## Edge cases and failure behavior

The menu may be opened while the permanent Home tab is active and no editable document is selected. Disabled actions must not fire through touch or keyboard activation. Mobile nested menus must remain inside narrow, landscape, safe-area, and on-screen-keyboard viewports. Opening another category closes the prior category; tapping outside or choosing a command closes the hierarchy. Closing the menu, switching documents, or rotating the device must not reset view state. Hiding Live view reclaims its panel space without changing its playback state.

## Constraints

View toggles modify presentation only and must not dirty, save, migrate, or change project artwork. The work must preserve keyboard accessibility, menu checkbox semantics, 42-pixel-or-larger touch targets, safe areas, current zoom behavior, and responsive canvas space. Mobile menus must reuse the desktop actions or a shared command layer rather than creating behaviorally divergent copies. Desktop-only actions retain their existing unavailable behavior on unsupported platforms. No persistence or project-schema change is expected.

## Assumptions

The request refers to `AppTitleBar` as the window tab bar and defines mobile as both phone and tablet layouts because both hide that component at widths below 1024 pixels. The existing View menu and toolbar share `showGrid` and `onionSkin`; `showTransparency` is already editor state, and Live view uses the `live-preview-open` state key. `DocumentTabs.vue` already owns the Home position and is moved to the bottom by responsive CSS. These facts were verified in `AppTitleBar.vue`, `DocumentTabs.vue`, `index.vue`, `useEditor.ts`, `main.css`, and responsive tests.

## Out of scope

Canvas zoom mechanics, animation playback logic, project checker tile size, checkerboard rendering style, onion-skin rendering, and the commands offered by File, Edit, and Help are not changed. This work mirrors existing commands on touch layouts; it does not introduce new editor commands or make the desktop title bar visible on mobile.

## Clarification record

Repository inspection established that the four display modes are already functional and that no unfinished spec blocks this change. The user chose to remove all four canvas-toolbar buttons, retain their shortcuts, disable canvas-specific View actions on Home, and add a nested File/Edit/View/Help Menu before Home on both phone and tablet. The implementation will preserve existing unsupported-platform behavior for commands that cannot run on mobile.

## Dependencies

There are no pending spec dependencies. Code dependencies are the shared editor state in `useEditor.ts`, page-level Live view state in `index.vue`, the title-bar menu in `AppTitleBar.vue`, responsive title-bar visibility in `main.css`, and current interaction coverage in `studio.spec.ts` and `responsive.spec.ts`.

## Open questions

None.
