# -*- coding: utf-8 -*-
"""afterFileEdit hook: re-save edited text files as UTF-8 (no BOM, LF)."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))

from ensure_utf8_lib import repair_file  # type: ignore

TEXT_SUFFIXES = {".html", ".css", ".js", ".md", ".json", ".txt", ".svg", ".mjs", ".cjs", ".yml", ".yaml"}


def extract_path(payload: dict) -> Path | None:
    for key in ("file_path", "path", "filePath", "file"):
        val = payload.get(key)
        if isinstance(val, str) and val.strip():
            return Path(val)
    # nested shapes
    for nest in ("file", "edit", "result", "input"):
        obj = payload.get(nest)
        if isinstance(obj, dict):
            p = extract_path(obj)
            if p:
                return p
    return None


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        print("{}")
        return 0

    path = extract_path(payload if isinstance(payload, dict) else {})
    if not path:
        print("{}")
        return 0

    if not path.is_absolute():
        path = (ROOT / path).resolve()

    if path.suffix.lower() not in TEXT_SUFFIXES or not path.is_file():
        print("{}")
        return 0

    try:
        changed, notes = repair_file(path)
    except Exception as exc:
        print(json.dumps({"additional_context": f"UTF-8 repair skipped: {exc}"}))
        return 0

    if changed:
        msg = f"Normalized {path.name} to UTF-8 (no BOM)."
        if notes:
            msg += " " + "; ".join(notes)
        print(json.dumps({"additional_context": msg}))
    else:
        print("{}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
