# Model assistant design

The assistant is optional and provider-neutral. Zakape connects to an OpenAI-compatible chat-completions endpoint supplied by the user. The base URL and model name may be persisted; the API key remains in memory for the current session.

## Trust boundary

The model never receives filesystem or shell access. Zakape sends canvas dimensions, palette, and a compact representation of the active cel. It asks for JSON in a small edit language. The client validates dimensions, color strings, operation counts, and coordinates before a proposal can be previewed or applied.

Initial operations:

- `set_pixels`: set a bounded list of coordinates to palette colors or transparency.
- `fill_rect`: fill a clipped rectangle.
- `outline_rect`: draw a clipped rectangular outline.
- `replace_palette_color`: replace one exact color in the active cel.

Unknown operations and malformed responses are rejected. Applying a proposal creates one undo checkpoint.

## Privacy behavior

- Credentials are not written to the project database or `.zakape` files.
- Requests go directly from the user's device to the configured provider.
- Prompt/canvas content is subject to that provider's policy; the connection dialog must say so before use.
- Zakape has no hosted proxy or telemetry in the initial release.

## Future providers

The connection type is intentionally generic. Provider-specific adapters, local model discovery, image-capable references, structured-output dialects, and encrypted OS keychain storage can be added without changing the editor operation model.
