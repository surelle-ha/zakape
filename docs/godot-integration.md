# Godot Bridge

Zakape desktop can connect local Godot projects without moving them into the Zakape workspace. Open **Godot Bridge** from Home, the File menu, or the editor Export menu.

## Connect and browse projects

Choose either a Godot project root or a parent folder that contains several projects. Zakape searches up to six folder levels for regular `project.godot` files and remembers up to 16 connections on this device. Godot defines the folder containing `project.godot` as the project root and exposes its contents through `res://`; the bridge uses the same boundary and forward-slash resource paths. See [Godot's file-path documentation](https://docs.godotengine.org/en/stable/tutorials/io/data_paths.html).

The resource explorer provides:

- folder navigation with `res://` breadcrumbs
- project-wide search and filters for textures, scenes, resources, scripts, and editable sources
- resource type and file-size details
- inline folder creation at the current location
- opening PNG, Aseprite, and `.zakape` resources as Zakape documents
- refresh after Godot or another tool changes the project

Godot's `.godot`, other hidden directories, dependency folders, and symbolic links are not indexed. Each project index is capped at 5,000 entries and 16 folder levels. A truncated index remains browsable and displays its limit.

## Publish an asset

Browse to the destination folder, then use **Publish asset**. Zakape can write:

- the current frame as one PNG
- the complete animation as a horizontal PNG sprite sheet and a Godot 4 `SpriteFrames` `.tres`
- an optional `.zakape` source file beside either output

The generated `SpriteFrames` resource defines one `AtlasTexture` region per frame. It stores the Zakape frame delay as a relative duration at 10 FPS, preserving each frame's absolute timing. `SpriteFrames` is the resource used by `AnimatedSprite2D` and `AnimatedSprite3D`; Godot documents its timing model in the [SpriteFrames class reference](https://docs.godotengine.org/en/stable/classes/class_spriteframes.html) and atlas cropping in the [AtlasTexture reference](https://docs.godotengine.org/en/stable/classes/class_atlastexture.html).

Projects that declare the legacy configuration format can still be browsed and imported, but Zakape will not generate a Godot 4 resource in them. An empty `project.godot` has unknown compatibility; the bridge allows publishing and clearly states that it will use Godot 4's text resource format.

## Validation and file safety

Every operation reopens and canonicalizes the selected project root and verifies its regular `project.godot` marker. A stored connection is only a convenience; it does not bypass validation if the folder moves or disappears.

The native bridge rejects:

- absolute paths, traversal segments, hidden path segments, reserved Windows names, and invalid filename characters
- paths or files that resolve through symbolic links or outside the project root
- unsupported imports and output extensions
- imports larger than 32 MB or textures beyond Zakape's canvas limits
- output files larger than 32 MB, bundles larger than 64 MB, malformed PNG/JSON/resources, and textures above 16,777,216 pixels
- duplicate output paths and writes to folders or links

Zakape stages every file in a bundle before committing it. Existing resources are reported before any write, and replacement requires an explicit checkbox. If a later file cannot be committed, earlier files are rolled back from their staged backups where the operating system permits it. Automatic background sync and scene-file mutation are intentionally not part of the bridge, so saving remains a visible artist action.

The browser and mobile builds show the bridge entry point but do not receive arbitrary local filesystem access. Use the desktop app for direct Godot project integration.
