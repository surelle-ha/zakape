# Brand assets

Zakape's canonical artwork lives in `assets/brand`. Keep source artwork there rather than at the repository root.

- `zakape-icon.png` is the transparent brush-and-Z mark used inside product surfaces.
- `zakape-base.png` is the square app-icon composition used to generate native and web icons.
- `zakape-app-icon.png` is the generated safe-area composition used by desktop, mobile, web, and store icons.
- `zakape-banner.png` is the 1,024 × 500 feature graphic used by the README and suitable for the Google Play store listing.
- `icon-manifest.json` controls the Tauri icon generator, including Android foreground scaling and background color.

Run `python scripts/generate_brand_assets.py` after changing either source image. It rebuilds the feature graphic, padded app-icon source, web favicons, and F-Droid icon. Rebuild native desktop, Windows, Android, and iOS icon sets with:

```powershell
pnpm --filter @zakape/studio tauri icon ../../assets/brand/icon-manifest.json
```

The application palette is ink `#0f0d17`, iris `#8b5cf6`, lilac `#c4b5fd`, and orchid `#d946ef`. Destructive controls may use a separate warning color, but ordinary selection and focus states use the violet family.
