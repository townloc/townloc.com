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

/** Normalize menu links so they work from any page depth. */
export function normalizeMenuHref(href) {
  let h = String(href || "").trim();
  if (!h) return "";
  if (/^(https?:|mailto:|tel:|#|\/)/i.test(h)) return h;
  return "/" + h.replace(/^\.\//, "");
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

function injectHeaderMenus(html, items) {
  const list = normalizeMenuItems(items);
  if (!list.length) return html;
  let out = html;

  const tops = childrenOf(list, null);
  const serviceKids = childrenOf(list, "__services__");

  const desktopParts = [];
  const mobileParts = [];

  tops.forEach((item) => {
    const kids = childrenOf(list, item.id);
    const id = escapeHtml(item.id);
    const href = escapeHtml(item.href);
    const label = escapeHtml(item.label);

    if (kids.length) {
      const childLinks = kids
        .map((k, idx) => {
          const n = String(idx + 1).padStart(2, "0");
          return `<a class="nav-drop-item" data-cms-extra-menu="${escapeHtml(k.id)}" href="${escapeHtml(k.href)}"><span class="nav-drop-num">${n}</span><span class="nav-drop-name">${escapeHtml(k.label)}</span><span class="nav-drop-arrow">→</span></a>`;
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
        .map(
          (k) =>
            `<a class="nav-drop-item mobile-link" data-cms-extra-menu="${escapeHtml(k.id)}" href="${escapeHtml(k.href)}"><span class="nav-drop-name">${escapeHtml(k.label)}</span></a>`
        )
        .join("\n");
      mobileParts.push(`<div class="mobile-menu-item" data-cms-extra-menu="${id}">
            <button type="button" class="mobile-services-btn" aria-expanded="false">${label}</button>
            <div class="mobile-services"><div class="mobile-services-clip"><div class="nav-drop-panel rounded-[1.35rem] p-1.5">${mobileChild}</div></div></div>
          </div>`);
    } else {
      desktopParts.push(
        `<li data-cms-extra-menu="${id}"><a class="nav-link opacity-85" href="${href}">${label}</a></li>`
      );
      mobileParts.push(
        `<a data-cms-extra-menu="${id}" href="${href}" class="mobile-link mobile-menu-item">${label}</a>`
      );
    }
  });

  if (desktopParts.length) {
    const desktopLis = desktopParts.join("\n        ");
    out = out.replace(
      /(<ul\b[^>]*(?:class=["'][^"']*items-center[^"']*["']|class=["'][^"']*nav[^"']*["'])[^>]*>)([\s\S]*?)(<\/ul>)/i,
      (full, open, inner, close) => {
        if (!/nav-link/i.test(inner)) return full;
        if (/data-cms-extra-menu=/i.test(inner)) return full;
        return `${open}${inner}\n        ${desktopLis}\n      ${close}`;
      }
    );
  }

  if (mobileParts.length) {
    const mobileAs = mobileParts.join("\n          ");
    if (/mobile-menu-cta/i.test(out)) {
      out = out.replace(
        /(<a\b[^>]*class=["'][^"']*mobile-menu-cta[^"']*["'][^>]*>)/i,
        `${mobileAs}\n          $1`
      );
    }
  }

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
              `<a class="nav-drop-item" data-cms-extra-menu="${id}" href="${href}"><span class="nav-drop-num">${n}</span><span class="nav-drop-name">${label}</span><span class="nav-drop-arrow">→</span></a>`
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

function injectFooterMenus(html, items) {
  const list = normalizeMenuItems(items);
  const tops = childrenOf(list, null);
  if (!tops.length) return html;

  const lis = tops
    .map((item) => {
      const kids = childrenOf(list, item.id);
      const id = escapeHtml(item.id);
      const href = escapeHtml(item.href);
      const label = escapeHtml(item.label);
      if (!kids.length) {
        return `<li data-cms-extra-menu="${id}"><a href="${href}">${label}</a></li>`;
      }
      const nested = kids
        .map(
          (k) =>
            `<li data-cms-extra-menu="${escapeHtml(k.id)}"><a href="${escapeHtml(k.href)}">${escapeHtml(k.label)}</a></li>`
        )
        .join("");
      return `<li data-cms-extra-menu="${id}"><a href="${href}">${label}</a><ul>${nested}</ul></li>`;
    })
    .join("\n            ");

  let out = html;
  if (/footer-col-title[^>]*>\s*Company\s*</i.test(out)) {
    out = out.replace(
      /(<p\b[^>]*class=["'][^"']*footer-col-title[^"']*["'][^>]*>\s*Company\s*<\/p>\s*<ul\b[^>]*>)([\s\S]*?)(<\/ul>)/i,
      (full, open, inner, close) => {
        if (/data-cms-extra-menu/i.test(inner)) return full;
        return `${open}${inner}\n            ${lis}\n          ${close}`;
      }
    );
    return out;
  }

  out = out.replace(
    /(<footer\b[\s\S]*?<ul\b(?![^>]*footer-ownership)[^>]*>)([\s\S]*?)(<\/ul>)/i,
    (full, open, inner, close) => {
      if (/data-cms-extra-menu/i.test(inner)) return full;
      if (/footer-ownership/i.test(open)) return full;
      return `${open}${inner}\n            ${lis}\n          ${close}`;
    }
  );
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

