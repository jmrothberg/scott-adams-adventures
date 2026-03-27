#!/usr/bin/env python3
"""
Threaded static file server for local play + WebLLM offline.

`python3 -m http.server` handles one request at a time. While the browser loads
large model shards from webllm-assets/, PNG room images and map thumbnails stall
or fail. This server serves many files in parallel (same as GitHub Pages CDN).

Usage (from repo root):
  python3 scripts/serve-threaded.py 8091
"""
from __future__ import annotations

import argparse
import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class DevStaticHandler(SimpleHTTPRequestHandler):
    """Avoid stale index.html / llm-enhanced.js while iterating locally (browser cache)."""

    def end_headers(self) -> None:
        p = self.path.split("?", 1)[0].lower()
        if p.endswith((".html", ".js", ".mjs")):
            self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()


def main() -> None:
    p = argparse.ArgumentParser(description="Threaded HTTP static server for Scott Adams + WebLLM")
    p.add_argument(
        "port",
        nargs="?",
        type=int,
        default=8090,
        help="Port (default 8090)",
    )
    args = p.parse_args()
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    os.chdir(root)
    server = ThreadingHTTPServer(("", args.port), DevStaticHandler)
    print(f"Serving {root} (threaded) on http://localhost:{args.port}/")
    server.serve_forever()


if __name__ == "__main__":
    main()
