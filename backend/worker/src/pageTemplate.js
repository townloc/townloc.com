/**
 * Clone a service page template and inject custom service nav links.
 */

export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function slugifyTitle(title) {
  const slug = String(title || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "service";
}

export function serviceFileFromPath(path) {
  return String(path || "")
    .replace(/^services\//i, "")
    .replace(/^\/+/, "");
}

/** Relative href from the current HTML file to a services/*.html page. */
export function serviceHrefForPage(pagePath, serviceFile) {
  const file = serviceFileFromPath(serviceFile);
  const p = String(pagePath || "index.html");
  if (p === "index.html" || p === "privacy.html" || p === "terms.html") {
    return `services/${file}`;
  }
  if (p.startsWith("services/")) {
    return file;
  }
  if (p.includes("/")) {
    return `../services/${file}`;
  }
  return `services/${file}`;
}

/**
 * Build a new service page HTML from the local-seo template.
 * Keeps layout/CSS; swaps identity strings + optional hero image.
 */
export function buildServicePageHtml(templateHtml, opts) {
  const title = String(opts.title || "New Service").trim();
  const slug = String(opts.slug || slugifyTitle(title));
  const path = `services/${slug}.html`;
  const description = String(
    opts.description ||
      `${title} for local businesses. Townloc helps you get found, build trust, and turn searches into customers.`
  ).trim();
  const imageUrl = String(opts.imageUrl || "").trim();
  const lead = description;
  const h1 = title.endsWith(".") ? title : `${title}.`;
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const safeH1 = escapeHtml(h1);
  const safeLead = escapeHtml(lead);
  const canonical = `https://townloc.com/${path}`;
  const ogImage =
    imageUrl ||
    "https://townloc.com/assets/images/services/local-seo/hero.jpg";

  let html = String(templateHtml);

  html = html.replace(
    /data-cms-page="[^"]*"/i,
    `data-cms-page="services/${slug}"`
  );
  html = html.replace(
    /<title>[^<]*<\/title>/i,
    `<title>${safeTitle} for Local Businesses | Townloc</title>`
  );
  html = html.replace(
    /(<meta\s+name="description"\s+content=")([^"]*)(")/i,
    `$1${safeDesc}$3`
  );
  html = html.replace(
    /(<link\s+rel="canonical"\s+href=")([^"]*)(")/i,
    `$1${canonical}$3`
  );
  html = html.replace(
    /(<meta\s+property="og:title"\s+content=")([^"]*)(")/i,
    `$1${safeTitle} for Local Businesses | Townloc$3`
  );
  html = html.replace(
    /(<meta\s+property="og:description"\s+content=")([^"]*)(")/i,
    `$1${safeDesc}$3`
  );
  html = html.replace(
    /(<meta\s+property="og:url"\s+content=")([^"]*)(")/i,
    `$1${canonical}$3`
  );
  html = html.replace(
    /(<meta\s+property="og:image"\s+content=")([^"]*)(")/i,
    `$1${escapeHtml(ogImage)}$3`
  );

  // Breadcrumb last crumb + eyebrow
  html = html.replace(
    /(<li class="text-ink\/70">)Local SEO(<\/li>)/i,
    `$1${safeTitle}$2`
  );
  html = html.replace(
    /(<p class="mt-6 text-xs font-medium uppercase tracking-\[0\.22em\] text-ink\/45">)Local SEO(<\/p>)/i,
    `$1${safeTitle}$2`
  );

  // Hero title + lead (data-cms hooks)
  html = html.replace(
    /(<h1[^>]*data-cms="page\.title"[^>]*>)([\s\S]*?)(<\/h1>)/i,
    `$1${safeH1}$3`
  );
  html = html.replace(
    /(<p[^>]*data-cms="page\.lead"[^>]*>)([\s\S]*?)(<\/p>)/i,
    `$1${safeLead}$3`
  );

  if (imageUrl) {
    html = html.replace(
      /(<img[^>]*data-cms-src="page\.hero_image"[^>]*\ssrc=")([^"]*)(")/i,
      `$1${escapeHtml(imageUrl)}$3`
    );
    // Drop webp source so custom URL is used
    html = html.replace(
      /<source[^>]*services\/local-seo\/hero\.webp[^>]*\/?>/i,
      ""
    );
  }

  // Schema-ish name/url mentions for this service
  html = html.replace(/Local SEO for Local Businesses/g, `${safeTitle} for Local Businesses`);
  html = html.replace(
    /https:\/\/townloc\.com\/services\/local-seo\.html/g,
    canonical
  );

  return html;
}

function navLinkHtml({ href, num, title, mobile }) {
  const safe = escapeHtml(title);
  const n = String(num).padStart(2, "0");
  if (mobile) {
    return `<a class="nav-drop-item mobile-link" href="${escapeHtml(href)}"><span class="nav-drop-num">${n}</span><span class="nav-drop-name">${safe}</span></a>`;
  }
  return `<a class="nav-drop-item" href="${escapeHtml(href)}"><span class="nav-drop-num">${n}</span><span class="nav-drop-name">${safe}</span><span class="nav-drop-arrow">→</span></a>`;
}

/**
 * Append custom services into every Services dropdown panel.
 */
export function injectCustomServiceNav(html, customPages, pagePath) {
  const list = Array.isArray(customPages) ? customPages : [];
  if (!list.length) return html;

  return String(html).replace(
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
      for (const page of list) {
        const file = serviceFileFromPath(page.path);
        if (!file || !/\.html$/i.test(file)) continue;
        if (inner.includes(file)) continue;
        count += 1;
        extras.push(
          navLinkHtml({
            href: serviceHrefForPage(pagePath, file),
            num: count,
            title: page.title || file.replace(/\.html$/i, ""),
            mobile,
          })
        );
      }
      if (!extras.length) return full;
      return `${open}${inner}\n                  ${extras.join(
        "\n                  "
      )}\n                ${close}`;
    }
  );
}

/**
 * Append simple cards on the services index rail for custom pages.
 */
export function injectCustomServiceCards(html, customPages, pagePath) {
  if (pagePath !== "services/index.html") return html;
  const list = Array.isArray(customPages) ? customPages : [];
  if (!list.length) return html;

  const cards = [];
  let n = (html.match(/class="cat-card/g) || []).length;
  for (const page of list) {
    const file = serviceFileFromPath(page.path);
    if (!file || html.includes(`href="${file}"`)) continue;
    n += 1;
    const title = escapeHtml(page.title || file.replace(/\.html$/i, ""));
    const desc = escapeHtml(
      page.description ||
        `${page.title || "This service"} for local businesses — edit this page in Site CMS.`
    );
    const img =
      escapeHtml(page.imageUrl || "") ||
      "../assets/images/shared/service-google-my-business.webp?v=8";
    const num = String(n).padStart(2, "0");
    cards.push(`
          <article class="cat-card reveal" data-custom-service="${escapeHtml(file)}">
            <figure class="overflow-hidden">
              <img src="${img}" alt="${title}"
                class="w-full object-cover object-center" width="1600" height="900" loading="lazy" decoding="async" />
            </figure>
            <div class="flex flex-col justify-between p-7">
              <div>
                <p class="text-xs text-ink/40">${num} · ${title}</p>
                <h2 class="mt-3 font-serif text-2xl sm:text-3xl">${title}</h2>
                <p class="mt-4 text-sm leading-relaxed text-ink/65">${desc}</p>
              </div>
              <a href="${escapeHtml(file)}" class="link-arrow mt-8 inline-flex w-fit text-sm font-medium">Read ${title}</a>
            </div>
          </article>`);
  }
  if (!cards.length) return html;

  return String(html).replace(
    /(<div class="cat-rail">)([\s\S]*?)(<\/div>\s*<\/div>\s*<\/section>)/i,
    (full, open, inner, close) => `${open}${inner}${cards.join("")}\n        ${close}`
  );
}
