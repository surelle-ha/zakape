# GODOT-G7D2 — Godot project asset bridge

## Problem and evidence

Artists using Zakape with local Godot games otherwise have to locate resources and repeatedly export, name, and move sprite files by hand. The desktop shell already has a bounded filesystem bridge and is the only platform with suitable local-project access.

## Desired outcome

A desktop artist can connect one or more local Godot projects, browse their `res://` resources, open supported art sources, and explicitly publish current-frame or animation assets into a chosen project folder.

## User journeys

The artist chooses a project root, a folder inside a project, or a parent containing projects. Zakape discovers and remembers valid projects, opens the selected resource location, and supports search and folder navigation. The artist can import a supported resource or publish validated PNG, SpriteFrames, and optional source assets. Missing, moved, incompatible, conflicting, or malformed resources yield a clear refusal without writing outside the project.

## Functional requirements

- FR-1: Discover the nearest owning project and bounded nested projects from a selected directory.
- FR-2: Browse and search a bounded `res://` index while excluding hidden, dependency, and symbolic-link paths.
- FR-3: Import supported PNG, sprite, and Zakape sources through existing project validation.
- FR-4: Publish a current-frame PNG or an animation sheet with a Godot 4 SpriteFrames resource and optional Zakape source.
- FR-5: Detect conflicts before writing and require explicit replacement.
- FR-6: Keep arbitrary project filesystem access desktop-only.

## Acceptance criteria

- AC-1: Selecting a resource subfolder connects its owning project and preserves that folder as the browsing location.
- AC-2: Traversal, absolute, hidden, reserved, linked, oversized, malformed, and out-of-root paths are rejected.
- AC-3: Animation publishing preserves frame regions and relative delays in a Godot 4 SpriteFrames resource.
- AC-4: Multi-file publishing validates and stages the full bundle, reports conflicts, and rolls earlier writes back after a later failure where the OS permits.
- AC-5: Browser and mobile builds cannot invoke native Godot filesystem commands.

## Edge cases and failure behavior

Moved connections are revalidated on every operation. Empty or legacy configuration files receive explicit compatibility behavior. Discovery and indexes stop at documented depth and entry limits and report truncation. Replacement is opt-in. Invalid resources, unavailable folders, symbolic links, and write failures preserve existing files whenever recovery is possible.

## Constraints

The bridge operates inside the canonical project root marked by a regular `project.godot`. It accepts at most 5,000 indexed entries, 16 index levels, bounded discovery depth, and documented file and bundle sizes. It does not add telemetry, cloud access, or background synchronization.

## Assumptions

Godot defines the `project.godot` parent as `res://`. Godot 4 SpriteFrames text resources and AtlasTexture regions are appropriate for generated animation assets. These assumptions were checked against official Godot documentation and encoded in the bridge documentation.

## Out of scope

Automatic background synchronization, scene mutation, Godot editor plugins, and mobile or browser filesystem integration are not included.

## Clarification record

The implementation deliberately challenged automatic syncing and cross-platform parity. The resulting decisions require an explicit publish action, restrict native access to desktop, validate every operation rather than trusting remembered connections, and avoid scene mutation.

## Dependencies

No historical spec dependency was recorded. The implementation reuses Zakape project validation, import, composite rendering, and desktop Tauri command boundaries.

## Open questions

None.
