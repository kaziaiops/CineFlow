"""
Step 4 (MANUAL handoff) — Pull the image you generated in Nano Banana Pro and
downloaded locally into the pipeline's naming convention.

Usage:
    # Auto-picks the most recently modified image in config.IMAGE_DOWNLOAD_FOLDER
    python scripts/pipeline/04_ingest_image.py --shot test01

    # Or point at a specific file
    python scripts/pipeline/04_ingest_image.py --shot test01 --file "C:\\path\\to\\actual-filename.png"

Writes: storage/test_pipeline/{shot}/image.png
"""

import argparse
import sys
from pathlib import Path

from PIL import Image

import config


IMAGE_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}


def find_most_recent_image(folder: Path) -> Path:
    if not folder.exists():
        sys.exit(f"Download folder {folder} does not exist. Set IMAGE_DOWNLOAD_FOLDER or pass --file.")

    candidates = [p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_EXTENSIONS]
    if not candidates:
        sys.exit(f"No image files found in {folder}. Download one from Nano Banana Pro first, or pass --file.")

    newest = max(candidates, key=lambda p: p.stat().st_mtime)
    print(f"No --file given — auto-picked most recently modified image in {folder}:")
    print(f"  {newest.name}")
    return newest


def ingest_image(shot_id: str, src: Path) -> None:
    if not src.exists():
        sys.exit(f"{src} does not exist.")

    try:
        with Image.open(src) as im:
            im.verify()
    except Exception as e:
        sys.exit(f"{src} is not a valid image file: {e}")

    dest = config.shot_dir(shot_id) / "image.png"
    with Image.open(src) as im:
        im.convert("RGB").save(dest, format="PNG")

    print(f"Wrote {dest} (from {src})")
    print("Rate it 1-10 yourself; only proceed past this point if it's a 9 or higher.")
    print(f"Next: python scripts/pipeline/05_generate_video_comfyui.py --shot {shot_id}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--shot", required=True)
    p.add_argument(
        "--file",
        default=None,
        help=f"Path to the downloaded image. Omit to auto-pick the most recently "
             f"modified image in {config.IMAGE_DOWNLOAD_FOLDER}.",
    )
    args = p.parse_args()

    src = Path(args.file) if args.file else find_most_recent_image(config.IMAGE_DOWNLOAD_FOLDER)
    ingest_image(args.shot, src)
