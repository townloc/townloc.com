"""
Quality-safe image optimization for townloc.
- Backs up each touched file under assets/images/_originals_backup/
- Revert: copy files from backup back over assets/images/
"""
from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
IMG = ROOT / "assets" / "images"
BACKUP = IMG / "_originals_backup"

# Conservative settings — visual quality first
HERO_MAX_W = 2400
HERO_JPEG_Q = 85
LOGO_MAX_W = 400  # ~2.6x of 151px display
FAVICON_MAX = 180
PHOTO_MAX_W = 1400
PHOTO_JPEG_Q = 84
WEBP_RECOMPRESS_MIN_KB = 100
WEBP_Q = 82
WEBP_MAX_W = 1600

SKIP_DIR_NAMES = {"_originals_backup"}


def backup_file(path: Path) -> None:
    rel = path.relative_to(IMG)
    dest = BACKUP / rel
    if dest.exists():
        return  # keep first original only
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, dest)


def load_rgb(path: Path) -> Image.Image:
    im = Image.open(path)
    im = ImageOps.exif_transpose(im)
    if im.mode in ("RGBA", "LA"):
        # photos shouldn't need alpha; composite on white if saving JPEG
        return im
    if im.mode != "RGB":
        return im.convert("RGB")
    return im


def resize_max_w(im: Image.Image, max_w: int) -> Image.Image:
    if im.size[0] <= max_w:
        return im
    h = round(im.size[1] * (max_w / im.size[0]))
    return im.resize((max_w, h), Image.Resampling.LANCZOS)


def save_jpeg(path: Path, im: Image.Image, quality: int) -> None:
    if im.mode != "RGB":
        if im.mode in ("RGBA", "LA"):
            bg = Image.new("RGB", im.size, (255, 255, 255))
            bg.paste(im, mask=im.split()[-1])
            im = bg
        else:
            im = im.convert("RGB")
    im.save(path, format="JPEG", quality=quality, optimize=True, progressive=True)


def save_png(path: Path, im: Image.Image) -> None:
    if im.mode not in ("RGBA", "RGB", "P", "L"):
        im = im.convert("RGBA")
    im.save(path, format="PNG", optimize=True)


def save_webp(path: Path, im: Image.Image, quality: int) -> None:
    if im.mode not in ("RGB", "RGBA"):
        im = im.convert("RGBA" if "A" in im.getbands() else "RGB")
    im.save(path, format="WEBP", quality=quality, method=6)


def optimize_hero() -> tuple[int, int]:
    path = IMG / "home" / "hero-banner.jpg"
    before = path.stat().st_size
    backup_file(path)
    im = load_rgb(path)
    if im.mode != "RGB":
        im = im.convert("RGB")
    im = resize_max_w(im, HERO_MAX_W)
    save_jpeg(path, im, HERO_JPEG_Q)
    after = path.stat().st_size
    print(f"hero: {before/1024:.1f}KB -> {after/1024:.1f}KB  {im.size}")
    return before, after


def optimize_logo() -> tuple[int, int]:
    path = IMG / "townloc-logo.png"
    before = path.stat().st_size
    backup_file(path)
    im = Image.open(path).convert("RGBA")
    im = resize_max_w(im, LOGO_MAX_W)
    save_png(path, im)
    after = path.stat().st_size
    print(f"logo: {before/1024:.1f}KB -> {after/1024:.1f}KB  {im.size}")
    return before, after


def optimize_favicon() -> tuple[int, int]:
    path = IMG / "townloc-favicon.png"
    before = path.stat().st_size
    backup_file(path)
    im = Image.open(path).convert("RGBA")
    # fit longest side to FAVICON_MAX
    w, h = im.size
    scale = FAVICON_MAX / max(w, h)
    if scale < 1:
        im = im.resize((round(w * scale), round(h * scale)), Image.Resampling.LANCZOS)
    save_png(path, im)
    after = path.stat().st_size
    print(f"favicon: {before/1024:.1f}KB -> {after/1024:.1f}KB  {im.size}")
    return before, after


def optimize_photos() -> list[tuple[str, int, int]]:
    results = []
    for path in sorted(IMG.rglob("*")):
        if not path.is_file():
            continue
        if any(part in SKIP_DIR_NAMES for part in path.parts):
            continue
        if path.suffix.lower() not in {".jpg", ".jpeg"}:
            continue
        # skip hero (handled)
        if path.name == "hero-banner.jpg":
            continue
        before = path.stat().st_size
        if before < 80 * 1024:
            continue
        backup_file(path)
        im = load_rgb(path)
        if im.mode != "RGB":
            im = im.convert("RGB")
        im = resize_max_w(im, PHOTO_MAX_W)
        save_jpeg(path, im, PHOTO_JPEG_Q)
        after = path.stat().st_size
        if after >= before:
            shutil.copy2(BACKUP / path.relative_to(IMG), path)
            print(f"jpg skip (no gain): {path.relative_to(IMG).as_posix()}")
            continue
        rel = path.relative_to(IMG).as_posix()
        print(f"jpg {rel}: {before/1024:.1f} -> {after/1024:.1f} KB  {im.size}")
        results.append((rel, before, after))
    return results


def lightly_touch_heavy_webp() -> list[tuple[str, int, int]]:
    """Only recompress unusually heavy webps; most are already small."""
    results = []
    for path in sorted(IMG.rglob("*.webp")):
        if any(part in SKIP_DIR_NAMES for part in path.parts):
            continue
        before = path.stat().st_size
        if before < WEBP_RECOMPRESS_MIN_KB * 1024:
            continue
        backup_file(path)
        im = Image.open(path)
        im = ImageOps.exif_transpose(im)
        if im.mode not in ("RGB", "RGBA"):
            im = im.convert("RGB")
        im = resize_max_w(im, WEBP_MAX_W)
        save_webp(path, im, WEBP_Q)
        after = path.stat().st_size
        # if worse, restore
        if after >= before:
            shutil.copy2(BACKUP / path.relative_to(IMG), path)
            print(f"webp skip (no gain): {path.relative_to(IMG)}")
            continue
        rel = path.relative_to(IMG).as_posix()
        print(f"webp {rel}: {before/1024:.1f} -> {after/1024:.1f} KB")
        results.append((rel, before, after))
    return results


def write_revert_readme() -> None:
    BACKUP.mkdir(parents=True, exist_ok=True)
    text = """# Image originals backup

Created by scripts/optimize-images.py before compression.

## Revert all optimized images

From repo root (PowerShell):

```powershell
Copy-Item -Path "assets\\images\\_originals_backup\\*" -Destination "assets\\images\\" -Recurse -Force
```

Or with Python:

```powershell
python -c "from pathlib import Path; import shutil; b=Path('assets/images/_originals_backup'); r=Path('assets/images');
[shutil.copy2(p, r/p.relative_to(b)) for p in b.rglob('*') if p.is_file()]"
```

Only files that were changed are in this folder (first backup kept).
"""
    (BACKUP / "README.md").write_text(text, encoding="utf-8", newline="\n")


def main() -> None:
    write_revert_readme()
    total_before = 0
    total_after = 0

    for fn in (optimize_hero, optimize_logo, optimize_favicon):
        b, a = fn()
        total_before += b
        total_after += a

    for _, b, a in optimize_photos():
        total_before += b
        total_after += a

    for _, b, a in lightly_touch_heavy_webp():
        total_before += b
        total_after += a

    print("---")
    print(
        f"Touched bytes: {total_before/1024:.0f}KB -> {total_after/1024:.0f}KB "
        f"(saved {(total_before-total_after)/1024:.0f}KB)"
    )
    print(f"Backup: {BACKUP}")


if __name__ == "__main__":
    main()
