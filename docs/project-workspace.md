# Project workspace

Zakape opens with a 4.8-second branded splash. If the artist has not previously chosen Guest or Google access, a dedicated entry page appears before Home. After that choice is stored, later launches continue to the workbench Home tab. The project launcher stays hidden until the artist chooses a new-project or project-management action. It appears as a focused modal over Home or the active document and keeps project selection and document creation separate from drawing.

## Working directory

The packaged desktop app creates a `zakape` folder inside the current user's operating-system Documents directory. Typical locations are:

- Windows: `C:\Users\your_username_here\Documents\zakape`
- macOS: `/Users/your_username_here/Documents/zakape`
- Linux: the Documents directory reported by the desktop environment, followed by `/zakape`

Each project is stored as `project_id.zakape`. The human-readable project name remains inside the JSON file, so renaming a sprite does not orphan a second file.

Zakape's native file bridge is intentionally narrow. The webview can ask to list, read, or write a project ID, but it cannot supply an arbitrary filesystem path. Rust rejects traversal characters, mismatched JSON identities, unsupported project versions, and project files larger than 32 MB.

Before opening a project, the shared parser checks its dimensions, frame and layer IDs, colors, and cel buffer lengths. It also requires at least one frame and layer, so browser imports and desktop restores follow the same project contract.

PGlite keeps an indexed copy for fast autosave and browser development. Desktop project-launcher results merge the Documents folder with that cache so projects made before the working-directory feature remain accessible and migrate on their next save.

## Project launcher

From the project launcher you can:

- reopen an indexed recent project
- create a named canvas with explicit width and height values up to 1,024 pixels per side and 1,048,576 pixels total
- choose RGBA, Greyscale, or Indexed color handling
- initialize the first frame with a transparent, black, or white background
- choose how many source pixels make up each light or dark transparency-checker tile
- start with Zakape Violet or a researched PICO-8, Sweetie 16, DawnBringer 16, Endesga 32, or Game Boy BGB palette
- create a custom project palette with Zakape's own color mixer
- import a `.zakape` file, which is copied into the working directory on save
- import a compatible layered binary sprite file in the desktop app, then save the converted project into the working directory
- confirm the resolved desktop working-directory path

Home and the project launcher share a local **Suites** library. Create a top-level folder for a related sprite set, then add nested folders for variants such as outfits, directions, or animation families. Selecting a suite filters its own projects and those in its subfolders. Every recent-project card can be moved to another suite or returned to **Unfiled**, and the new-project form can save a sprite directly into the selected suite. Folder names and project assignments are stored as local workspace preferences; they do not alter the portable `.zakape` project format or upload artwork.

Binary sprite import is handled by Rust rather than browser code. The importer validates the file header, 32 MB size limit, 1,024 px dimensions, total pixel count, frame count, and layer count before decoding. It preserves frame order and duration, image-layer visibility and opacity, linked or compressed cel results, palette colors, and supported color mode. Group containers are omitted while their child artwork remains available. Browser builds explain that binary import requires the desktop app.

## Godot projects

Use **Godot Bridge** from Home, File, or Export in the desktop app to connect a project root or scan a parent folder for multiple projects. The bridge remembers local connections, browses and searches their `res://` resources, creates asset folders, and opens supported PNG, Aseprite, or `.zakape` resources as regular Zakape documents.

With a canvas open, browse to a destination and publish either the current frame or an animation bundle. Animation output includes a horizontal PNG sheet and a Godot 4 `SpriteFrames` resource with AtlasTexture regions and preserved frame delays; an editable `.zakape` source copy is optional. Existing paths are listed before replacement and require explicit confirmation. Detailed compatibility and validation limits are documented in `docs/godot-integration.md`.

Use **File → Projects** to reopen the launcher without closing the active document. **File → New sprite**, **Open project**, and **Save project** expose the corresponding keyboard-friendly actions.

## Open documents

The permanent, non-dismissible **Home** tab sits before every project. It collects recent work with real first-frame artwork, the in-app changelog, project and frame activity, workspace location, local-save status, workflow reminders, and direct paths to new and imported sprites.

Every opened project gets a document tab above the project title and export bar on desktop. Phone and tablet layouts move the same tab strip beneath the timeline where it remains reachable without competing with canvas controls. Opening or creating another sprite keeps the current sprite available, and each document preserves its active frame, active layer, undo/redo history, and dirty state. Use **Ctrl+Tab** and **Ctrl+Shift+Tab** to move between project tabs on keyboard devices, **Ctrl+W** to request closing the current project tab, or right-click a project tab for document-local actions. Zakape confirms the request and saves the project before removing its tab. Touch layouts hide keyboard-only shortcut badges and the shortcut guide.

The first project opened on a device presents a four-step editor tour. It explains tools and their shortcuts, independent layers, timeline operations, and the optional assistant drawer. The completed state is stored as a non-secret local preference. Use the Help menu to show the guided tour again or open the complete keyboard command map.

The application close control and the operating system's native close request use the same guarded flow. Zakape lists how many projects will be saved and only exits after explicit confirmation. Canceling returns focus to the control that opened the dialog.

## Timeline order

Drag any frame directly into a new playback sequence. On touch screens, press and hold a frame for 400 ms, then drag it. A violet insertion line shows whether the frame will land before or after its target. The frame menu also exposes **Move frame left** and **Move frame right**; use **Ctrl+Left Arrow** or **Ctrl+Right Arrow** to move the active frame directly. Reordering keeps each frame's cel data and duration attached to its frame ID and creates one undo checkpoint.

Use the arrow beside **Timeline** to collapse the frame strip when the canvas needs more room. Open a frame's action menu to set its delay from 40 to 10,000 milliseconds. Timing stays attached to the frame when it is rearranged, copied, saved, or exported.

## Canvas palette, preview, and layers

The compact strip below the canvas shows the active project's color blocks instead of implementation-oriented cel status. Choosing a block makes it the primary drawing color. The color-mode and sRGB readout stays at the opposite edge on larger screens.

Live Preview floats over the canvas, so it remains visible on phones without opening another panel. The **Live view** toggle sits directly beside **Onion skin** in the canvas toolbar and shows or hides that preview without changing playback or frame timing. The preview itself contains only playback and canvas information; per-frame delay belongs to each frame's context menu. Layers and the optional Assistant live in matching hideable drawers on desktop, tablet, and phone. The desktop drawer leaves the rest of the editor interactive; touch layouts use a dismissible scrim. These surfaces and the Timeline use neutral charcoal glass with a restrained violet edge, leaving the accent for active controls and selection.

The standard animation term **onion skin** labels the previous-frame drawing guide throughout the interface and keyboard guide.

## Custom window chrome

Desktop builds use a frameless Tauri window. Zakape's own 36 px titlebar owns:

- the current Zakape icon, application name, and project title on the left
- File, Edit, View, and Help menus
- the draggable empty region and double-click maximize behavior
- circular minimize, maximize/restore, and close controls on the right

The titlebar remains visible over the splash and project launcher so the window can always be moved or closed. Only each traffic-light circle reacts visually to hover or focus; the larger button hit target remains transparent. Browser builds render the same layout but do not attempt native window operations.
