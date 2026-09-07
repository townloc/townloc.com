/**
 * Auto layout CMS — scan <header>/<footer> for menus, links, labels, images.
 * No frontend data-cms hooks required; Worker applies on every HTML response.
 */

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripTags(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function getSrc(attrs) {
  const m =
    String(attrs).match(/(?:^|\s)src\s*=\s*"([^"]*)"/i) ||
    String(attrs).match(/(?:^|\s)src\s*=\s*'([^']*)'/i);
  return m ? m[1] : "";
}

function setSrc(attrs, src) {
  const safe = String(src).replace(/"/g, "%22");
  if (/(?:^|\s)src\s*=\s*"/i.test(attrs)) {
    return attrs.replace(/(?:^|\s)src\s*=\s*"[^"]*"/i, (m) =>
      m.replace(/src\s*=\s*"[^"]*"/i, `src="${safe}"`)
    );
  }
  if (/(?:^|\s)src\s*=\s*'/i.test(attrs)) {
    const safeQ = String(src).replace(/'/g, "%27");
    return attrs.replace(/(?:^|\s)src\s*=\s*'[^']*'/i, (m) =>
      m.replace(/src\s*=\s*'[^']*'/i, `src='${safeQ}'`)
    );
  }
  return `${attrs} src="${safe}"`;
}

function fileNameFromSrc(src) {
  try {
    const path = String(src).split("?")[0];
    const part = path.split("/").pop() || path;
    return part.length > 48 ? part.slice(0, 45) + "…" : part;
  } catch {
    return "image";
  }
}

const SKIP_LABEL = /^(→|←|›|‹|▾|▾|•|\+|×|✕|☰|–|-|\d{1,2})$/;

/**
 * Find header or footer block in a full HTML document.
 * Works across typical site markup without frontend hooks.
 */
export function layoutRegionScope(html, region) {
  const r = String(region || "").toLowerCase() === "footer" ? "footer" : "header";
  const raw = String(html || "");

  const tryMatch = (re) => {
    const m = raw.match(re);
    if (!m) return null;
    const open = m[0].match(/^<[^>]+>/)[0];
    const closeTag = (m[0].match(/<\/[a-z0-9]+>\s*$/i) || [])[0] || "";
    return {
      region: r,
      open,
      body: m[1],
      empty: false,
      rebuild(body) {
        return (
          raw.slice(0, m.index) +
          open +
          body +
          closeTag +
          raw.slice(m.index + m[0].length)
        );
      },
    };
  };

  if (r === "header") {
    return (
      tryMatch(/<header\b[^>]*>([\s\S]*?)<\/header>/i) ||
      tryMatch(
        /<div\b[^>]*(?:id|class)=["'][^"']*(?:site-header|main-header|header|navbar|nav-bar)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
      ) ||
      tryMatch(/<nav\b[^>]*(?:aria-label=["'][^"']*primary[^"']*["']|class=["'][^"']*navbar[^"']*["'])[^>]*>([\s\S]*?)<\/nav>/i) || {
        region: r,
        open: "",
        body: "",
        fullStart: 0,
        fullEnd: 0,
        rebuild() {
          return raw;
        },
        empty: true,
      }
    );
  }

  return (
    tryMatch(/<footer\b[^>]*>([\s\S]*?)<\/footer>/i) ||
    tryMatch(
      /<div\b[^>]*(?:id|class)=["'][^"']*(?:site-footer|main-footer|footer)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
    ) || {
      region: r,
      open: "",
      body: "",
      fullStart: 0,
      fullEnd: 0,
      rebuild() {
        return raw;
      },
      empty: true,
    }
  );
}

function interactiveLabel(inner) {
  const name = String(inner).match(
    /<span\b[^>]*class=["'][^"']*(?:nav-drop-name|menu-label|link-text|nav-label)[^"']*["'][^>]*>([\s\S]*?)<\/span>/i
  );
  if (name) {
    const text = stripTags(name[1]);
    if (text.length >= 2 && !SKIP_LABEL.test(text)) {
      return { mode: "name-span", text };
    }
  }
  const text = stripTags(inner);
  if (text.length < 2 || text.length > 120) return null;
  if (SKIP_LABEL.test(text)) return null;
  return { mode: "plain", text };
}

function replaceInteractiveInner(inner, next, mode) {
  const safe = escapeHtml(String(next).trim());
  if (mode === "name-span") {
    return String(inner).replace(
      /(<span\b[^>]*class=["'][^"']*(?:nav-drop-name|menu-label|link-text|nav-label)[^"']*["'][^>]*>)([\s\S]*?)(<\/span>)/i,
      `$1${safe}$3`
    );
  }
  // Keep svg + number badges; replace remaining text content
  const keep = [];
  let work = String(inner)
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, (m) => {
      keep.push(m);
      return `%%KEEP${keep.length - 1}%%`;
    })
    .replace(
      /<span\b[^>]*class=["'][^"']*(?:nav-drop-num|nav-drop-arrow|badge|icon)[^"']*["'][^>]*>[\s\S]*?<\/span>/gi,
      (m) => {
        keep.push(m);
        return `%%KEEP${keep.length - 1}%%`;
      }
    );

  if (/%%KEEP\d+%%/.test(work)) {
    // Put label text before first keep token if structure looks like "Label + icon"
    work = work.replace(/^[\s\S]*?(?=%%KEEP)/, `${safe} `);
    // If no text before keep, and there's only keeps, prepend label
    if (!stripTags(work.replace(/%%KEEP\d+%%/g, "")).trim()) {
      work = `${safe} ${work}`;
    }
  } else {
    work = safe;
  }

  return work.replace(/%%KEEP(\d+)%%/g, (_, i) => keep[Number(i)] || "");
}

/**
 * Collect editable menu/link/label/image fields from a header or footer region.
 * ids: text:0, img:0… stable by discovery order (matches applyLayoutEditables).
 */
export function extractLayoutEditables(html, region) {
  const scope = layoutRegionScope(html, region);
  const fields = [];
  if (scope.empty || !scope.body) return fields;

  const body = scope.body;
  const items = [];

  const imgRe = /<img\b([^>]*)>/gi;
  let m;
  while ((m = imgRe.exec(body))) {
    const src = getSrc(m[1]);
    if (!src || /^data:/i.test(src)) continue;
    items.push({ pos: m.index, kind: "img", src, attrs: m[1] });
  }

  const linkRe = /<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  while ((m = linkRe.exec(body))) {
    const tag = m[1].toLowerCase();
    const attrs = m[2] || "";
    const inner = m[3] || "";
    // Skip brand/logo mark links — branding section owns those
    if (/header-mark|footer-mark|data-cms=["']brand\./i.test(inner)) continue;
    const label = interactiveLabel(inner);
    if (!label) continue;
    const href =
      (attrs.match(/(?:^|\s)href\s*=\s*"([^"]*)"/i) ||
        attrs.match(/(?:^|\s)href\s*=\s*'([^']*)'/i) ||
        [])[1] || "";
    items.push({
      pos: m.index,
      kind: "text",
      tag,
      href,
      mode: label.mode,
      text: label.text,
      inner,
      attrs,
    });
  }

  // Footer / header plain titles & blurbs (p/h1-h3/span.brand), not already covered
  const textRe = /<(h1|h2|h3|p)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  while ((m = textRe.exec(body))) {
    const tag = m[1].toLowerCase();
    const attrs = m[2] || "";
    const rawInner = m[3];
    const text = stripTags(rawInner);
    if (text.length < 2) continue;
    if (tag === "p" && text.length < 3) continue;
    if (text.length > 280) continue;
    // Avoid duplicating if this node is only wrapping a single link we already caught
    if (/^\s*<a\b/i.test(rawInner) && (rawInner.match(/<a\b/gi) || []).length === 1) {
      continue;
    }
    items.push({
      pos: m.index,
      kind: "block",
      tag,
      text,
      attrs,
      rawInner,
    });
  }

  items.sort((a, b) => a.pos - b.pos);

  let textI = 0;
  let imgI = 0;
  const regionName = String(region || "header").toLowerCase();

  for (const item of items) {
    if (item.kind === "img") {
      const id = `img:${imgI++}`;
      fields.push({
        id,
        kind: "img",
        type: "url",
        region: regionName,
        group: regionName === "footer" ? "Footer" : "Header",
        label: `Image · ${fileNameFromSrc(item.src)}`,
        value: item.src,
        hint: "Paste image link",
      });
      continue;
    }

    if (item.kind === "text") {
      const id = `text:${textI++}`;
      const where =
        item.tag === "button"
          ? "Button"
          : item.href
            ? "Link"
            : "Menu";
      fields.push({
        id,
        kind: "text",
        type: item.text.length > 90 ? "textarea" : "text",
        region: regionName,
        mode: item.mode,
        tag: item.tag,
        group: regionName === "footer" ? "Footer menus & links" : "Header menus & links",
        label: `${where} · ${item.text.slice(0, 52)}${item.text.length > 52 ? "…" : ""}`,
        value: item.text,
        hint: item.href ? `Goes to: ${item.href}` : "",
      });
      continue;
    }

    if (item.kind === "block") {
      const id = `text:${textI++}`;
      fields.push({
        id,
        kind: "text",
        type: item.text.length > 90 ? "textarea" : "text",
        region: regionName,
        mode: "block",
        tag: item.tag,
        group: regionName === "footer" ? "Footer text" : "Header text",
        label: `${item.tag.toUpperCase()} · ${item.text.slice(0, 52)}${
          item.text.length > 52 ? "…" : ""
        }`,
        value: item.text,
      });
    }
  }

  return fields;
}

/** Apply layout overrides onto a page's header or footer region. */
export function applyLayoutEditables(html, region, overrides) {
  if (!overrides || typeof overrides !== "object") return html;
  const scope = layoutRegionScope(html, region);
  if (scope.empty || !scope.body) return html;

  let body = scope.body;
  let imgI = 0;
  let textI = 0;

  body = body.replace(/<img\b([^>]*)>/gi, (full, attrs) => {
    const src = getSrc(attrs);
    if (!src || /^data:/i.test(src)) return full;
    const id = `img:${imgI++}`;
    const next = overrides[id];
    if (next == null || String(next).trim() === "") return full;
    return `<img${setSrc(attrs, String(next).trim())}>`;
  });

  // Same discovery order as extract: links/buttons and blocks interleaved by position.
  // Rebuild by walking items in order — use a single pass with a queue of ops.
  const ops = [];
  const linkRe = /<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = linkRe.exec(body))) {
    if (/header-mark|footer-mark|data-cms=["']brand\./i.test(m[3] || "")) continue;
    const label = interactiveLabel(m[3] || "");
    if (!label) continue;
    ops.push({
      pos: m.index,
      end: m.index + m[0].length,
      kind: "link",
      full: m[0],
      tag: m[1],
      attrs: m[2] || "",
      inner: m[3] || "",
      mode: label.mode,
    });
  }
  const textRe = /<(h1|h2|h3|p)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  while ((m = textRe.exec(body))) {
    const tag = m[1].toLowerCase();
    const rawInner = m[3];
    const text = stripTags(rawInner);
    if (text.length < 2) continue;
    if (tag === "p" && text.length < 3) continue;
    if (text.length > 280) continue;
    if (/^\s*<a\b/i.test(rawInner) && (rawInner.match(/<a\b/gi) || []).length === 1) {
      continue;
    }
    ops.push({
      pos: m.index,
      end: m.index + m[0].length,
      kind: "block",
      full: m[0],
      tag: m[1],
      attrs: m[2] || "",
      inner: rawInner,
    });
  }
  ops.sort((a, b) => a.pos - b.pos);

  // Apply from end to start so indices stay valid
  for (let i = ops.length - 1; i >= 0; i--) {
    // text index for this op = count of text-like ops before it in discovery order
    // Easier: assign ids forward first
  }

  const withIds = ops.map((op) => {
    const id = `text:${textI++}`;
    return { ...op, id };
  });

  for (let i = withIds.length - 1; i >= 0; i--) {
    const op = withIds[i];
    const next = overrides[op.id];
    if (next == null || String(next).trim() === "") continue;
    let replacement;
    if (op.kind === "link") {
      const newInner = replaceInteractiveInner(op.inner, next, op.mode);
      replacement = `<${op.tag}${op.attrs}>${newInner}</${op.tag}>`;
    } else {
      replacement = `<${op.tag}${op.attrs}>${escapeHtml(String(next).trim())}</${op.tag}>`;
    }
    body = body.slice(0, op.pos) + replacement + body.slice(op.end);
  }

  return scope.rebuild(body);
}

export function applyAllLayout(html, layout) {
  if (!layout || typeof layout !== "object") return html;
  let out = html;
  if (layout.header && typeof layout.header === "object") {
    out = applyLayoutEditables(out, "header", layout.header);
  }
  if (layout.footer && typeof layout.footer === "object") {
    out = applyLayoutEditables(out, "footer", layout.footer);
  }
  return out;
}
