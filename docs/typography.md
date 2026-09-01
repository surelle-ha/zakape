# Typography research

Zakape uses **Bricolage Grotesque Variable** for the interface and **Azeret Mono Variable** for precision labels. Both font families are packaged with the application through Fontsource; the desktop UI does not fetch fonts from a CDN.

## Selection

The interface needed a typeface with more authorship than a neutral product sans, without turning every label into a pixel-font novelty. Bricolage Grotesque has expressive proportions and variable optical-size, width, and weight axes, which give headings and compact controls a hand-shaped character while remaining readable in a dense editor.

Azeret Mono is intentionally quieter. Its fixed-width forms keep dimensions, frame delays, percentages, shortcuts, status text, and AI operation counts aligned. The contrast between the two families also makes technical metadata visually distinct from actions and document names.

## Candidates reviewed

- **Bricolage Grotesque**: selected for interface and display text; expressive but still practical at editor scale.
- **Azeret Mono**: selected for technical labels and numeric alignment.
- **Syne**: strong personality, but its display-first construction is less comfortable across dense controls.
- **Recursive**: flexible axes and a useful mono mode, but the breadth of stylistic controls would add tuning complexity without a clearer hierarchy.
- **Oxanium**: energetic and game-adjacent, but too thematic for every workbench label.
- **Pixelify Sans**: appropriate for occasional artwork, but using it throughout would reduce small-text legibility and make the interface feel ornamental.

The comparison used the official Google Fonts family metadata available on 1 September 2026. The metadata identifies Bricolage Grotesque as a sans-serif variable family with optical-size, width, and weight axes; Azeret Mono is categorized as monospace with a weight axis. Package metadata and font files come from the corresponding Fontsource variable-font packages.

## Usage rules

- Use Bricolage Grotesque for navigation, menus, document names, actions, descriptions, and headings.
- Use Azeret Mono for dimensions, frame numbers and delays, shortcut hints, status output, field kickers, and machine-oriented values.
- Keep pixel lettering inside artwork and brand marks rather than applying a novelty pixel font to paragraph text.
- Preserve local font bundling for deterministic screenshots and offline desktop use.

Sources:

- [Google Fonts metadata](https://fonts.google.com/metadata/fonts)
- [Bricolage Grotesque on Fontsource](https://fontsource.org/fonts/bricolage-grotesque)
- [Azeret Mono on Fontsource](https://fontsource.org/fonts/azeret-mono)
