# Project workspace

Zakape opens with a short branded splash, then presents the project launcher as a modal over the workbench. The workbench remains structurally visible, while the launcher keeps project selection and document creation separate from drawing. It cannot be dismissed until a real document is open.

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
- import a `.zakape` file, which is copied into the working directory on save
- confirm the resolved desktop working-directory path

Use **File → Projects** to reopen the launcher without closing the active document. **File → New sprite**, **Open project**, and **Save project** expose the corresponding keyboard-friendly actions.

## Open documents

Every opened project gets a document tab above the project title and export bar. Opening or creating another sprite keeps the current sprite available, and each document preserves its active frame, active layer, undo/redo history, and dirty state. Use **Ctrl+Tab** and **Ctrl+Shift+Tab** to move between tabs, **Ctrl+W** to request closing the current tab, or right-click a document tab for document-local actions. Zakape confirms the request and saves the project before removing its tab.

The application close control and the operating system's native close request use the same guarded flow. Zakape lists how many projects will be saved and only exits after explicit confirmation. Canceling returns focus to the control that opened the dialog.

## Timeline order

Enable **Arrange** in the timeline header to drag frames into a new playback sequence. A mint insertion line shows whether the frame will land before or after its target. The frame menu also exposes **Move frame left** and **Move frame right**; use **Ctrl+Left Arrow** or **Ctrl+Right Arrow** to move the active frame directly. Reordering keeps each frame's cel data and duration attached to its frame ID and creates one undo checkpoint.

## Custom window chrome

Desktop builds use a frameless Tauri window. Zakape's own 36 px titlebar owns:

- the application and current project title on the left
- File, Edit, View, and Help menus
- the draggable empty region and double-click maximize behavior
- circular minimize, maximize/restore, and close controls on the right

The titlebar remains visible over the splash and project launcher so the window can always be moved or closed. Only each traffic-light circle reacts visually to hover or focus; the larger button hit target remains transparent. Browser builds render the same layout but do not attempt native window operations.
