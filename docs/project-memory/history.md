# Important project history

- The application grew from a desktop editor into responsive phone and tablet layouts with Android packaging and F-Droid metadata.
- Release automation uses Release Please, signed Tauri updater artifacts, mandatory Android APK attachment, and optional notarized macOS delivery.
- Desktop Google login was added as optional identity; artwork remains local.
- The Godot Bridge was introduced in `v0.16.0` and later hardened for resource browsing and update behavior.
- Vision-guided assistant review was introduced in `v0.17.0` while retaining bounded, undoable proposals.
- The dependency-aware specification system replaced creation-order workflow assumptions after `v0.17.3`.

Use `git log --oneline` and spec-local `history.ndjson` for detailed provenance.
