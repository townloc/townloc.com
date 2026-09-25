# -*- coding: utf-8 -*-
"""
Sync HTML `data-cms="page.*"` text into Cloudflare D1 site_cms.

Why: Worker applies autoPages overrides on every HTML response. Editing HTML
and deploying alone does not change those overrides, so banner/copy stays old.
This script copies current HTML values into autoPages (+ pages.home for home)
so deploy and CMS can both drive live content (last write wins).

Usage (from repo root or backend/worker):
  python scripts/sync-cms-from-html.py
  python scripts/sync-cms-from-html.py --dry-run
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKER = ROOT / "backend" / "worker"

# Local HTML path → autoPages key + optional pages.* bucket
PAGE_MAP = {
    "index.html": ("index.html", "home"),
}

TAG_RE = re.compile(
    r"<(?P<tag>h1|h2|h3|p|a|button|span)\b(?P<attrs>[^>]*\bdata-cms=\"page\.(?P<key>[^\"]+)\"[^>]*)>(?P<inner>.*?)</(?P=tag)>",
    re.I | re.S,
)

# D1 SQL statement length limit is ~100KB; stay under it.
SQL_SAFE_BYTES = 90_000


def strip_tags(html: str) -> str:
    text = re.sub(r"<[^>]+>", " ", html or "")
    return re.sub(r"\s+", " ", text).strip()


def extract_page_fields(html: str) -> dict[str, str]:
    out: dict[str, str] = {}
    for m in TAG_RE.finditer(html):
        key = m.group("key").strip()
        text = strip_tags(m.group("inner"))
        if key and text:
            out[key] = text
    return out


def stable_id(data_cms_key: str) -> str:
    safe = re.sub(r"[^a-z0-9._:-]+", "-", f"page.{data_cms_key}", flags=re.I)
    return f"text:s:{safe}"


def npx_cmd() -> str:
    # Windows resolves npm/npx via .cmd; bare "npx" fails under CreateProcess.
    return "npx.cmd" if sys.platform.startswith("win") else "npx"


def wrangler_json(command: str) -> dict:
    proc = subprocess.run(
        [
            npx_cmd(),
            "wrangler",
            "d1",
            "execute",
            "townloc-leads",
            "--remote",
            "--json",
            "--command",
            command,
        ],
        cwd=str(WORKER),
        capture_output=True,
        text=True,
        encoding="utf-8",
        shell=False,
    )
    if proc.returncode != 0:
        sys.stderr.write(proc.stdout + "\n" + proc.stderr)
        raise SystemExit(f"wrangler failed ({proc.returncode})")
    payload = json.loads(proc.stdout)
    # wrangler --json may return a list of statements
    if isinstance(payload, list):
        return payload[0]
    return payload


def read_cms_doc() -> dict:
    result = wrangler_json("SELECT data FROM site_cms WHERE id = 1;")
    rows = result.get("results") or []
    if not rows:
        raise SystemExit("site_cms row missing")
    raw = rows[0]["data"]
    return json.loads(raw) if isinstance(raw, str) else raw


def _run_sql_file(sql: str) -> None:
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", suffix=".sql", delete=False, newline="\n"
    ) as fh:
        fh.write(sql)
        sql_path = Path(fh.name)
    try:
        proc = subprocess.run(
            [
                npx_cmd(),
                "wrangler",
                "d1",
                "execute",
                "townloc-leads",
                "--remote",
                "--file",
                str(sql_path),
            ],
            cwd=str(WORKER),
            capture_output=True,
            text=True,
            encoding="utf-8",
            shell=False,
        )
        if proc.returncode != 0:
            sys.stderr.write((proc.stdout or "") + "\n" + (proc.stderr or ""))
            raise SystemExit(f"wrangler write failed ({proc.returncode})")
        out = (proc.stdout or "").encode("ascii", "replace").decode("ascii")
        print(out.strip() or "D1 update OK")
    finally:
        sql_path.unlink(missing_ok=True)


def write_cms_doc(doc: dict) -> None:
    """Full-document write. Fails if SQL exceeds D1 ~100KB statement limit."""
    raw = json.dumps(doc, ensure_ascii=False, separators=(",", ":"))
    sql_literal = raw.replace("'", "''")
    sql = f"UPDATE site_cms SET data = '{sql_literal}', updated_at = datetime('now') WHERE id = 1;"
    if len(sql.encode("utf-8")) > SQL_SAFE_BYTES:
        raise SystemExit(
            "CMS document too large for full SQL UPDATE (SQLITE_TOOBIG). "
            "Use field patches instead."
        )
    _run_sql_file(sql)


def write_cms_patches(patches: list[tuple[str, str]]) -> None:
    """
    Patch JSON paths with json_set so each statement stays under D1 limits.
    path examples:
      $.autoPages."index.html"."text:s:page.hero_title"
      $.pages.home.hero_title
    """
    if not patches:
        return
    chunk_size = 15
    for i in range(0, len(patches), chunk_size):
        chunk = patches[i : i + chunk_size]
        expr = "data"
        for path, value in chunk:
            lit = value.replace("'", "''")
            path_lit = path.replace("'", "''")
            expr = f"json_set({expr}, '{path_lit}', json_quote('{lit}'))"
        sql = (
            f"UPDATE site_cms SET data = {expr}, "
            f"updated_at = datetime('now') WHERE id = 1;"
        )
        if len(sql.encode("utf-8")) > SQL_SAFE_BYTES:
            raise SystemExit("Patch chunk still too large for D1 SQL limit.")
        _run_sql_file(sql)


def json_key_seg(key: str) -> str:
    """Quoted JSON-path key segment for keys that contain dots/colons."""
    return '"' + key.replace("\\", "\\\\").replace('"', '\\"') + '"'


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    doc = read_cms_doc()
    auto_pages = dict(doc.get("autoPages") or {})
    pages = dict(doc.get("pages") or {})
    changed: list[str] = []
    patches: list[tuple[str, str]] = []

    for rel, (auto_key, pages_key) in PAGE_MAP.items():
        html_path = ROOT / rel
        if not html_path.is_file():
            print(f"skip missing {rel}")
            continue
        fields = extract_page_fields(html_path.read_text(encoding="utf-8"))
        if not fields:
            print(f"no page.* fields in {rel}")
            continue

        bucket = dict(auto_pages.get(auto_key) or {})
        page_bucket = dict(pages.get(pages_key) or {}) if pages_key else {}

        for key, text in fields.items():
            sid = stable_id(key)
            if bucket.get(sid) != text:
                changed.append(f"{auto_key}:{sid}")
                bucket[sid] = text
                patches.append(
                    (
                        f"$.autoPages.{json_key_seg(auto_key)}.{json_key_seg(sid)}",
                        text,
                    )
                )
            if pages_key and page_bucket.get(key) != text:
                changed.append(f"pages.{pages_key}.{key}")
                page_bucket[key] = text
                patches.append(
                    (
                        f"$.pages.{json_key_seg(pages_key)}.{json_key_seg(key)}",
                        text,
                    )
                )

        auto_pages[auto_key] = bucket
        if pages_key:
            pages[pages_key] = page_bucket

        print(f"{rel}: synced {len(fields)} page.* fields")

    if not changed:
        print("No CMS changes needed (already in sync).")
        return

    print(f"Updating {len(changed)} values…")
    for c in changed[:30]:
        print(f"  - {c}")
    if len(changed) > 30:
        print(f"  … +{len(changed) - 30} more")

    doc["autoPages"] = auto_pages
    doc["pages"] = pages

    if args.dry_run:
        print("Dry run — not writing D1.")
        return

    # Prefer field patches (avoids SQLITE_TOOBIG on large CMS docs).
    write_cms_patches(patches)
    print("Done. Hard-refresh townloc.com to see HTML banner/copy.")


if __name__ == "__main__":
    main()
