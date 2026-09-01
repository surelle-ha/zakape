# Project workspace

Zakape opens in three deliberate stages: a short branded splash, the project home, and the pixel editor. The project home keeps file selection separate from drawing so opening the application never silently changes a sprite.

## Working directory

The packaged desktop app creates a `zakape` folder inside the current user's operating-system Documents directory. Typical locations are:

- Windows: `C:\Users\your_username_here\Documents\zakape`
- macOS: `/Users/your_username_here/Documents/zakape`
- Linux: the Documents directory reported by the desktop environment, followed by `/zakape`

Each project is stored as `project_id.zakape`. The human-readable project name remains inside the JSON file, so renaming a sprite does not orphan a second file.

Zakape's native file bridge is intentionally narrow. The webview can ask to list, read, or write a project ID, but it cannot supply an arbitrary filesystem path. Rust rejects traversal characters, mismatched JSON identities, unsupported project versions, and project files larger than 32 MB.

Before opening a project, the shared parser checks its dimensions, frame and layer IDs, colors, and cel buffer lengths. It also requires at least one frame and layer, so browser imports and desktop restores follow the same project contract.

PGlite keeps an indexed copy for fast autosave and browser development. Desktop project-home results merge the Documents folder with that cache so projects made before the working-directory feature remain accessible and migrate on their next save.

## Project home

From the project home you can:

- create a transparent 16×16, 32×32, or 64×64 sprite
- import a `.zakape` file, which is copied into the working directory on save
- reopen any indexed recent project
- confirm the resolved desktop working-directory path

Use **File → Projects** to leave an open editor without closing Zakape. **File → New sprite**, **Open project**, and **Save project** expose the corresponding keyboard-friendly actions.

## Custom window chrome

Desktop builds use a frameless Tauri window. Zakape's own 36 px titlebar owns:

- the application and current project title on the left
- File, Edit, View, and Help menus
- the draggable empty region and double-click maximize behavior
- circular minimize, maximize/restore, and close controls on the right

The titlebar remains visible over the splash and project home so the window can always be moved or closed. Browser builds render the same layout but do not attempt native window operations.
