# -*- coding: utf-8 -*-
"""CLI: normalize project text files to UTF-8 (no BOM, LF).

Usage:
  python scripts/ensure-utf8.py
  python scripts/ensure-utf8.py --check
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))

from ensure_utf8_lib import repair_file  # noqa: E402

TEXT_SUFFIXES = {".html", ".css", ".js", ".md", ".json", ".txt", ".svg", ".mjs", ".cjs", ".yml", ".yaml"}
SKIP_DIRS = {"node_modules", ".git", "dist", "build", ".wrangler"}


def iter_text_files():
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file():
            continue
        if any(part in SKIP_DIRS for part in path.parts):
            continue
        if path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        yield path


def main(argv: list[str]) -> int:
    check_only = "--check" in argv
    fixed = 0
    checked = 0
    dirty: list[str] = []

    for path in iter_text_files():
        checked += 1
        changed, notes = repair_file(path) if not check_only else (False, [])
        if check_only:
            raw = path.read_bytes()
            if raw.startswith(b"\xef\xbb\xbf"):
                dirty.append(f"{path.relative_to(ROOT)} (BOM)")
                continue
            try:
                raw.decode("utf-8")
            except UnicodeDecodeError as exc:
                dirty.append(f"{path.relative_to(ROOT)} ({exc})")
            continue

        if changed:
            fixed += 1
            rel = path.relative_to(ROOT)
            extra = f" ({', '.join(notes)})" if notes else ""
            print(f"fixed {rel}{extra}")

    if check_only:
        if dirty:
            print("UTF-8 check failed:")
            for line in dirty:
                print(" -", line)
            return 1
        print(f"UTF-8 check OK ({checked} files)")
        return 0

    print(f"checked={checked} fixed={fixed}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
