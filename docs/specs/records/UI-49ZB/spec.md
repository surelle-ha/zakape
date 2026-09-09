# UI-49ZB — Editor menu customization

## Problem and evidence

Zakape's shared application menu still labels its editing group **Edit** and exposes only Undo and Redo. The requested information architecture treats this group as application-level editor configuration rather than document-history commands: it should be named **Editor**, remove Undo and Redo from the dropdown, and expose Appearance, Assistant Settings, and Toolbox Editor surfaces.

Repository inspection confirms that `ApplicationMenu.vue` is the single command model rendered by both the desktop title bar and the touch **Menu** panel. Undo and Redo also remain available through keyboard shortcuts and dedicated editor controls, so removing them from this dropdown need not remove either operation. Theme colors are currently fixed CSS tokens with a dark-only `color-scheme`. Model connection settings already persist locally, while the assistant's system prompt, skill catalog, and function-tool catalog are compiled constants. `ToolRail.vue` currently renders every tool from a fixed ordered definition list.

## Desired outcome

The shared menu presents an **Editor** group focused on persistent workspace configuration. Users can personalize Zakape's appearance, configure the optional art assistant within explicit safety boundaries, and choose and order the tools shown in the left tool rail. Preferences restore after restart and have safe defaults and recovery paths. The editor remains fully usable offline, without AI, and with keyboard shortcuts even when related menu items or rail tools are hidden.

## User journeys

- A desktop user opens **Editor → Appearance**, previews an accent and light/dark theme, applies it, and sees the preference restored after restart; cancelling restores the previously applied appearance.
- A touch user opens **Menu → Editor** and reaches the same settings with touch-sized controls and safe-area containment.
- A user opens **Assistant Settings**, manages the current provider/model and the approved prompt, skill, and function-tool configuration, validates changes, and can restore defaults if a configuration is invalid or performs poorly.
- A user opens **Toolbox Editor**, hides optional rail tools and reorders visible tools by keyboard, buttons, or drag interaction. Applying the change updates the rail without changing tool shortcuts.
- If the active tool becomes hidden, Zakape selects a predictable visible fallback rather than leaving the canvas in an inaccessible tool state.
- Preference loading fails or stored data is malformed; Zakape ignores unsafe values, restores reviewed defaults, preserves artwork, and explains any recoverable problem without blocking the editor.

## Functional requirements

- FR-1: Rename the shared **Edit** application-menu group to **Editor** on desktop and touch layouts without changing the separate shortcut-guide grouping unless explicitly decided.
- FR-2: Remove Undo and Redo from the shared application dropdown while retaining the commands, shortcuts, undo history, redo history, and existing non-menu controls.
- FR-3: Add **Appearance…**, **Assistant Settings…**, and **Toolbox Editor…** commands to the Editor group in a deliberate order with icons and accessible modal focus behavior.
- FR-4: Appearance must configure a validated accent color and an explicit light or dark application theme, with preview, Apply, Cancel, and Restore defaults behavior.
- FR-5: Applied appearance preferences must persist locally, restore before or during startup without a disruptive flash where feasible, and never become project-file data.
- FR-6: Light mode must be a complete readable theme across the shared application surfaces, canvas chrome, dialogs, drawers, menus, focus states, selections, checkerboard, and custom scrollbars—not a simple background inversion.
- FR-7: Assistant Settings must incorporate the existing provider/model connection management rather than create competing sources of truth.
- FR-8: Prompt, skill, and function-tool customization must have an explicit validation and safety boundary, persist locally, make disabled capabilities unavailable to requests, and offer Restore defaults.
- FR-9: Credentials and model endpoints must retain the existing local-only security boundary and must never appear in project files, exports, logs, themes, or toolbox settings.
- FR-10: Toolbox Editor must list the canonical drawing tools, allow visibility changes and ordering, preview or apply the resulting rail, and offer Restore defaults.
- FR-11: Toolbox customization must not change command IDs or shortcuts. Hidden tools remain reachable through shortcuts unless explicitly decided otherwise.
- FR-12: Toolbox configuration must preserve at least one usable drawing tool and define a safe fallback when the active tool is hidden or unavailable.
- FR-13: All three surfaces must support desktop pointer/keyboard and touch interaction, visible focus, Escape/back cancellation, reduced motion, and non-destructive recovery.
- FR-14: Preferences must be versioned or normalized so future tool/skill additions appear predictably without corrupting existing user order.

## Acceptance criteria

- AC-1: Desktop title bar and touch Menu both label the group **Editor** and contain Appearance, Assistant Settings, and Toolbox Editor; neither contains Undo or Redo.
- AC-2: Ctrl/Cmd+Z and the supported redo shortcut still operate, and removing menu entries does not clear or alter history.
- AC-3: Applying an accent and theme updates all reviewed surfaces accessibly and survives restart; Cancel leaves the prior applied settings unchanged and Restore defaults returns Zakape's canonical appearance.
- AC-4: Light and dark themes meet readable contrast and maintain visible focus, active, hover, disabled, transparency, canvas, and selection states in desktop, phone, and tablet QA.
- AC-5: Assistant configuration restores locally, validates malformed or unsafe values, changes the actual request configuration, and can be reset without exposing credentials or weakening non-configurable safety limits.
- AC-6: Toolbox changes update the left rail in the chosen order, survive restart, accept accessible non-drag reordering, and recover safely when stored IDs are missing, duplicated, or obsolete.
- AC-7: Hiding the active tool selects the agreed fallback, hidden-tool shortcuts follow the agreed behavior, and no configuration can leave the canvas without a usable drawing tool.
- AC-8: Opening, cancelling, applying, resetting, or recovering any settings surface does not mutate project pixels, layers, frames, dirty state, undo history, recent-work metadata, or exported project contents.

## Edge cases and failure behavior

- Invalid accent strings, transparent accents, extremely light/dark accents, or accents that fail contrast are rejected or normalized with an inline explanation.
- System theme changes do not silently override an explicit user choice unless an Automatic mode is approved during clarification.
- Malformed, outdated, duplicated, or unknown persisted tool/skill/tool-function IDs are normalized against the current canonical catalogs.
- Disabling or hiding the current assistant skill or editor tool chooses a stable fallback and announces the change.
- Drag reordering has keyboard/button equivalents and does not activate tools while arranging them.
- Preference write failure leaves the last applied in-memory choice usable for the session and shows non-blocking recovery; it never blocks drawing or saving artwork.
- Opening one settings surface closes the application menu; nested model management does not create stacked modal traps.

## Constraints

Core drawing remains local-first, offline, and independent from authentication or AI. Settings are device-local preferences, not project content. Existing project schemas and exported `.zakape` files must remain compatible. The shared `ApplicationMenu.vue` command model remains authoritative for desktop and touch. Accent customization must retain neutral charcoal/light-neutral surfaces and use the accent for controls, outlines, focus, and active state rather than tinting every background.

Assistant configuration must not turn provider output into trusted code, allow arbitrary native commands or network tools, bypass proposal review, expand filesystem permissions, or remove hard validation/operation bounds. New preference processing must stay off drawing hot paths. All AI-related design and development documentation stays under `docs/`.

## Assumptions

- Undo/Redo remain discoverable through the existing shortcut guide and editor controls; only their application-menu entries are requested for removal.
- The **Editor** group appears in both desktop and touch menus because both are generated from the same inspected command model.
- Existing `useProjectRepository` preferences are the likely persistence boundary, but the implementation plan must verify startup timing and credential handling.
- `toolDefinitions`, `ASSISTANT_SKILLS`, and `ASSISTANT_TOOL_CATALOG` remain canonical catalogs whose stable IDs can support version-tolerant preferences.

## Out of scope

- Removing or remapping Undo/Redo shortcuts or history behavior.
- Saving appearance, assistant configuration, or toolbox layout inside artwork/project files.
- Downloading executable assistant tools, executing model-supplied code, granting arbitrary filesystem/network/native capabilities, or removing proposal review.
- Creating new drawing algorithms or new built-in assistant capabilities as part of the settings UI.
- Replacing the overall application layout beyond changes required for complete theme coverage and the configurable tool rail.

## Clarification record

Repository fact: desktop and touch use one shared application-menu model. Decision: the renamed Editor group and its three settings entries apply to both layouts so the UI does not fork.

Repository fact: Undo and Redo have keyboard and non-menu access. Decision: remove only their entries from the application menu and preserve their operations and shortcuts.

1. **Challenge:** Should Assistant Settings permit unrestricted prompt/tool authoring? **Answer:** Use the bounded configuration model. **Decision:** Keep the existing provider/model management; allow an additional user instruction without replacing Zakape's safety envelope; enable or disable built-in skills and function tools; reject arbitrary native commands, executable code, unrestricted network tools, and model-defined functions; include Restore defaults.
2. **Challenge:** Should Appearance follow operating-system theme changes? **Answer:** Use the recommendation. **Decision:** Offer explicit Dark and Light modes only; never change an explicit choice because the operating system theme changes.
3. **Challenge:** Should settings save continuously or transactionally? **Answer:** Use the recommendation. **Decision:** Each settings modal supports a live draft preview plus Apply, Cancel, and Restore defaults; only Apply persists, and Cancel restores the last applied state.
4. **Challenge:** What does hiding a toolbox item mean for keyboard access? **Answer:** Use the recommendation. **Decision:** Pencil, Eraser, and Hand remain visible; optional tools may be hidden and reordered; hidden tools remain available through their existing shortcuts.
5. **Challenge:** Where do preferences belong? **Answer:** Use the recommendation. **Decision:** Appearance, assistant, and toolbox preferences are device-local and shared across guest/local sessions; they are never saved in project files or exports and are not account-synchronized or exportable in this scope.
6. **Challenge:** Should accent editing be preset-only or arbitrary? **Answer:** Use the recommendation. **Decision:** Provide curated accent presets plus a custom color-picker/hex value; derive hover, focus, muted, and contrast-safe variants and reject colors that cannot remain readable in the selected theme.
7. **Challenge:** How should model and assistant configuration be presented? **Answer:** Use the recommendation. **Decision:** One tabbed Assistant Settings modal owns Model, Instructions, Skills, and Tools; existing model-management entry points open its Model tab.
8. **Challenge:** Which assistant capabilities may be disabled? **Answer:** Use the recommendation. **Decision:** Require at least one enabled skill and keep the essential pixel-writing function enabled; layer, frame, timing, fill, and transform functions may be toggled off.
9. **Challenge:** How should future tools interact with a customized toolbox? **Answer:** Use the recommendation. **Decision:** New optional tools appear as New and disabled without disturbing the user's order; preference migrations may insert future mandatory core tools.

## Dependencies

`VIEW-R7CR` is a completed advisory dependency because it established `ApplicationMenu.vue` as the shared desktop/touch menu architecture. Existing appearance tokens, local preference APIs, assistant connection management, assistant catalogs, and tool definitions are implementation surfaces. No unfinished critical dependency has been detected so far; dependency analysis will be rerun after the clarification boundary is settled.

## Open questions

None.
