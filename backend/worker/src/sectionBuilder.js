/**
 * Section builder — JSON sections → service page HTML (D1).
 */

import { escapeHtml, slugifyTitle } from "./pageTemplate.js";

export const SECTION_TYPES = [
  {
    type: "hero",
    label: "Hero",
    hint: "Title, text, image, buttons",
  },
  {
    type: "textImage",
    label: "Text + image",
    hint: "Heading, body, and image (left or right)",
  },
  {
    type: "cards",
    label: "Cards",
    hint: "Grid of title + text cards",
  },
  {
    type: "checklist",
    label: "Checklist",
    hint: "Heading + bullet list",
  },
  {
    type: "faq",
    label: "FAQ",
    hint: "Expandable questions",
  },
  {
    type: "cta",
    label: "Call to action",
    hint: "Heading, text, button",
  },
  {
    type: "contact",
    label: "Contact",
    hint: "Full contact / assessment form",
  },
];

function uid() {
  return (
    "s_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 8)
  );
}

export function defaultSection(type) {
  const t = String(type || "textImage");
  if (t === "hero") {
    return {
      id: uid(),
      type: "hero",
      eyebrow: "Service",
      title: "Your service headline.",
      lead: "Short supporting text that explains the offer.",
      imageUrl: "/assets/images/services/local-seo/hero.jpg",
      primaryLabel: "Get Started",
      primaryHref: "/#contact",
      secondaryLabel: "See how it works",
      secondaryHref: "#details",
    };
  }
  if (t === "cards") {
    return {
      id: uid(),
      type: "cards",
      title: "What you get",
      items: [
        { title: "Point one", text: "Describe this benefit in one or two lines." },
        { title: "Point two", text: "Describe this benefit in one or two lines." },
        { title: "Point three", text: "Describe this benefit in one or two lines." },
      ],
    };
  }
  if (t === "checklist") {
    return {
      id: uid(),
      type: "checklist",
      title: "What’s included",
      items: ["First item", "Second item", "Third item", "Fourth item"],
    };
  }
  if (t === "faq") {
    return {
      id: uid(),
      type: "faq",
      title: "Questions",
      items: [
        {
          q: "How does this work?",
          a: "Add a clear answer customers would actually ask.",
        },
        {
          q: "How long does it take?",
          a: "Give a realistic timeframe.",
        },
      ],
    };
  }
  if (t === "cta") {
    return {
      id: uid(),
      type: "cta",
      title: "Ready to start?",
      text: "Tell us about your business and we’ll map the next step.",
      buttonLabel: "Get Started",
      buttonHref: "/#contact",
    };
  }
  if (t === "contact") {
    return {
      id: uid(),
      type: "contact",
      eyebrow: "Free Assessment",
      title: "Tell us about your local presence.",
      text: "We'll review what you share and explain what you need — clearly, without pressure.",
    };
  }
  // textImage
  return {
    id: uid(),
    type: "textImage",
    title: "Section heading",
    body: "Write the main copy for this section. Keep it clear and useful.",
    imageUrl: "/assets/images/services/local-seo/hero.jpg",
    imageSide: "right",
  };
}

export function defaultSectionsForNewPage(opts) {
  // Blank-ish start: one default Hero only. User adds more via +.
  const hero = defaultSection("hero");
  const title = String((opts && opts.title) || "").trim();
  const description = String((opts && opts.description) || "").trim();
  const imageUrl = String((opts && opts.imageUrl) || "").trim();
  if (title) {
    hero.eyebrow = "Service";
    hero.title = title.endsWith(".") ? title : `${title}.`;
  }
  if (description) hero.lead = description;
  if (imageUrl) hero.imageUrl = imageUrl;
  return [hero];
}

function safe(s) {
  return escapeHtml(s == null ? "" : String(s));
}

function renderHero(s) {
  const secondary =
    s.secondaryLabel && String(s.secondaryLabel).trim()
      ? `<a href="${safe(s.secondaryHref || "#")}" class="btn-secondary">${safe(
          s.secondaryLabel
        )}</a>`
      : "";
  return `
<section class="relative overflow-hidden border-b border-ink/10">
  <div class="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-2 lg:items-center lg:gap-14 lg:px-6 lg:py-20">
    <div>
      <p class="text-xs font-medium uppercase tracking-[0.22em] text-ink/45">${safe(
        s.eyebrow || "Service"
      )}</p>
      <h1 class="svc-hero-title mt-4 font-semibold text-ink">${safe(s.title)}</h1>
      <p class="svc-lead mt-5 max-w-xl">${safe(s.lead)}</p>
      <div class="mt-8 flex flex-wrap gap-3">
        <a href="${safe(s.primaryHref || "/#contact")}" class="btn-primary">${safe(
          s.primaryLabel || "Get Started"
        )}</a>
        ${secondary}
      </div>
    </div>
    <figure class="reveal overflow-hidden rounded-2xl border border-ink/10 bg-ink/[0.03]">
      <img src="${safe(s.imageUrl || "")}" alt="" class="h-full w-full object-cover" loading="eager" />
    </figure>
  </div>
</section>`;
}

function renderTextImage(s) {
  const imageUrl = String(s.imageUrl || "").trim();
  const text = `
    <div>
      <h2 class="svc-section-title font-semibold text-ink">${safe(s.title)}</h2>
      <p class="svc-lead mt-5 whitespace-pre-line">${safe(s.body)}</p>
    </div>`;
  if (!imageUrl) {
    return `
<section id="details" class="border-b border-ink/10">
  <div class="mx-auto max-w-6xl px-4 py-14 lg:px-6 lg:py-20">
    ${text}
  </div>
</section>`;
  }
  const imageFirst = String(s.imageSide || "right") === "left";
  const image = `
    <figure class="reveal overflow-hidden rounded-2xl border border-ink/10 bg-ink/[0.03]">
      <img src="${safe(imageUrl)}" alt="" class="h-full w-full object-cover" loading="lazy" />
    </figure>`;
  return `
<section id="details" class="border-b border-ink/10">
  <div class="mx-auto grid max-w-6xl gap-10 px-4 py-14 lg:grid-cols-2 lg:items-center lg:gap-14 lg:px-6 lg:py-20">
    ${imageFirst ? image + text : text + image}
  </div>
</section>`;
}

function renderCards(s) {
  const items = Array.isArray(s.items) ? s.items : [];
  const cards = items
    .map(
      (it) => `
      <article class="optimize-card reveal rounded-2xl border border-ink/10 bg-white p-6">
        <h3 class="text-lg font-semibold text-ink">${safe(it.title)}</h3>
        <p class="mt-3 text-ink/65">${safe(it.text)}</p>
      </article>`
    )
    .join("");
  return `
<section class="border-b border-ink/10 bg-ink/[0.02]">
  <div class="mx-auto max-w-6xl px-4 py-14 lg:px-6 lg:py-20">
    <h2 class="svc-section-title font-semibold text-ink">${safe(s.title)}</h2>
    <div class="optimize-grid mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">${cards}</div>
  </div>
</section>`;
}

function renderChecklist(s) {
  const items = Array.isArray(s.items) ? s.items : [];
  const lis = items
    .map((it) => `<li class="border-t border-ink/10 py-3 text-ink/80">${safe(it)}</li>`)
    .join("");
  return `
<section class="border-b border-ink/10">
  <div class="mx-auto max-w-6xl px-4 py-14 lg:px-6 lg:py-20">
    <div class="checklist-panel reveal mx-auto max-w-3xl rounded-2xl border border-ink/10 bg-white p-8">
      <h2 class="svc-section-title font-semibold text-ink">${safe(s.title)}</h2>
      <ul class="checklist-grid mt-8">${lis}</ul>
    </div>
  </div>
</section>`;
}

function renderFaq(s) {
  const items = Array.isArray(s.items) ? s.items : [];
  const rows = items
    .map(
      (it) => `
      <details class="group border-b border-ink/10 py-4">
        <summary class="cursor-pointer list-none font-medium text-ink outline-none">${safe(
          it.q
        )}</summary>
        <p class="mt-3 text-ink/65">${safe(it.a)}</p>
      </details>`
    )
    .join("");
  return `
<section class="border-b border-ink/10">
  <div class="mx-auto max-w-3xl px-4 py-14 lg:px-6 lg:py-20">
    <h2 class="svc-section-title font-semibold text-ink">${safe(s.title)}</h2>
    <div class="mt-8">${rows}</div>
  </div>
</section>`;
}

function renderCta(s) {
  return `
<section class="border-b border-ink/10 bg-ink text-white">
  <div class="mx-auto flex max-w-6xl flex-col items-start gap-6 px-4 py-14 lg:flex-row lg:items-center lg:justify-between lg:px-6 lg:py-16">
    <div>
      <h2 class="text-3xl font-semibold tracking-tight lg:text-4xl">${safe(s.title)}</h2>
      <p class="mt-3 max-w-xl text-white/70">${safe(s.text)}</p>
    </div>
    <a href="${safe(s.buttonHref || "/#contact")}" class="btn-primary">${safe(
      s.buttonLabel || "Get Started"
    )}</a>
  </div>
</section>`;
}

function renderContact(s) {
  // Same layout/markup as services/*.html contact form — not the teaser CTA.
  return `
<section id="contact" class="border-t border-line px-5 py-14 lg:px-8 lg:py-20">
  <div class="mx-auto grid max-w-7xl gap-10 lg:grid-cols-12 lg:items-start lg:gap-14">
    <div class="lg:col-span-5">
      <p class="text-xs font-medium uppercase tracking-[0.22em] text-ink/45">${safe(
        s.eyebrow || "Free Assessment"
      )}</p>
      <h2 class="svc-section-title mt-3 font-serif tracking-tight">${safe(
        s.title || "Tell us about your local presence."
      )}</h2>
      <p class="svc-lead mt-5">${safe(
        s.text ||
          "We'll review what you share and explain what you need — clearly, without pressure."
      )}</p>
    </div>
    <div class="lg:col-span-7">
      <form id="contract-form"
        class="reveal w-full rounded-[1.75rem] border border-line bg-white p-6 shadow-soft sm:p-8" novalidate>
        <div class="grid gap-5 sm:grid-cols-2">
          <label class="block text-sm"><span class="mb-1.5 block font-medium">Your name</span><input
              name="clientName" type="text" autocomplete="name" required placeholder="Jordan Hale"
              class="field-input w-full rounded-xl border border-line bg-paper/40 px-4 py-3 text-sm outline-none transition-all duration-300 ease-in-out focus:border-ink/40 focus:ring-2 focus:ring-ink/10" /></label>
          <label class="block text-sm"><span class="mb-1.5 block font-medium">Business email</span><input
              name="email" type="email" autocomplete="email" required placeholder="you@business.com"
              class="field-input w-full rounded-xl border border-line bg-paper/40 px-4 py-3 text-sm outline-none transition-all duration-300 ease-in-out focus:border-ink/40 focus:ring-2 focus:ring-ink/10" /></label>
          <label class="block text-sm"><span class="mb-1.5 block font-medium">Phone</span><input name="phone"
              type="tel" autocomplete="tel" required placeholder="+1 555 010 2841"
              class="field-input w-full rounded-xl border border-line bg-paper/40 px-4 py-3 text-sm outline-none transition-all duration-300 ease-in-out focus:border-ink/40 focus:ring-2 focus:ring-ink/10" /></label>
          <label class="block text-sm"><span class="mb-1.5 block font-medium">Company name</span><input
              name="businessName" type="text" autocomplete="organization" required
              placeholder="Hale &amp; Co. Plumbing"
              class="field-input w-full rounded-xl border border-line bg-paper/40 px-4 py-3 text-sm outline-none transition-all duration-300 ease-in-out focus:border-ink/40 focus:ring-2 focus:ring-ink/10" /></label>
          <label class="block text-sm sm:col-span-2"><span class="mb-1.5 block font-medium">Selected service</span>
            <select name="service" required
              class="field-input w-full rounded-xl border border-line bg-paper/40 px-4 py-3 text-sm outline-none transition-all duration-300 ease-in-out focus:border-ink/40 focus:ring-2 focus:ring-ink/10">
              <option value="Google Business Profile Setup">Google Business Profile Setup</option>
              <option value="Google Business Reviews">Google Business Reviews</option>
              <option value="Google Ads Campaigns">Google Ads Campaigns</option>
              <option value="Web Design &amp; Development">Web Design &amp; Development</option>
              <option value="Local SEO">Local SEO</option>
              <option value="Remove Negative Reviews">Remove Negative Reviews</option>
              <option value="Not sure yet" selected>Not sure yet</option>
            </select>
          </label>
          <label class="block text-sm sm:col-span-2"><span class="mb-1.5 block font-medium">Google Business Profile
              URL</span><input name="mapsLink" type="url" placeholder="https://maps.google.com/..."
              class="field-input w-full rounded-xl border border-line bg-paper/40 px-4 py-3 text-sm outline-none transition-all duration-300 ease-in-out focus:border-ink/40 focus:ring-2 focus:ring-ink/10" /><span
              class="mt-1 block text-xs text-ink/45">Optional. Paste the public listing URL.</span></label>
          <label class="block text-sm sm:col-span-2"><span class="mb-1.5 block font-medium">Message</span>
            <textarea name="message" rows="4"
              placeholder="Tell us about your local visibility or what you want to improve..."
              class="field-input w-full resize-y rounded-xl border border-line bg-paper/40 px-4 py-3 text-sm outline-none transition-all duration-300 ease-in-out focus:border-ink/40 focus:ring-2 focus:ring-ink/10"></textarea>
          </label>
        </div>
        <div class="hp-wrap" aria-hidden="true" tabindex="-1"><label>Leave blank<input type="text" name="website2" autocomplete="off" tabindex="-1" /></label></div>
        <p id="form-error" class="mt-4 hidden text-sm text-red-700" role="alert"></p>
        <button type="submit"
          class="btn-primary mt-6 w-full sm:w-auto">Get My Free
          Assessment</button>
      </form>
      <div id="form-success"
        class="hidden success-pop w-full rounded-[1.75rem] border border-line bg-white p-10 text-center shadow-soft">
        <p class="font-serif text-3xl">Request Received</p>
        <p id="success-copy" class="mx-auto mt-4 max-w-md text-sm leading-relaxed text-ink/65"></p>
        <button id="send-another" type="button"
          class="mt-8 text-sm underline underline-offset-4 transition-all duration-300 ease-in-out hover:opacity-70">Send
          another request</button>
      </div>
    </div>
  </div>
</section>`;
}

export function renderSection(section) {
  if (!section || !section.type) return "";
  switch (section.type) {
    case "hero":
      return renderHero(section);
    case "textImage":
      return renderTextImage(section);
    case "cards":
      return renderCards(section);
    case "checklist":
      return renderChecklist(section);
    case "faq":
      return renderFaq(section);
    case "cta":
      return renderCta(section);
    case "contact":
      return renderContact(section);
    default:
      return "";
  }
}

export function renderSectionsHtml(sections) {
  return (Array.isArray(sections) ? sections : []).map(renderSection).join("\n");
}

/**
 * Take local-seo (or any service) template shell and replace <main> body with sections.
 */
export function compileServicePageFromSections(templateHtml, opts) {
  const title = String(opts.title || "New Service").trim();
  const slug = String(opts.slug || slugifyTitle(title));
  // Independent CMS pages live at site root: /{slug} (stored as {slug}.html).
  const path = `${slug}.html`;
  const description = String(
    opts.description ||
      `${title} for local businesses. Townloc helps you get found, build trust, and turn searches into customers.`
  ).trim();
  const imageUrl = String(opts.imageUrl || "").trim();
  const sections = Array.isArray(opts.sections)
    ? opts.sections
    : defaultSectionsForNewPage({ title, description, imageUrl });

  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);
  const canonical = `https://townloc.com/${slug}`;
  const ogImage =
    imageUrl ||
    "https://townloc.com/assets/images/services/local-seo/hero.jpg";

  let html = String(templateHtml);
  // Template is under /services/; root pages need absolute asset URLs.
  html = html.replace(/(href|src)="\.\.\/assets\//gi, '$1="/assets/');
  html = html.replace(
    /data-cms-page="[^"]*"/i,
    `data-cms-page="${slug}"`
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
  html = html.replace(
    /(<meta\s+name="twitter:title"\s+content=")([^"]*)(")/i,
    `$1${safeTitle} for Local Businesses | Townloc$3`
  );
  html = html.replace(
    /(<meta\s+name="twitter:description"\s+content=")([^"]*)(")/i,
    `$1${safeDesc}$3`
  );
  html = html.replace(
    /(<meta\s+name="twitter:image"\s+content=")([^"]*)(")/i,
    `$1${escapeHtml(ogImage)}$3`
  );

  const mainInner = `
    <div class="border-b border-ink/10 bg-white">
      <div class="mx-auto max-w-6xl px-4 py-4 lg:px-6">
        <nav aria-label="Breadcrumb">
          <ol class="flex flex-wrap items-center gap-2 text-sm text-ink/55">
            <li><a href="/" class="hover:text-ink">Home</a></li>
            <li aria-hidden="true">/</li>
            <li class="text-ink/70">${safeTitle}</li>
          </ol>
        </nav>
      </div>
    </div>
    ${renderSectionsHtml(sections)}`;

  if (/<main\b[^>]*>[\s\S]*?<\/main>/i.test(html)) {
    html = html.replace(
      /<main\b[^>]*>[\s\S]*?<\/main>/i,
      `<main id="main" class="pt-[4.5rem] lg:pt-0">${mainInner}</main>`
    );
  } else {
    html += `<main id="main">${mainInner}</main>`;
  }

  return { html, path, slug, sections };
}

export function normalizeSections(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((s) => s && typeof s === "object" && s.type)
    .map((s) => {
      const base = defaultSection(s.type);
      const merged = { ...base, ...s, id: s.id || base.id, type: s.type };
      if (s.type === "cards" || s.type === "faq") {
        merged.items = Array.isArray(s.items) ? s.items : base.items;
      }
      if (s.type === "checklist") {
        merged.items = Array.isArray(s.items)
          ? s.items.map((x) => String(x))
          : base.items;
      }
      return merged;
    });
}
