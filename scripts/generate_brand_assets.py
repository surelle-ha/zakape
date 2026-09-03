"""Build reproducible Zakape banner and web icon assets from the canonical artwork."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / "assets" / "brand"
WIDTH, HEIGHT = 1024, 500

INK = (15, 13, 23)
IRIS = (139, 92, 246)
LILAC = (196, 181, 253)
ORCHID = (217, 70, 239)
TEXT = (247, 243, 255)
MUTED = (173, 163, 190)

PIXEL_GLYPHS = {
    "A": ("01110", "10001", "10001", "11111", "10001", "10001", "10001"),
    "E": ("11111", "10000", "10000", "11110", "10000", "10000", "11111"),
    "K": ("10001", "10010", "10100", "11000", "10100", "10010", "10001"),
    "P": ("11110", "10001", "10001", "11110", "10000", "10000", "10000"),
    "Z": ("11111", "00001", "00010", "00100", "01000", "10000", "11111"),
}


def load_font(name: str, size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    for candidate in (
        Path("C:/Windows/Fonts") / name,
        Path("/usr/share/fonts/truetype/dejavu") / name,
    ):
        if candidate.exists():
            return ImageFont.truetype(candidate, size=size)
    return ImageFont.load_default(size=size)


def draw_pixel_word(draw: ImageDraw.ImageDraw, word: str, origin: tuple[int, int]) -> None:
    pixel = 9
    gap = 8
    glyph_width = pixel * 5
    x_origin, y_origin = origin
    for glyph_index, character in enumerate(word):
        glyph = PIXEL_GLYPHS[character]
        x = x_origin + glyph_index * (glyph_width + gap)
        for row, line in enumerate(glyph):
            for column, enabled in enumerate(line):
                if enabled == "1":
                    fill = TEXT if row < 5 else LILAC
                    draw.rectangle(
                        (
                            x + column * pixel,
                            y_origin + row * pixel,
                            x + (column + 1) * pixel - 1,
                            y_origin + (row + 1) * pixel - 1,
                        ),
                        fill=fill,
                    )


def build_banner() -> Image.Image:
    canvas = Image.new("RGB", (WIDTH, HEIGHT), INK)
    pixels = canvas.load()
    for y in range(HEIGHT):
        for x in range(WIDTH):
            mix = (x / WIDTH) * 0.7 + (y / HEIGHT) * 0.3
            pixels[x, y] = (
                round(15 + 17 * mix),
                round(13 + 10 * mix),
                round(23 + 25 * mix),
            )

    glow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.ellipse((600, 24, 1070, 494), fill=(*IRIS, 108))
    glow = glow.filter(ImageFilter.GaussianBlur(88))
    canvas = Image.alpha_composite(canvas.convert("RGBA"), glow)

    draw = ImageDraw.Draw(canvas)
    for x in range(0, WIDTH, 32):
        draw.line((x, 0, x, HEIGHT), fill=(47, 36, 68, 255), width=1)
    for y in range(0, HEIGHT, 32):
        draw.line((0, y, WIDTH, y), fill=(47, 36, 68, 255), width=1)

    draw.polygon(((610, 0), (1024, 0), (1024, 500), (720, 500)), fill=(13, 11, 21, 255))
    draw.rectangle((0, 0, 10, HEIGHT), fill=IRIS)
    draw.rectangle((10, 0, 14, HEIGHT), fill=ORCHID)

    mono = load_font("consolab.ttf", 17)
    body = load_font("segoeui.ttf", 18)
    body_bold = load_font("segoeuib.ttf", 19)

    draw.rounded_rectangle((66, 58, 312, 91), radius=4, fill=(47, 30, 77, 255), outline=IRIS)
    draw.text((81, 66), "OPEN-SOURCE PIXEL WORKBENCH", font=mono, fill=LILAC)

    draw_pixel_word(draw, "ZAKAPE", (66, 137))
    draw.text((67, 226), "Draw frame by frame.", font=body_bold, fill=TEXT)
    draw.text((67, 255), "Assist only when invited.", font=body, fill=MUTED)

    capabilities = ("DRAW", "ANIMATE", "EXPORT", "LOCAL AI")
    x = 67
    for index, label in enumerate(capabilities):
        color = (IRIS, LILAC, ORCHID, TEXT)[index]
        draw.rectangle((x, 327, x + 8, 335), fill=color)
        draw.text((x + 17, 321), label, font=mono, fill=MUTED)
        x += (96, 126, 112, 0)[index]

    draw.line((67, 393, 527, 393), fill=(81, 68, 102), width=1)
    draw.text((67, 410), "DESKTOP  /  TABLET  /  PHONE", font=mono, fill=(131, 120, 151))

    base = Image.open(BRAND / "zakape-base.png").convert("RGBA")
    base.thumbnail((366, 366), Image.Resampling.LANCZOS)
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle((642, 81, 1008, 447), radius=72, fill=(0, 0, 0, 155))
    shadow = shadow.filter(ImageFilter.GaussianBlur(22))
    canvas = Image.alpha_composite(canvas, shadow)
    canvas.alpha_composite(base, (626, 63))

    mark = Image.open(BRAND / "zakape-icon.png").convert("RGBA")
    mark.thumbnail((66, 66), Image.Resampling.LANCZOS)
    canvas.alpha_composite(mark, (935, 16))

    draw = ImageDraw.Draw(canvas)
    draw.rectangle((603, 52, 611, 60), fill=IRIS)
    draw.rectangle((587, 68, 595, 76), fill=LILAC)
    draw.rectangle((603, 84, 611, 92), fill=ORCHID)
    return canvas.convert("RGB")


def main() -> None:
    banner = build_banner()
    banner.save(BRAND / "zakape-banner.png", optimize=True)
    web_icon = Image.open(BRAND / "zakape-base.png").convert("RGBA")
    web_icon.thumbnail((192, 192), Image.Resampling.LANCZOS)
    for public in (ROOT / "apps" / "studio" / "public", ROOT / "apps" / "site" / "public"):
        web_icon.save(public / "icon.png", optimize=True)


if __name__ == "__main__":
    main()
