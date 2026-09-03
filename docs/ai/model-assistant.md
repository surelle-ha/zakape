# Connect the model assistant

This guide explains how to connect Zakape to a model and how Zakape limits that connection. Sprite editing remains fully available without a model. You can use Ollama or a compatible application programming interface (API).

Zakape supports two connection modes:

- **Ollama**: Runs an installed model on the same device. The desktop app selects this mode by default.
- **Compatible API**: Connects directly to an endpoint you supply. The endpoint must support model listing and OpenAI-compatible chat completions.

Zakape can save the provider, base URL, and model name. It keeps API keys in memory for the current session.

## Use Ollama on this device

1. Install Ollama for your operating system from the [Ollama download page](https://ollama.com/download).
2. Start Ollama. The standard local address is `http://127.0.0.1:11434`.
3. Install a text model capable of following JavaScript Object Notation (JSON) instructions, for example:

   ```sh
   ollama pull qwen2.5-coder:7b
   ```

4. In Zakape, select **Assist** or press **A**, select the small model-management button in the assistant header, and keep **Ollama** selected.
5. Select **Find models**, choose an installed model, and save the settings.

Model size alone does not guarantee good pixel art. Choose a model that reliably follows structured JSON instructions. Zakape supplies native-resolution art constraints, canvas grids, editable-layer grids, palette budgets, frame timing, and animation context at request time; it does not fine-tune or retrain the installed model.

The packaged desktop app talks to Ollama through a native loopback bridge, so it does not require `OLLAMA_ORIGINS=*`. A browser development build calls Ollama directly; if Ollama rejects that browser origin, allow only the exact local development origin instead of using a wildcard.

Zakape does not install, start, stop, or update Ollama. If discovery reports that Ollama is unavailable, start the Ollama application or `ollama serve`, then select **Find models** again. If no models appear, install one with `ollama pull model_name`.

## How agentic review works

Each request runs as a bounded two- or three-pass art session:

1. The model receives the native-resolution composite, editable layer, palette, timing, and selected scope, then produces a first draft as structured operations.
2. Zakape validates and applies that draft to an in-memory project clone. The open project is still untouched.
3. The model receives the updated composite and editable-layer grids, audits its visible result at native size, and returns only incremental corrections.
4. Zakape repeats once more only when the second pass reports that more cleanup is needed. The final combined proposal remains behind **Apply work** and becomes one undo step.

The assistant can create a blank layer or insert/copy a frame when the request needs one. New IDs, insertion anchors, copy sources, durations, editable layer IDs, frame scope, operation counts, coordinates, and colors are all validated before the in-memory render. The model never operates the editor directly.

## How Zakape limits model access

The model never receives filesystem or shell access. Zakape sends canvas dimensions, palette, indexed composite pixels, and separate indexed grids for layers made editable during the session. A one-frame request also includes neighboring frames as read-only visual references. An entire-sheet request includes every animation frame as an editable target. Zakape asks for JSON in a small edit language and validates frame and layer IDs, dimensions, color strings, operation counts, and coordinates before you preview or apply a proposal.

The desktop Ollama transport is deliberately narrow:

- The bridge accepts only `http` or `https` addresses on `127.0.0.1`, `localhost`, or `[::1]`.
- The bridge calls only Ollama's model-list and chat routes.
- The bridge cannot proxy requests to a local-network or internet host.
- The bridge enforces message-count and payload-size limits before making a request.

Supported edit operations:

- `set_pixels`: set a bounded list of coordinates to palette colors or transparency
- `fill_rect`: fill a clipped rectangle
- `outline_rect`: draw a clipped rectangular outline
- `replace_palette_color`: replace one exact color in the active cel

Supported project actions:

- `create_layer`: add a named layer with fresh transparent cels
- `create_frame`: insert a named, timed frame, either blank or copied from a validated source frame

Zakape rejects unknown operations or actions, edits to reference-only frames, edits to unavailable layers, unsafe new IDs, and malformed responses. A session begins on the selected layer and may additionally edit only layers it created. Applying a one-frame or entire-sheet proposal creates one undo checkpoint.

## Choose what the assistant may edit

The **Edit scope** control appears before the prompt:

- **This frame** targets the current frame. The previous and next animation frames are supplied only as visual references and cannot be edited by the response.
- **Entire sheet** makes every frame in timeline order available, keeping proportions, lighting, palette, and attached details consistent while preserving the motion between poses.

The review card reports its pass count, operation count, affected frames, new frames or layers, and the model's visual-audit notes. No project changes until you select **Apply work**.

## Ask for stronger art direction

Describe the visual problem, the intended result, and what must remain stable. Concrete prompts give the model a better target than broad requests.

Prefer:

> Clean the outer silhouette around the shoulders. Remove isolated one-pixel bumps, keep the character's width and mint palette, and preserve the face.

> Across the entire sheet, keep the spark two pixels from the raised hand. Preserve the run-cycle poses and use the existing yellow highlight ramp.

Avoid prompts such as “make it better” or “make it cool.” The assistant cannot infer an art direction that was never specified. See [Sprite art direction](sprite-art-direction.md) for the craft rules Zakape gives every connected model.

## How Zakape handles connection data

- Credentials are not written to the project database or `.zakape` files.
- Chat history is stored per project in the on-device PGlite preferences table and is capped to the latest 100 entries. It is not embedded in exported project files.
- Ollama requests stay on your device unless you independently configure the model or environment to use another service.
- Compatible API requests go directly from your device to the configured provider.
- Your prompt and canvas content follow the configured provider's policy. The connection dialog states this before use.
- Zakape has no hosted proxy or telemetry in the initial release.

## How providers produce edit proposals

Both connection modes produce the same validated, frame-addressed art-operation proposal. Ollama receives a strict response schema and a larger context window for animation grids. Zakape can add provider adapters, image references, and encrypted operating-system keychain storage without changing the editor operation model.
