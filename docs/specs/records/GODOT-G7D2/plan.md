# GODOT-G7D2 implementation plan

## Codebase and history evidence

The delivered implementation is evidenced by commits `56785972bbde8c9c9ffb9e1e4da95d7c4c25ec25` and `e05913c97d161376d64c238f917c50e308796c65`, native tests in `apps/studio/src-tauri/src/lib.rs`, the editor bridge composable and modal, and `docs/godot-integration.md`.

## Proposed approach

Keep project discovery, canonical path checks, bounded file reads, resource validation, and transactional writes in Rust. Keep connected-project state and export preparation in a dedicated Vue composable. Present browsing, search, destination selection, conflicts, compatibility, and recovery in one desktop modal.

## Architecture and data flow

The UI requests folder selection, then passes paths to narrow Tauri commands. Rust canonicalizes the root and resource paths at every trust boundary. Imports return validated project payloads. Exports are rendered in the editor, encoded into a bounded asset bundle, validated and conflict-checked natively, staged, and then committed. Stored connections are convenience metadata, not authority.

## Affected files

- `apps/studio/app/components/GodotBridgeModal.vue`: browsing and publishing workflow.
- `apps/studio/app/composables/useGodotBridge.ts`: connection state, indexing, import, and export orchestration.
- `apps/studio/app/composables/useEditor.ts`: editor entry points and source opening.
- `apps/studio/src-tauri/src/lib.rs`: canonicalization, bounds, parsing, conflict checks, staging, rollback, and commands.
- `docs/godot-integration.md`: artist workflow, limits, and safety contract.

## Contracts and migrations

Connected-project metadata is local convenience state and requires no artwork migration. Native command payloads form an internal desktop boundary. Existing Zakape project and import contracts remain authoritative.

## Dependencies and sequence

No unfinished spec dependencies applied to this historical delivery. Native validation and commands preceded UI orchestration, followed by focused tests, documentation, and resource-browser repair.

## Risks and mitigations

Canonicalization and link rejection prevent escaping the root. Bounded discovery and payload limits prevent runaway scans and memory use. Whole-bundle validation, conflict preview, staging, and rollback reduce partial-write risk. Version detection prevents claiming unsupported legacy resource generation.

## Validation strategy

Rust tests cover identity parsing, discovery, safe relative paths, image import, and explicit replacement. Type checking and builds cover command and UI contracts. Manual verification covers folder browsing, conflict confirmation, and importing/publishing real resources.

## Rollout and recovery

The bridge is a desktop-only optional workflow. Failure leaves ordinary Zakape editing available. Stored connections can be removed or reselected, and explicit writes plus staged backups provide the recovery boundary.
