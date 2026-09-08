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

/** Normalize menu links: absolute path, no .html / index.html (hash kept for section targets). */
export function normalizeMenuHref(href) {
  let h = String(href || "").trim();
  if (!h) return "";
  if (/^(mailto:|tel:)/i.test(h)) return h;
  if (h.charAt(0) === "#") return h;
  try {
    const abs = /^(https?:|\/)/i.test(h) ? h : "/" + h.replace(/^\.\//, "");
    const url = new URL(abs, "https://townloc.com/");
    let path = url.pathname || "/";
    if (/^\/index\.html$/i.test(path)) path = "/";
    else if (/\/index\.html$/i.test(path)) path = path.replace(/\/index\.html$/i, "/") || "/";
    else if (/\.html$/i.test(path)) path = path.replace(/\.html$/i, "");
    return path + (url.search || "") + (url.hash || "");
  } catch {
    if (/^(https?:|mailto:|tel:|#|\/)/i.test(h)) return h;
    return "/" + h.replace(/^\.\//, "");
  }
}

/** Split hash into data-townloc-section so hover never shows #section. */
export function splitMenuHref(href) {
  const full = normalizeMenuHref(href);
  if (!full) return { href: "", section: "" };
  if (/^(mailto:|tel:)/i.test(full)) return { href: full, section: "" };
  if (full.charAt(0) === "#") {
    return { href: "/", section: decodeURIComponent(full.slice(1)) };
  }
  try {
    const url = new URL(full, "https://townloc.com/");
    const section = url.hash ? decodeURIComponent(url.hash.slice(1)) : "";
    return { href: (url.pathname || "/") + (url.search || ""), section };
  } catch {
    return { href: full, section: "" };
  }
}

function anchorAttrs(item) {
  const parts = splitMenuHref(item.href);
  const href = escapeHtml(parts.href || "/");
  const section = parts.section
    ? ` data-townloc-section="${escapeHtml(parts.section)}"`
    : "";
  return { href, section, id: escapeHtml(item.id), label: escapeHtml(item.label) };
}

function stripInjectedMenus(html) {
  let out = String(html);
  // Remove innermost data-cms-extra-menu nodes first (handles nested dropdowns).
  for (let i = 0; i < 40; i += 1) {
    const next = out.replace(
      /<(li|a|div)\b[^>]*\bdata-cms-extra-menu=["'][^"']*["'][^>]*>((?:(?!<(?:li|a|div)\b[^>]*\bdata-cms-extra-menu=)[\s\S])*?)<\/\1>/gi,
      ""
    );
    if (next === out) break;
    out = next;
  }
  return out;
}

function normalizeMenuItems(items) {
  const list = Array.isArray(items) ? items.slice() : [];
  return list
    .map((item, index) => {
      if (!item || typeof item !== "object") return null;
      let parentId = item.parentId == null || item.parentId === "" ? null : String(item.parentId);
      if (!parentId && item.placement === "services") parentId = "__services__";
      return {
        id: String(item.id || `m_${index}`),
        label: String(item.label || "").trim() || "Link",
        href: normalizeMenuHref(item.href || "#"),
        parentId,
        order: Number.isFinite(Number(item.order)) ? Number(item.order) : index,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
}

function childrenOf(items, parentId) {
  const pid = parentId == null ? null : String(parentId);
  return items.filter((i) => (i.parentId == null ? null : String(i.parentId)) === pid);
}

function dropCaretSvg() {
  return `<svg class="nav-drop-caret h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6" /></svg>`;
}

function mobileServicesCaretSvg() {
  return `<svg class="mobile-services-caret h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6" /></svg>`;
}

/** Replace the full inner HTML of the first matching classed <div> (balanced tags). */
function replaceDivInnerByClass(html, className, newInner) {
  const re = new RegExp(
    `<div\\b([^>]*\\bclass=["'][^"']*\\b${className}\\b[^"']*["'][^>]*)>`,
    "i"
  );
  const m = String(html).match(re);
  if (!m || m.index == null) return html;
  const startTagEnd = m.index + m[0].length;
  let depth = 1;
  let i = startTagEnd;
  const src = String(html);
  while (i < src.length && depth > 0) {
    const nextOpen = src.indexOf("<div", i);
    const nextClose = src.indexOf("</div>", i);
    if (nextClose < 0) break;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 4;
      continue;
    }
    depth -= 1;
    if (depth === 0) {
      return (
        src.slice(0, startTagEnd) +
        `\n          ${newInner}\n        ` +
        src.slice(nextClose)
      );
    }
    i = nextClose + 6;
  }
  return html;
}

function injectHeaderMenus(html, items) {
  const list = normalizeMenuItems(items);
  if (!list.length) return html;
  let out = html;

  const tops = childrenOf(list, null);
  const serviceKids = childrenOf(list, "__services__");

  const desktopParts = [];
  const mobileParts = [];
  let mobileServicesBound = false;

  tops.forEach((item) => {
    const kids = childrenOf(list, item.id);
    const id = escapeHtml(item.id);
    const label = escapeHtml(item.label);

    if (kids.length) {
      const childLinks = kids
        .map((k, idx) => {
          const n = String(idx + 1).padStart(2, "0");
          const a = anchorAttrs(k);
          return `<a class="nav-drop-item" data-cms-extra-menu="${a.id}" href="${a.href}"${a.section}><span class="nav-drop-num">${n}</span><span class="nav-drop-name">${a.label}</span><span class="nav-drop-arrow">&#8594;</span></a>`;
        })
        .join("\n                  ");
      desktopParts.push(`<li class="nav-drop relative" data-cms-extra-menu="${id}">
          <button type="button" class="nav-drop-btn nav-link inline-flex items-center gap-1 opacity-85" aria-expanded="false" aria-haspopup="true">${label}
            ${dropCaretSvg()}
          </button>
          <div class="nav-drop-menu absolute left-1/2 top-full z-50 w-[min(22rem,calc(100vw-2rem))] pt-3">
            <div class="nav-drop-panel rounded-[1.35rem] p-1.5">
                  ${childLinks}
            </div>
          </div>
        </li>`);

      const mobileChild = kids
        .map((k) => {
          const a = anchorAttrs(k);
          return `<a class="nav-drop-item mobile-link" data-cms-extra-menu="${a.id}" href="${a.href}"${a.section}><span class="nav-drop-num">${String(kids.indexOf(k) + 1).padStart(2, "0")}</span><span class="nav-drop-name">${a.label}</span></a>`;
        })
        .join("\n                  ");
      // Keep GitHub/site.js IDs on the first Services dropdown.
      const isPrimaryServices =
        !mobileServicesBound && /^services$/i.test(item.label);
      if (isPrimaryServices) mobileServicesBound = true;
      const btnId = isPrimaryServices
        ? ` id="mobile-services-btn" aria-controls="mobile-services"`
        : "";
      const panelId = isPrimaryServices ? ` id="mobile-services"` : "";
      mobileParts.push(`<div class="mobile-menu-item" data-cms-extra-menu="${id}">
            <button type="button"${btnId} class="mobile-services-btn" aria-expanded="false">${label}
              ${mobileServicesCaretSvg()}
            </button>
            <div${panelId} class="mobile-services">
              <div class="mobile-services-clip">
                <div class="nav-drop-panel rounded-[1.35rem] p-1.5">
                  ${mobileChild}
                </div>
              </div>
            </div>
          </div>`);
    } else {
      const a = anchorAttrs(item);
      desktopParts.push(
        `<li data-cms-extra-menu="${a.id}"><a class="nav-link opacity-85" href="${a.href}"${a.section}>${a.label}</a></li>`
      );
      const isContact = /^contact$/i.test(item.label);
      mobileParts.push(
        `<a data-cms-extra-menu="${a.id}" href="${a.href}"${a.section} class="mobile-link mobile-menu-item${isContact ? " mobile-menu-cta" : ""}">${a.label}</a>`
      );
    }
  });

  // When CMS primary has items, replace built-in desktop/mobile nav (avoid duplicates).
  if (desktopParts.length) {
    const desktopLis = desktopParts.join("\n        ");
    out = out.replace(
      /(<ul\b[^>]*(?:class=["'][^"']*items-center[^"']*["']|class=["'][^"']*nav[^"']*["'])[^>]*>)([\s\S]*?)(<\/ul>)/i,
      (full, open, inner, close) => {
        if (!/nav-link|nav-drop/i.test(inner)) return full;
        return `${open}\n        ${desktopLis}\n      ${close}`;
      }
    );
  }

  if (mobileParts.length) {
    out = replaceDivInnerByClass(
      out,
      "mobile-menu-nav",
      mobileParts.join("\n          ")
    );
  }

  // Legacy: still allow extras under built-in Services when parentId is __services__
  if (serviceKids.length) {
    out = out.replace(
      /(<div class="nav-drop-panel\b[^"]*"[^>]*>)([\s\S]*?)(<\/div>)/gi,
      (full, open, inner, close) => {
        if (
          !/google-business-profile-setup\.html|remove-negative-reviews\.html|local-seo\.html/i.test(
            inner
          )
        ) {
          return full;
        }
        const mobile = /mobile-link/.test(inner);
        let count = (inner.match(/class="nav-drop-item/g) || []).length;
        const extras = [];
        for (const item of serviceKids) {
          if (inner.includes(`data-cms-extra-menu="${item.id}"`)) continue;
          count += 1;
          const n = String(count).padStart(2, "0");
          const href = escapeHtml(item.href);
          const label = escapeHtml(item.label);
          const id = escapeHtml(item.id);
          if (mobile) {
            extras.push(
              `<a class="nav-drop-item mobile-link" data-cms-extra-menu="${id}" href="${href}"><span class="nav-drop-num">${n}</span><span class="nav-drop-name">${label}</span></a>`
            );
          } else {
            extras.push(
              `<a class="nav-drop-item" data-cms-extra-menu="${id}" href="${href}"><span class="nav-drop-num">${n}</span><span class="nav-drop-name">${label}</span><span class="nav-drop-arrow">&#8594;</span></a>`
            );
          }
        }
        if (!extras.length) return full;
        return `${open}${inner}\n                  ${extras.join(
          "\n                  "
        )}\n                ${close}`;
      }
    );
  }

  return out;
}

function footerItemLi(item, kids) {
  const a = anchorAttrs(item);
  if (!kids.length) {
    return `<li data-cms-extra-menu="${a.id}"><a href="${a.href}"${a.section}>${a.label}</a></li>`;
  }
  const nested = kids
    .map((k) => {
      const c = anchorAttrs(k);
      return `<li data-cms-extra-menu="${c.id}"><a href="${c.href}"${c.section}>${c.label}</a></li>`;
    })
    .join("");
  return `<li data-cms-extra-menu="${a.id}"><a href="${a.href}"${a.section}>${a.label}</a><ul>${nested}</ul></li>`;
}

function injectFooterMenus(html, items) {
  const list = normalizeMenuItems(items);
  const tops = childrenOf(list, null);
  if (!tops.length) return html;

  const servicesTop = tops.find(
    (t) => /^services$/i.test(t.label) && childrenOf(list, t.id).length
  );
  const companyTops = tops.filter((t) => !servicesTop || t.id !== servicesTop.id);

  let out = html;

  if (servicesTop) {
    const kids = childrenOf(list, servicesTop.id);
    const lis = kids
      .map((k) => {
        const a = anchorAttrs(k);
        return `<li data-cms-extra-menu="${a.id}"><a href="${a.href}"${a.section}>${a.label}</a></li>`;
      })
      .join("\n            ");
    out = out.replace(
      /(<p\b[^>]*class=["'][^"']*footer-col-title[^"']*["'][^>]*>\s*Services\s*<\/p>\s*<ul\b[^>]*>)([\s\S]*?)(<\/ul>)/i,
      (full, open) => `${open}\n            ${lis}\n          </ul>`
    );
  }

  if (companyTops.length) {
    const lis = companyTops
      .map((item) => footerItemLi(item, childrenOf(list, item.id)))
      .join("\n            ");
    if (/footer-col-title[^>]*>\s*Company\s*</i.test(out)) {
      out = out.replace(
        /(<p\b[^>]*class=["'][^"']*footer-col-title[^"']*["'][^>]*>\s*Company\s*<\/p>\s*<ul\b[^>]*>)([\s\S]*?)(<\/ul>)/i,
        (full, open) => `${open}\n            ${lis}\n          </ul>`
      );
    } else {
      out = out.replace(
        /(<footer\b[\s\S]*?<ul\b(?![^>]*footer-ownership)[^>]*>)([\s\S]*?)(<\/ul>)/i,
        (full, open, inner, close) => {
          if (/footer-ownership/i.test(open)) return full;
          return `${open}\n            ${lis}\n          ${close}`;
        }
      );
    }
  }

  return out;
}

/**
 * Normalize CMS customMenus to WordPress shape:
 * { menus: [{ id, name, items[] }], locations: { primary, footer } }
 * Migrates legacy { header: [], footer: [] }.
 */
export function normalizeCustomMenusDoc(raw) {
  const m = raw && typeof raw === "object" ? raw : {};

  const normalizeItems = (items) =>
    (Array.isArray(items) ? items : [])
      .map((item, index) => {
        if (!item || typeof item !== "object") return null;
        let parentId =
          item.parentId == null || item.parentId === ""
            ? null
            : String(item.parentId);
        if (!parentId && item.placement === "services") parentId = "__services__";
        return {
          id: String(item.id || `m_${index}`),
          label: String(item.label || "").trim() || "Link",
          href: normalizeMenuHref(item.href || "#"),
          parentId,
          order: Number.isFinite(Number(item.order)) ? Number(item.order) : index,
          type: item.type === "page" || item.type === "post" ? item.type : "custom",
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.order - b.order);

  if (Array.isArray(m.menus)) {
    const menus = m.menus
      .map((menu, index) => {
        if (!menu || typeof menu !== "object") return null;
        const id = String(menu.id || `menu_${index}`).slice(0, 80);
        return {
          id,
          name: String(menu.name || "Menu").trim().slice(0, 80) || "Menu",
          items: normalizeItems(menu.items),
        };
      })
      .filter(Boolean);

    const locIn = m.locations && typeof m.locations === "object" ? m.locations : {};
    const locations = {
      primary:
        locIn.primary != null
          ? String(locIn.primary)
          : locIn.header != null
            ? String(locIn.header)
            : null,
      footer: locIn.footer != null ? String(locIn.footer) : null,
    };

    if (!menus.length) {
      menus.push(
        { id: "menu_primary", name: "Primary Menu", items: [] },
        { id: "menu_footer", name: "Footer Menu", items: [] }
      );
      locations.primary = "menu_primary";
      locations.footer = "menu_footer";
    }

    const ids = new Set(menus.map((x) => x.id));
    if (locations.primary && !ids.has(locations.primary)) locations.primary = menus[0].id;
    if (locations.footer && !ids.has(locations.footer)) locations.footer = null;

    return { menus, locations };
  }

  // Legacy flat regions
  const headerItems = normalizeItems(m.header);
  const footerItems = normalizeItems(m.footer);
  return {
    menus: [
      { id: "menu_primary", name: "Primary Menu", items: headerItems },
      { id: "menu_footer", name: "Footer Menu", items: footerItems },
    ],
    locations: {
      primary: "menu_primary",
      footer: "menu_footer",
    },
  };
}

export function itemsForLocation(customMenus, location) {
  const doc = normalizeCustomMenusDoc(customMenus);
  const key = location === "footer" ? "footer" : "primary";
  const menuId = doc.locations[key];
  if (!menuId) return [];
  const menu = doc.menus.find((x) => x.id === menuId);
  return menu ? menu.items : [];
}

/**
 * Inject user-added navbar/footer menu items (no frontend file edits).
 * Accepts WP shape or legacy { header, footer }.
 */
export function injectCustomMenus(html, customMenus) {
  const header = itemsForLocation(customMenus, "primary");
  const footer = itemsForLocation(customMenus, "footer");
  if (!header.length && !footer.length) {
    return stripInjectedMenus(html);
  }
  let out = stripInjectedMenus(html);
  out = injectHeaderMenus(out, header);
  out = injectFooterMenus(out, footer);
  return out;
}

