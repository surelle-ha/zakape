# Starting color palettes

Zakape lets an artist choose a starting palette while creating a sprite. The palette belongs to the project, appears below the canvas as clickable color blocks, and is available to drawing tools and the optional art assistant. It does not lock RGBA projects to those colors; Indexed projects quantize edits to the closest project color.

## Included palettes

| Palette        | Colors | Intended use                                                         |
| -------------- | -----: | -------------------------------------------------------------------- |
| Zakape Violet  |      8 | A compact violet ramp aligned with the application identity.         |
| PICO-8         |     16 | High-contrast fantasy-console work and readable game objects.        |
| Sweetie 16     |     16 | General game art with balanced warm, green, blue, and neutral ramps. |
| DawnBringer 16 |     16 | Restrained scenes that need useful earth tones in a small budget.    |
| Endesga 32     |     32 | Larger sprites and environments that need broader material ramps.    |
| Game Boy BGB   |      4 | Strict four-value monochrome handheld studies.                       |

The PICO-8, Sweetie 16, DawnBringer 16, Endesga 32, and Game Boy BGB values were checked against their corresponding [Lospec palette entries](https://lospec.com/palette-list). Direct references: [PICO-8](https://lospec.com/palette-list/pico-8), [Sweetie 16](https://lospec.com/palette-list/sweetie-16), [DawnBringer 16](https://lospec.com/palette-list/dawnbringer-16), [Endesga 32](https://lospec.com/palette-list/endesga-32), and [Nintendo Gameboy BGB](https://lospec.com/palette-list/nintendo-gameboy-bgb). Values are stored as six-digit hex colors and normalized before project creation.

## Custom palettes

Selecting **Custom** starts from Zakape Violet. The artist can open Zakape's color mixer, add the edited color, and remove colors from the set. Duplicate and invalid values are discarded, at least one color must remain, and projects accept no more than 256 colors. The workflow never invokes the browser or operating system's native color dialog.
