#!/usr/bin/env python3
"""
Generate room images for Scott Adams adventures using SDXL Turbo.

Usage:
    python3 generate_images.py adv01          # Generate images for Adventureland
    python3 generate_images.py adv05          # Generate images for The Count
    python3 generate_images.py adv01 adv02    # Generate multiple games
    python3 generate_images.py --all          # Generate all games (slow!)

Requirements:
    pip install torch diffusers transformers accelerate

The script reads prompts from image_guides/<game>_*.md files and generates
512x320 PNG images into images/<game>/room_NN.png.

On Apple Silicon Mac, uses MPS (Metal). On Linux/Windows with NVIDIA, uses CUDA.
Falls back to CPU if neither is available (very slow).
"""
import sys
import os
import re
import glob
import torch
from diffusers import AutoPipelineForText2Image

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
GUIDES_DIR = os.path.join(SCRIPT_DIR, "image_guides")
IMAGES_DIR = os.path.join(SCRIPT_DIR, "images")
STYLE = ", retro 1980s adventure game illustration, fantasy art, moody lighting, detailed"


def parse_guide(md_path):
    """Parse an image guide .md file, return dict of {room_num: description}."""
    rooms = {}
    with open(md_path) as f:
        for line in f:
            # Match table rows like: | `adv01/room_23.png` | Room name | Description |
            m = re.match(r'\|\s*`\w+/room_(\d+)\.png`\s*\|[^|]*\|\s*(.+?)\s*\|', line)
            if m:
                num = int(m.group(1))
                desc = m.group(2).strip()
                if desc.lower() != '*skip*':
                    rooms[num] = desc
    return rooms


def find_guide(game_id):
    """Find the image guide file for a game ID like 'adv01'."""
    pattern = os.path.join(GUIDES_DIR, f"{game_id}_*.md")
    matches = glob.glob(pattern)
    if matches:
        return matches[0]
    # Try exact match
    exact = os.path.join(GUIDES_DIR, f"{game_id}.md")
    if os.path.exists(exact):
        return exact
    return None


def get_device():
    """Pick the best available device."""
    if torch.backends.mps.is_available():
        return "mps"
    elif torch.cuda.is_available():
        return "cuda"
    else:
        print("WARNING: No GPU found, using CPU (will be very slow)")
        return "cpu"


def generate_game(pipe, game_id):
    """Generate all room images for one game."""
    guide = find_guide(game_id)
    if not guide:
        print(f"ERROR: No image guide found for '{game_id}' in {GUIDES_DIR}/")
        print(f"  Expected file matching: {game_id}_*.md")
        return False

    rooms = parse_guide(guide)
    if not rooms:
        print(f"ERROR: No room descriptions found in {guide}")
        return False

    out_dir = os.path.join(IMAGES_DIR, game_id)
    os.makedirs(out_dir, exist_ok=True)

    print(f"\n{'='*60}")
    print(f"Generating {len(rooms)} images for {game_id}")
    print(f"  Guide: {os.path.basename(guide)}")
    print(f"  Output: {out_dir}/")
    print(f"{'='*60}")

    for room_num, desc in sorted(rooms.items()):
        fname = os.path.join(out_dir, f"room_{room_num:02d}.png")
        if os.path.exists(fname):
            print(f"  room_{room_num:02d}.png exists, skipping")
            continue
        full_prompt = desc + STYLE
        img = pipe(full_prompt, num_inference_steps=4, guidance_scale=0.0,
                   width=512, height=320).images[0]
        img.save(fname)
        print(f"  room_{room_num:02d}.png done")

    print(f"Done with {game_id}!")
    return True


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        print("Available games:")
        for f in sorted(glob.glob(os.path.join(GUIDES_DIR, "*.md"))):
            game_id = os.path.basename(f).split("_")[0]
            print(f"  {game_id}  ({os.path.basename(f)})")
        sys.exit(1)

    if "--all" in sys.argv:
        game_ids = []
        for f in sorted(glob.glob(os.path.join(GUIDES_DIR, "*.md"))):
            game_ids.append(os.path.basename(f).split("_")[0])
    else:
        game_ids = [a for a in sys.argv[1:] if not a.startswith("-")]

    # Validate all game IDs before loading model
    for gid in game_ids:
        if not find_guide(gid):
            print(f"ERROR: No image guide for '{gid}'")
            sys.exit(1)

    device = get_device()
    print(f"Loading SDXL Turbo on {device}...")
    pipe = AutoPipelineForText2Image.from_pretrained(
        "stabilityai/sdxl-turbo", dtype=torch.float16, variant="fp16"
    )
    pipe = pipe.to(device)
    print("Model loaded.")

    for gid in game_ids:
        generate_game(pipe, gid)

    print(f"\nAll done! Generated images for: {', '.join(game_ids)}")


if __name__ == "__main__":
    main()
