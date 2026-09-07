# Zakape project memory

Zakape is a local-first pixel-art and sprite-animation studio for desktop, phone, and tablet. Drawing, animation, persistence, and export must work without an account, network connection, or model. Model assistance is optional, locally configurable, bounded, previewed, and reversible.

The canonical contributor rules remain in [`AGENT.md`](../../AGENT.md). This directory stores durable context that spans individual specifications. Update it only for decisions and facts that future contributors need; investigation notes belong to the relevant spec record.

## Current product capabilities

- Multi-document pixel editor with layers, frames, onion skin, live preview, selections, transforms, palettes, and several export formats.
- Desktop-native workspace under `Documents/zakape`, plus browser fallback persistence.
- Optional desktop Google identity with local artwork and credential boundaries.
- Optional model assistant supporting local Ollama and user-configured compatible endpoints.
- Desktop Godot Bridge for validated project discovery, `res://` browsing, import, and transactional asset publishing.
- Desktop updater, Android builds, F-Droid metadata, website, and signed release automation.

Run `pnpm spec status` at the start of substantial work. Specs in `docs/specs/records/` are independent records, not a chronological queue.
