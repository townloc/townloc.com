# -*- coding: utf-8 -*-
"""Shared UTF-8 repair helpers (importable by hooks + CLI)."""
from __future__ import annotations

from pathlib import Path

BYTE_FIXES = {
    0x85: "…",
    0x91: "‘",
    0x92: "’",
    0x93: "“",
    0x94: "”",
    0x96: "–",
    0x97: "—",
    0x9D: "—",
    0xA0: "\u00a0",
    0xA9: "©",
    0xAE: "®",
    0xB7: "·",
}


def repair_bytes(raw: bytes) -> tuple[str, list[str]]:
    notes: list[str] = []
    if raw.startswith(b"\xef\xbb\xbf"):
        raw = raw[3:]
        notes.append("stripped BOM")

    try:
        return raw.decode("utf-8"), notes
    except UnicodeDecodeError:
        notes.append("repaired invalid UTF-8 bytes")

    out: list[str] = []
    i = 0
    while i < len(raw):
        b = raw[i]
        if b < 0x80:
            out.append(chr(b))
            i += 1
            continue
        matched = False
        for n in (4, 3, 2):
            chunk = raw[i : i + n]
            if len(chunk) < n:
                continue
            try:
                out.append(chunk.decode("utf-8"))
                i += n
                matched = True
                break
            except UnicodeDecodeError:
                continue
        if matched:
            continue
        if b in BYTE_FIXES:
            out.append(BYTE_FIXES[b])
            i += 1
            continue
        out.append("\ufffd")
        notes.append(f"replaced unknown byte 0x{b:02x} at {i}")
        i += 1
    return "".join(out), notes


def normalize_text(text: str) -> str:
    return text.replace("\r\n", "\n").replace("\r", "\n")


def repair_file(path: Path) -> tuple[bool, list[str]]:
    raw = path.read_bytes()
    text, notes = repair_bytes(raw)
    text = normalize_text(text)
    new_raw = text.encode("utf-8")
    old_norm = raw[3:] if raw.startswith(b"\xef\xbb\xbf") else raw
    old_norm = old_norm.replace(b"\r\n", b"\n").replace(b"\r", b"\n")
    if old_norm == new_raw and not raw.startswith(b"\xef\xbb\xbf"):
        return False, notes
    path.write_text(text, encoding="utf-8", newline="\n")
    return True, notes
