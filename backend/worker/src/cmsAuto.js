/**
 * Auto CMS — scan any HTML page's <main> for headings/paragraphs/CTAs/images.
 * Stable field ids + legacy text:N / img:N for backward compatibility.
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

function shortHash(s) {
  let h = 0;
  const str = String(s || "");
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36).slice(0, 8);
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

function getAttr(attrs, name) {
  const re = new RegExp(
    `(?:^|\\s)${name}\\s*=\\s*"([^"]*)"|(?:^|\\s)${name}\\s*=\\s*'([^']*)'`,
    "i"
  );
  const m = String(attrs).match(re);
  return m ? m[1] || m[2] || "" : "";
}

/** Map request path → HTML file in assets */
export function htmlPathFromUrl(pathname) {
  let p = String(pathname || "/").split("?")[0].split("#")[0];
  p = p.replace(/\\/g, "/");
  if (!p.startsWith("/")) p = "/" + p;
  if (p === "/") return "index.html";
  // Directory URLs keep index.html (e.g. /blog/ → blog/index.html).
  if (p.endsWith("/")) return (p + "index.html").replace(/^\//, "");
  // Clean leaf URLs map to sibling .html files (e.g. /services/foo →
  // services/foo.html). CMS custom pages and static service pages use this.
  if (!/\.[a-z0-9]+$/i.test(p)) return (p + ".html").replace(/^\//, "");
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

function contentChunks(body) {
  const chunks = [];
  const re = /<section\b([^>]*)>([\s\S]*?)<\/section>/gi;
  let last = 0;
  let m;
  let looseN = 0;
  while ((m = re.exec(body))) {
    if (m.index > last) {
      const between = body.slice(last, m.index);
      if (
        /<img\b/i.test(between) ||
        /<(h1|h2|h3|p|a|button)\b/i.test(between)
      ) {
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
    if (/<img\b/i.test(rest) || /<(h1|h2|h3|p|a|button)\b/i.test(rest)) {
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

function isCtaCandidate(tag, attrs, text) {
  if (text.length < 4 || text.length > 80) return false;
  const cls = getAttr(attrs, "class") || "";
  const href = getAttr(attrs, "href") || "";
  if (tag === "button") return true;
  if (tag === "a") {
    if (/\bbtn[-_]|\bheader-cta\b|\bfooter-cta\b/i.test(cls)) return true;
    if (/rounded-full/.test(cls) && /font-medium|btn/i.test(cls)) return true;
    if (/^#/.test(href) && text.length >= 6) return true;
  }
  return false;
}

function stableImgId(src) {
  const base = fileNameFromSrc(src).replace(/[^a-z0-9._-]+/gi, "-").toLowerCase();
  return `img:s:${shortHash(src)}:${base.slice(0, 24)}`;
}

function stableTextId(tag, text, dataCms) {
  if (dataCms) return `text:s:${String(dataCms).replace(/[^a-z0-9._:-]+/gi, "-")}`;
  return `text:s:${tag}:${shortHash(text.slice(0, 80))}`;
}

function pickOverride(overrides, stableId, legacyId) {
  if (!overrides) return null;
  if (overrides[stableId] != null && String(overrides[stableId]).trim() !== "") {
    return overrides[stableId];
  }
  if (legacyId && overrides[legacyId] != null && String(overrides[legacyId]).trim() !== "") {
    return overrides[legacyId];
  }
  return null;
}

/**
 * Collect img + text + CTA nodes in document order inside one HTML chunk.
 */
function collectOrdered(html, counters, group) {
  const items = [];
  const imgRe = /<img\b([^>]*)>/gi;
  let m;
  while ((m = imgRe.exec(html))) {
    const src = getSrc(m[1]);
    if (!src || /^data:/i.test(src)) continue;
    items.push({ pos: m.index, kind: "img", src, attrs: m[1] });
  }

  const textRe = /<(h1|h2|h3|p)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  while ((m = textRe.exec(html))) {
    const tag = m[1].toLowerCase();
    const attrs = m[2] || "";
    const rawInner = m[3];
    const text = stripTags(rawInner);
    if (text.length < 8) continue;
    if (tag === "p" && text.length < 16) continue;
    items.push({
      pos: m.index,
      kind: "text",
      tag,
      attrs,
      text,
      rawInner,
      dataCms: getAttr(attrs, "data-cms"),
    });
  }

  const ctaRe = /<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/gi;
  while ((m = ctaRe.exec(html))) {
    const tag = m[1].toLowerCase();
    const attrs = m[2] || "";
    const rawInner = m[3];
    const text = stripTags(rawInner);
    if (!isCtaCandidate(tag, attrs, text)) continue;
    // Skip if this CTA wraps only an image
    if (/^<img\b/i.test(String(rawInner).trim()) && text.length < 4) continue;
    items.push({
      pos: m.index,
      kind: "cta",
      tag,
      attrs,
      text,
      rawInner,
      dataCms: getAttr(attrs, "data-cms"),
    });
  }

  items.sort((a, b) => a.pos - b.pos);

  const fields = [];
  for (const item of items) {
    if (item.kind === "img") {
      const n = counters.imgI++;
      const legacyId = `img:${n}`;
      const id = stableImgId(item.src);
      fields.push({
        id,
        legacyId,
        kind: "img",
        type: "url",
        group,
        label: `Image · ${fileNameFromSrc(item.src)}`,
        value: item.src,
        hint: "Paste image link or upload for this part of the page",
      });
    } else if (item.kind === "cta") {
      const id = stableTextId("cta", item.text, item.dataCms);
      fields.push({
        id,
        legacyId: null,
        kind: "text",
        tag: item.tag,
        type: "text",
        group,
        label: `Button · ${item.text.slice(0, 52)}${
          item.text.length > 52 ? "…" : ""
        }`,
        value: item.text,
        hadHtml: /<[a-z]/i.test(item.rawInner),
      });
    } else {
      const n = counters.textI++;
      const legacyId = `text:${n}`;
      const id = stableTextId(item.tag, item.text, item.dataCms);
      fields.push({
        id,
        legacyId,
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

/** Apply saved overrides onto HTML using stable + legacy ids. */
export function applyEditables(html, overrides) {
  if (!overrides || typeof overrides !== "object") return html;
  const scope = mainScope(html);
  let body = scope.body;
  let imgI = 0;
  let textI = 0;

  body = body.replace(/<img\b([^>]*)>/gi, (full, attrs) => {
    const src = getSrc(attrs);
    if (!src || /^data:/i.test(src)) return full;
    const legacyId = `img:${imgI++}`;
    const stableId = stableImgId(src);
    const next = pickOverride(overrides, stableId, legacyId);
    if (next == null || String(next).trim() === "") return full;
    return `<img${setSrc(attrs, String(next).trim())}>`;
  });

  body = body.replace(
    /<(h1|h2|h3|p)\b([^>]*)>([\s\S]*?)<\/\1>/gi,
    (full, tag, attrs, inner) => {
      const text = stripTags(inner);
      if (text.length < 8) return full;
      if (tag.toLowerCase() === "p" && text.length < 16) return full;
      const legacyId = `text:${textI++}`;
      const dataCms = getAttr(attrs, "data-cms");
      const stableId = stableTextId(tag.toLowerCase(), text, dataCms);
      const next = pickOverride(overrides, stableId, legacyId);
      if (next == null || String(next).trim() === "") return full;
      return `<${tag}${attrs}>${escapeHtml(String(next).trim())}</${tag}>`;
    }
  );

  body = body.replace(
    /<(a|button)\b([^>]*)>([\s\S]*?)<\/\1>/gi,
    (full, tag, attrs, inner) => {
      const text = stripTags(inner);
      if (!isCtaCandidate(tag.toLowerCase(), attrs, text)) return full;
      const dataCms = getAttr(attrs, "data-cms");
      const stableId = stableTextId("cta", text, dataCms);
      const next = pickOverride(overrides, stableId, null);
      if (next == null || String(next).trim() === "") return full;
      if (/<img\b|<svg\b/i.test(inner)) return full;
      return `<${tag}${attrs}>${escapeHtml(String(next).trim())}</${tag}>`;
    }
  );

  if (!scope.hasMain) return body;
  return scope.rebuild(body);
}

export function mergeFieldValues(fields, overrides) {
  const o = overrides && typeof overrides === "object" ? overrides : {};
  return fields.map((f) => {
    const viaStable = o[f.id] != null && String(o[f.id]).trim() !== "";
    const viaLegacy =
      f.legacyId && o[f.legacyId] != null && String(o[f.legacyId]).trim() !== "";
    const value = viaStable
      ? o[f.id]
      : viaLegacy
        ? o[f.legacyId]
        : f.value;
    return {
      ...f,
      value,
      defaultValue: f.value,
      overridden: viaStable || viaLegacy,
    };
  });
}
