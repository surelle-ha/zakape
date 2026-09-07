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
