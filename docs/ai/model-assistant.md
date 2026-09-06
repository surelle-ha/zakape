# Connect the model assistant

Zakape's optional assistant can inspect rendered artwork, plan a focused pixel-art change, and propose bounded editor operations. Drawing, animation, project storage, and export remain fully available without a model.

Zakape supports three model sources:

- **Ollama** runs an installed model on the same device and is the desktop default.
- **Compatible API** connects directly to a local or hosted endpoint that provides OpenAI-compatible model-list and chat-completion routes.
- **Codex CLI** is a desktop-only adapter that uses an installed Codex command line and its existing ChatGPT or API-key sign-in.

All three sources use the same skills, project context, validation, in-memory review loop, and user-controlled apply step. Zakape can save the provider, base URL, model name, and vision preference. It keeps compatible-provider API keys only in memory for the current session.

## Choose an art skill

Select one skill before writing the request. A skill supplies focused art direction and chooses a sensible initial edit scope; the scope remains under your control.

- **Generate** builds a readable sprite or prop from a clear silhouette, limited palette, and one light direction.
- **Animate** develops key poses and intentional frame timing while preserving volume and landmarks.
- **Inbetween** bridges existing poses with controlled arcs and spacing.
- **Restyle** changes palette, outline, shading, or texture language without changing the subject or native pixel scale.
- **Fix** makes the smallest repair to silhouette, clusters, palette, timing, or frame consistency.
- **Extend** adds compatible details, effects, frames, or layers without flattening the original work.

These are prompt-level capabilities, not separate downloaded models. Provider adapters remain interchangeable.

## Let the assistant see its work

**Rendered vision** is enabled by default. Before each model pass, Zakape renders the current in-memory project clone to PNG with nearest-neighbor integer scaling and no smoothing. A frame edit includes the active frame and, when available, nearby or newly created frames. An entire-sheet edit samples the timeline in order and always includes the active frame.

Vision input is bounded to four PNGs, 2,097,152 decoded pixels, an eight-megabyte native payload, a maximum 512-pixel preview side, and an integer scale no greater than 8x. The model also receives indexed native-resolution grids, which remain the coordinate and palette source of truth. Disable rendered vision in the connection dialog when a text-only model is in use.

Each request runs as a bounded two- or three-pass session:

1. The model receives the chosen skill, prompt, canvas metadata, palette, timing, editable-layer grids, reference context, and rendered PNGs.
2. Zakape validates the response and applies it to an in-memory project clone. The open project is untouched.
3. Zakape renders the updated clone again. The model inspects the actual result and returns only incremental corrections.
4. A third pass runs only when the second pass reports more cleanup is needed.
5. The combined proposal stays behind **Apply work** and becomes one undo step.

## Safe editor tools

The model does not control pointer input or write arbitrary project data. It returns a small JSON edit language:

- `set_pixels` places or erases exact bounded pixels.
- `fill_rect` fills a genuinely rectangular region.
- `outline_rect` draws a one-pixel rectangular outline.
- `replace_palette_color` replaces one exact color in one editable cel.
- `translate_region` moves or copies a rectangular region by an integer offset.
- `flip_region` mirrors a bounded region horizontally or vertically.
- `create_layer` adds a named transparent layer across the timeline.
- `create_frame` inserts a blank or copied frame at a validated position.
- `set_frame_duration` changes the hold of an editable frame.

Zakape rejects unknown operations, malformed colors, out-of-bounds regions or destinations, excessive pixels or operations, duplicate or unsafe generated IDs, invalid durations, unavailable layers, and edits to reference-only frames. New layers and frames become editable only after their creation action passes validation. The model never applies a proposal by itself.

## Use Ollama on this device

1. Install Ollama from the [Ollama download page](https://ollama.com/download).
2. Start Ollama. Its standard local address is `http://127.0.0.1:11434`.
3. Install a vision-capable model that follows structured JSON instructions. A text-only model can still use indexed grids when rendered vision is disabled.
4. In Zakape, open **Assist**, open model settings, and select **Ollama**.
5. Select **Find models**, choose an installed model, and save.

The packaged desktop app uses a native loopback bridge and does not require `OLLAMA_ORIGINS=*`. The bridge accepts only `http` or `https` on `127.0.0.1`, `localhost`, or `[::1]`, appends fixed Ollama routes, refuses redirects and proxies, and enforces request limits. A browser development build calls Ollama directly; allow only the exact local development origin if Ollama rejects it.

Zakape does not install, start, stop, or update Ollama. Start the Ollama application or run `ollama serve` when discovery reports that it is offline.

## Use a compatible local or hosted API

1. Select **Compatible API**.
2. Enter the endpoint's base URL and model ID.
3. Enter an API key when the endpoint requires one, then test and save.

Remote providers must use HTTPS. Plain HTTP is accepted only for `localhost`, `127.0.0.1`, or `[::1]`. URLs containing embedded credentials, a query, or a fragment are rejected, and redirects are not followed. The endpoint must expose `/models` and `/chat/completions`; vision requires support for OpenAI-compatible image data URLs. If a provider accepts only text, disable rendered vision.

Requests travel directly from this device to the configured endpoint. The provider receives the prompt, supplied project context, and any rendered previews, so its terms and privacy practices apply.

## Use Codex CLI with an existing ChatGPT sign-in

Codex CLI is the supported bridge to a local ChatGPT/Codex account session. The ChatGPT desktop application itself does not expose a local model API that Zakape can safely call.

1. Install a current Codex CLI and run `codex login` in a terminal.
2. In the Zakape desktop app, select **Codex CLI** and **Check Codex**.
3. Optionally enter a model override. Leave it blank to use the current Codex default.
4. Save the connection and send an assistant request.

Zakape discovers only the native `codex` executable, checks its version, structured-output support, image-input support, and login status, and starts it directly without a command shell. Each pass uses a fresh temporary directory, ephemeral session, fixed response schema, read-only sandbox, three-minute timeout, and no repository trust. User configuration and instruction files are ignored. Shell execution, subagents, web search, remote plugins, dependency installation, login-shell behavior, and Codex's file image-viewer tool are disabled for this adapter. Only the prompt and Zakape-rendered PNG attachments are staged, and temporary files are removed when the pass ends.

The request is still processed by the service associated with the Codex login; it is not an offline model. OpenAI or another configured Codex provider's terms and data controls apply.

## Choose what may change

- **This frame** targets the active frame. Neighboring frames may be sent as read-only visual references.
- **Entire sheet** targets every frame in timeline order so pose, palette, lighting, attached details, and motion can be reviewed together.

The proposal card reports the chosen skill, pass count, operation count, affected frames, created frames or layers, timing changes, and recent audit notes. Nothing changes until you select **Apply work**.

## Write a useful request

Name the visual problem, intended result, and invariants. For example:

> Fix the shoulder silhouette. Remove isolated one-pixel bumps, preserve the character width and mint palette, and do not change the face.

> Animate a four-pose run. Keep the spark two pixels from the raised hand, preserve the yellow highlight ramp, and shorten the contact-frame holds.

Avoid prompts such as “make it better.” See [Sprite art direction](sprite-art-direction.md) for the craft rules supplied to every connected model.

## Data and architecture boundaries

- Credentials are not written to the project database or `.zakape` files.
- Chat history is stored per project in on-device PGlite preferences, capped to the latest 100 entries, and excluded from exported project files.
- Ollama requests stay on the device unless that local runtime is independently configured otherwise.
- Compatible API requests go directly to the configured provider.
- Codex requests use the account already authenticated in Codex CLI.
- Zakape has no hosted model proxy or telemetry in this release.

A future dedicated Zakape model can implement the same provider-neutral skill, vision, and tool contract without changing the editor's validated operation layer.
