# Durable architecture context

- `apps/studio/app/composables/useEditor.ts` owns editor mutations and undo semantics.
- `apps/studio/app/composables/useProjectRepository.ts` owns workspace persistence and recent-project metadata.
- `apps/studio/app/composables/useAiAssistant.ts` owns assistant sessions, bounded proposals, and local provider configuration.
- `apps/studio/src-tauri/src/lib.rs` is the native trust boundary for filesystem, Godot, Ollama, authentication, and operating-system behavior.
- `apps/studio/app/assets/css/main.css` is the shared application design system and responsive source of truth.
- `apps/site/` is the static public website; it may reuse reviewed product screenshots but not private project data.
- `.github/workflows/` owns CI, desktop/updater releases, Android packaging, macOS test builds, and website deployment.

Native paths and imported payloads are untrusted. Canonicalize and validate at the Rust boundary, enforce size/count limits, avoid following symlinks across allowed roots, and make multi-file writes transactional where practical.
