"""Build reproducible Zakape app and web icon assets from the canonical artwork."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "assets" / "brand"
APP_ICON_SCALE = 0.86


def build_app_icon() -> Image.Image:
    """Inset the supplied composition so operating-system masks never crop its border."""
    source = Image.open(BRAND / "zakape-base.png").convert("RGBA")
    inset_size = round(min(source.size) * APP_ICON_SCALE)
    inset = source.resize((inset_size, inset_size), Image.Resampling.LANCZOS)
    background = Image.new("RGBA", source.size, source.getpixel((0, 0)))
    offset = ((source.width - inset_size) // 2, (source.height - inset_size) // 2)
    background.alpha_composite(inset, offset)
    return background


def main() -> None:
    app_icon = build_app_icon()
    app_icon.save(BRAND / "zakape-app-icon.png", optimize=True)
    web_icon = app_icon.resize((192, 192), Image.Resampling.LANCZOS)
    for public in (ROOT / "apps" / "studio" / "public", ROOT / "apps" / "site" / "public"):
        web_icon.save(public / "icon.png", optimize=True)
    fastlane_icon = app_icon.resize((512, 512), Image.Resampling.LANCZOS)
    fastlane_icon.save(
        ROOT / "fastlane" / "metadata" / "android" / "en-US" / "images" / "icon.png",
        optimize=True,
    )


if __name__ == "__main__":
    main()
