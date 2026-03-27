#!/usr/bin/env python3
"""Download an MLC model snapshot from Hugging Face. Requires: pip install huggingface_hub"""
from __future__ import annotations

import sys
from pathlib import Path


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: hf_download.py <repo_id> <local_dir>", file=sys.stderr)
        sys.exit(1)
    repo_id = sys.argv[1]
    dest = Path(sys.argv[2])
    try:
        from huggingface_hub import snapshot_download
    except ImportError:
        print("Missing huggingface_hub. Install with: pip install huggingface_hub", file=sys.stderr)
        sys.exit(2)
    dest.parent.mkdir(parents=True, exist_ok=True)
    snapshot_download(repo_id=repo_id, local_dir=str(dest), local_dir_use_symlinks=False)
    print("Downloaded", repo_id, "->", dest)


if __name__ == "__main__":
    main()
