/**
 * Auto CMS — scan any HTML page's <main> for headings/paragraphs/images.
 * Reusable: no hand-written field lists per site page.
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
    .replace(/<[^>]+>/g, " ")
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

/** Map request path → HTML file in assets */
export function htmlPathFromUrl(pathname) {
  let p = String(pathname || "/").split("?")[0].split("#")[0];
  p = p.replace(/\\/g, "/");
  if (!p.startsWith("/")) p = "/" + p;
  if (p === "/") return "index.html";
  if (p.endsWith("/")) p += "index.html";
  if (!/\.[a-z0-9]+$/i.test(p)) p += "/index.html";
  return p.replace(/^\//, "");
}

function mainScope(html) {
  const re = /<main\b[^>]*>([\s\S]*?)<\/main>/i;
  const m = String(html).match(re);
  if (!m) {
    return {
      hasMain: false,
      body: String(html),
      rebuild(body) {
        return body;
      },
    };
  }
  const open = m[0].match(/^<main\b[^>]*>/i)[0];
  const fullStart = m.index;
  const fullEnd = m.index + m[0].length;
  return {
    hasMain: true,
    body: m[1],
    rebuild(body) {
      return html.slice(0, fullStart) + open + body + "</main>" + html.slice(fullEnd);
    },
  };
}

function titleCaseId(id) {
  return String(id || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
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

/** Prefer first H1/H2 text, else section id / class hint. */
function sectionLabel(attrs, innerHtml) {
  const hm = String(innerHtml).match(/<(h1|h2)\b[^>]*>([\s\S]*?)<\/\1>/i);
  if (hm) {
    const t = stripTags(hm[2]);
    if (t) return t.length > 52 ? t.slice(0, 49) + "…" : t;
  }
  const id = (String(attrs).match(/\bid\s*=\s*["']([^"']+)/i) || [])[1];
  if (id) return titleCaseId(id);
  const cls = (String(attrs).match(/\bclass\s*=\s*["']([^"']+)/i) || [])[1] || "";
  if (/hero/i.test(cls)) return "Hero";
  return "Section";
}

/**
 * Split <main> into <section> chunks (plus loose content between them).
 * Pages without sections become one chunk.
 */
function contentChunks(body) {
  const chunks = [];
  const re = /<section\b([^>]*)>([\s\S]*?)<\/section>/gi;
  let last = 0;
  let m;
  let looseN = 0;
  while ((m = re.exec(body))) {
    if (m.index > last) {
      const between = body.slice(last, m.index);
      if (/<img\b/i.test(between) || /<(h1|h2|h3|p)\b/i.test(between)) {
        looseN += 1;
        chunks.push({
          attrs: "",
          html: between,
          label: looseN === 1 ? "Page top" : `Other content ${looseN}`,
        });
      }
    }
    chunks.push({
      attrs: m[1] || "",
      html: m[2] || "",
      label: sectionLabel(m[1] || "", m[2] || ""),
    });
    last = m.index + m[0].length;
  }
  if (last < body.length) {
    const rest = body.slice(last);
    if (/<img\b/i.test(rest) || /<(h1|h2|h3|p)\b/i.test(rest)) {
      chunks.push({
        attrs: "",
        html: rest,
        label: chunks.length ? "More content" : "Page content",
      });
    }
  }
  if (!chunks.length) {
    chunks.push({ attrs: "", html: body, label: "Page content" });
  }
  return chunks;
}

/**
 * Collect img + text nodes in document order inside one HTML chunk.
 * Global img:/text: ids stay stable (same order as applyEditables).
 */
function collectOrdered(html, counters, group) {
  const items = [];
  const imgRe = /<img\b([^>]*)>/gi;
  let m;
  while ((m = imgRe.exec(html))) {
    const src = getSrc(m[1]);
    if (!src || /^data:/i.test(src)) continue;
    items.push({ pos: m.index, kind: "img", src });
  }
  const textRe = /<(h1|h2|h3|p)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  while ((m = textRe.exec(html))) {
    const tag = m[1].toLowerCase();
    const rawInner = m[3];
    const text = stripTags(rawInner);
    if (text.length < 12) continue;
    if (tag === "p" && text.length < 24) continue;
    items.push({
      pos: m.index,
      kind: "text",
      tag,
      text,
      rawInner,
    });
  }
  items.sort((a, b) => a.pos - b.pos);

  const fields = [];
  for (const item of items) {
    if (item.kind === "img") {
      const n = counters.imgI++;
      fields.push({
        id: `img:${n}`,
        kind: "img",
        type: "url",
        group,
        label: `Image · ${fileNameFromSrc(item.src)}`,
        value: item.src,
        hint: "Paste image link for this part of the page",
      });
    } else {
      const n = counters.textI++;
      fields.push({
        id: `text:${n}`,
        kind: "text",
        tag: item.tag,
        type: item.text.length > 90 ? "textarea" : "text",
        group,
        label: `${item.tag.toUpperCase()} · ${item.text.slice(0, 52)}${
          item.text.length > 52 ? "…" : ""
        }`,
        value: item.text,
        hadHtml: /<[a-z]/i.test(item.rawInner),
      });
    }
  }
  return fields;
}

/**
 * Discover editable fields from HTML (main content).
 * Fields are ordered by page section, then document order (text + image together).
 * id is stable by kind order: img:0, text:0, ... (matches applyEditables).
 */
export function extractEditables(html) {
  const { body } = mainScope(html);
  const counters = { imgI: 0, textI: 0 };
  const fields = [];
  for (const chunk of contentChunks(body)) {
    fields.push(...collectOrdered(chunk.html, counters, chunk.label));
  }
  return fields;
}

/** Apply saved overrides onto HTML using same discovery order. */
export function applyEditables(html, overrides) {
  if (!overrides || typeof overrides !== "object") return html;
  const scope = mainScope(html);
  let body = scope.body;
  let imgI = 0;

  body = body.replace(/<img\b([^>]*)>/gi, (full, attrs) => {
    const src = getSrc(attrs);
    if (!src || /^data:/i.test(src)) return full;
    const id = `img:${imgI++}`;
    const next = overrides[id];
    if (next == null || String(next).trim() === "") return full;
    return `<img${setSrc(attrs, String(next).trim())}>`;
  });

  let textI = 0;
  body = body.replace(/<(h1|h2|h3|p)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (full, tag, attrs, inner) => {
    const text = stripTags(inner);
    if (text.length < 12) return full;
    if (tag.toLowerCase() === "p" && text.length < 24) return full;
    const id = `text:${textI++}`;
    const next = overrides[id];
    if (next == null || String(next).trim() === "") return full;
    // Plain text replace (keeps layout tags/classes on the element)
    return `<${tag}${attrs}>${escapeHtml(String(next).trim())}</${tag}>`;
  });

  if (!scope.hasMain) return body;
  return scope.rebuild(body);
}

export function mergeFieldValues(fields, overrides) {
  const o = overrides && typeof overrides === "object" ? overrides : {};
  return fields.map((f) => ({
    ...f,
    value: o[f.id] != null && String(o[f.id]).trim() !== "" ? o[f.id] : f.value,
    defaultValue: f.value,
    overridden: o[f.id] != null && String(o[f.id]).trim() !== "",
  }));
}
