# Durable decisions

## Specification workflow

- Specification IDs are random codes scoped by a semantic area, not sequence numbers.
- Clarification is part of specification, and tasks are part of planning.
- No global current-spec pointer exists. Agents select any viable record explicitly by ID.
- Critical unfinished dependencies block implementation unless the user gives an explicit, reasoned override. Advisory dependencies warn only.
- Machine-readable status lives in each `spec.json`; Markdown files carry reviewable product and implementation detail.

## Product boundaries

- Core editing remains usable offline and without AI or an account.
- Google login is desktop-only until a separate mobile authentication design is approved.
- Godot integration performs explicit user-initiated imports and publishes; it does not mutate scenes or background-sync projects.
- Unsigned macOS artifacts are testing-only and excluded from automatic updates and trusted releases.

## Support diagnostics

- Help diagnostics are explicit, local-only clipboard output: version, build/release metadata, OS family/version, architecture, locale, and a generic rendering-engine label only.
- Fixed issue and funding URLs are opened through a Rust destination enum rather than a frontend URL permission; this keeps the native opener from accepting arbitrary web or file targets.

# UI-49ZB — bounded editor customization

Zakape uses explicit Dark/Light themes, contrast-validated accent presets or custom hex colors, transactional settings dialogs, a single tabbed Assistant Settings surface, and a configurable tool rail. Assistant extensions remain built-in and allow-listed; arbitrary executable, native, network, or model-defined tools are outside the trust boundary.
## 2026-09-10 — TOOLS-C4EX

Advanced drawing tools remain pure integer operations behind `useEditor`. Fill reads either the active
cel or a visible composite but always writes the active layer, and selection masks clip generated
samples. Live text uses version 2 project metadata and a shared hard-edge rasterizer for preview and
export; version 1 projects continue to normalize as pixel-only layers.
