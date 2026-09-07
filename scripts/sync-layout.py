#!/usr/bin/env python3
"""Apply homepage header and footer to all site pages."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

SERVICES = {
    "gbp": "google-business-profile-setup.html",
    "reviews": "google-maps-review-management.html",
    "ads": "google-ads-campaigns.html",
    "web": "web-development.html",
    "local-seo": "local-seo.html",
    "neg-reviews": "remove-negative-reviews.html",
}


def ac(current, key):
    return ' aria-current="page"' if current == key else ""


def render_header(prefix: str, services_prefix: str, industries_prefix: str, home: str, hash_base: str, current=None, contact_href=None):
    contact = contact_href if contact_href is not None else f"{hash_base}#contact"
    return f"""  <header id="site-header" class="fixed inset-x-0 top-0 z-50 border-b border-white/10 text-paper">
    <nav class="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 lg:px-8" aria-label="Primary">
      <a href="{home}" class="flex items-center gap-2.5 transition-all duration-300 ease-in-out hover:opacity-90">
        <span
          class="header-mark grid h-8 w-8 place-items-center rounded-lg bg-paper text-[11px] font-semibold tracking-wide text-ink">N</span>
        <span class="text-[15px] font-semibold tracking-tight">Townloc</span>
      </a>
      <ul class="hidden items-center gap-8 text-sm md:flex">
        <li class="nav-drop relative">
          <button type="button" class="nav-drop-btn nav-link inline-flex items-center gap-1 opacity-85"
            aria-expanded="false" aria-haspopup="true">
            Services
            <svg class="nav-drop-caret h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="1.8"
              viewBox="0 0 24 24" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6" />
            </svg>
          </button>
          <div class="nav-drop-menu absolute left-1/2 top-full z-50 w-[min(22rem,calc(100vw-2rem))] pt-3">
            <div class="nav-drop-panel rounded-[1.35rem] p-1.5">
              <a class="nav-drop-item" href="{services_prefix}google-business-profile-setup.html"{ac(current, "gbp")}><span
                  class="nav-drop-num">01</span><span class="nav-drop-name">Google Business Profile</span><span
                  class="nav-drop-arrow">→</span></a>
              <a class="nav-drop-item" href="{services_prefix}google-maps-review-management.html"{ac(current, "reviews")}><span
                  class="nav-drop-num">02</span><span class="nav-drop-name">Google Reviews</span><span
                  class="nav-drop-arrow">→</span></a>
              <a class="nav-drop-item" href="{services_prefix}google-ads-campaigns.html"{ac(current, "ads")}><span
                  class="nav-drop-num">03</span><span class="nav-drop-name">Google Ads</span><span
                  class="nav-drop-arrow">→</span></a>
              <a class="nav-drop-item" href="{services_prefix}web-development.html"{ac(current, "web")}><span class="nav-drop-num">04</span><span
                  class="nav-drop-name">Website Building</span><span class="nav-drop-arrow">→</span></a>
              <a class="nav-drop-item" href="{services_prefix}local-seo.html"{ac(current, "local-seo")}><span
                  class="nav-drop-num">05</span><span class="nav-drop-name">Local SEO</span><span
                  class="nav-drop-arrow">→</span></a>
              <a class="nav-drop-item" href="{services_prefix}remove-negative-reviews.html"{ac(current, "neg-reviews")}><span
                  class="nav-drop-num">06</span><span class="nav-drop-name">Remove Negative Reviews</span><span
                  class="nav-drop-arrow">→</span></a>
            </div>
          </div>
        </li>
        <li><a class="nav-link opacity-85" href="{hash_base}#industries"{ac(current, "industries")}>Industries</a></li>
        <li><a class="nav-link opacity-85" data-nav="work" href="{hash_base}#work">Work</a></li>
        <li><a class="nav-link opacity-85" data-nav="trust" href="{hash_base}#trust">Trust</a></li>
        <li><a class="nav-link opacity-85" data-nav="faq" href="{hash_base}#faq">FAQ</a></li>
        <li><a class="nav-link opacity-85" data-nav="contact" href="{contact}">Contact</a></li>
      </ul>
      <div class="flex items-center gap-3">
        <a href="{contact}"
          class="header-cta hidden rounded-full bg-paper px-4 py-2 text-sm font-medium text-ink transition-all duration-300 ease-in-out hover:scale-[1.03] hover:opacity-90 md:inline-flex">Get
          Started</a>
        <button id="menu-btn"
          class="grid h-10 w-10 place-items-center rounded-full border border-white/20 transition-all duration-300 ease-in-out md:hidden"
          aria-expanded="false" aria-controls="mobile-menu" aria-label="Open menu">
          <svg id="icon-open" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24">
            <path stroke-linecap="round" d="M4 7h16M4 12h16M4 17h16" />
          </svg>
          <svg id="icon-close" class="hidden h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8"
            viewBox="0 0 24 24">
            <path stroke-linecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </nav>
    <div id="mobile-menu" class="mobile-menu md:hidden" aria-hidden="true">
      <div class="mobile-menu-inner">
        <div class="mobile-menu-nav">
          <div class="mobile-menu-item">
            <button type="button" id="mobile-services-btn"
              class="mobile-services-btn" aria-expanded="false"
              aria-controls="mobile-services">Services
              <svg class="mobile-services-caret h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8"
                viewBox="0 0 24 24" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </button>
            <div id="mobile-services" class="mobile-services">
              <div class="mobile-services-clip">
                <div class="nav-drop-panel rounded-[1.35rem] p-1.5">
                  <a class="nav-drop-item mobile-link" href="{services_prefix}google-business-profile-setup.html"{ac(current, "gbp")}><span
                      class="nav-drop-num">01</span><span class="nav-drop-name">Google Business Profile</span></a>
                  <a class="nav-drop-item mobile-link" href="{services_prefix}google-maps-review-management.html"{ac(current, "reviews")}><span
                      class="nav-drop-num">02</span><span class="nav-drop-name">Google Reviews</span></a>
                  <a class="nav-drop-item mobile-link" href="{services_prefix}google-ads-campaigns.html"{ac(current, "ads")}><span
                      class="nav-drop-num">03</span><span class="nav-drop-name">Google Ads</span></a>
                  <a class="nav-drop-item mobile-link" href="{services_prefix}web-development.html"{ac(current, "web")}><span
                      class="nav-drop-num">04</span><span class="nav-drop-name">Website Building</span></a>
                  <a class="nav-drop-item mobile-link" href="{services_prefix}local-seo.html"{ac(current, "local-seo")}><span
                      class="nav-drop-num">05</span><span class="nav-drop-name">Local SEO</span></a>
                  <a class="nav-drop-item mobile-link" href="{services_prefix}remove-negative-reviews.html"{ac(current, "neg-reviews")}><span
                      class="nav-drop-num">06</span><span class="nav-drop-name">Remove Negative Reviews</span></a>
                </div>
              </div>
            </div>
          </div>
          <a href="{hash_base}#industries" class="mobile-link mobile-menu-item"{ac(current, "industries")}>Industries</a>
          <a href="{hash_base}#work" class="mobile-link mobile-menu-item">Work</a>
          <a href="{hash_base}#trust" class="mobile-link mobile-menu-item">Trust</a>
          <a href="{hash_base}#faq" class="mobile-link mobile-menu-item">FAQ</a>
          <a href="{contact}"
            class="mobile-link mobile-menu-item mobile-menu-cta">Contact</a>
        </div>
      </div>
    </div>
  </header>"""


def render_footer(services_prefix: str, hash_base: str, contact_href=None):
    contact = contact_href if contact_href is not None else f"{hash_base}#contact"
    blog_href = "../blog/index.html" if hash_base.startswith("../") else "blog/index.html"
    return f"""  <footer class="site-footer bg-ink px-5 py-14 text-paper lg:px-8">
    <div class="mx-auto max-w-7xl">
      <div class="footer-top">
        <div class="footer-col">
          <p class="footer-col-title">Townloc</p>
          <p class="footer-tagline">Local Google marketing for businesses that already do good work — profile, reviews,
            ads, and websites you own.</p>
        </div>
        <div class="footer-col">
          <p class="footer-col-title">Services</p>
          <ul>
            <li><a href="{services_prefix}google-maps-review-management.html">Reputation Management</a></li>
            <li><a href="{services_prefix}google-business-profile-setup.html">Google Business Profile</a></li>
            <li><a href="{services_prefix}google-ads-campaigns.html">Paid Advertising</a></li>
            <li><a href="{services_prefix}web-development.html">Web Design &amp; Development</a></li>
            <li><a href="{services_prefix}local-seo.html">Local SEO</a></li>
            <li><a href="{services_prefix}remove-negative-reviews.html">Remove Negative Reviews</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <p class="footer-col-title">Company</p>
          <ul>
            <li><a href="{hash_base}#work">Work</a></li>
            <li><a href="{blog_href}">Blog</a></li>
            <li><a href="{hash_base}#faq">FAQ</a></li>
            <li><a href="{hash_base}#trust">About</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <p class="footer-col-title">Ownership</p>
          <ul class="footer-ownership">
            <li>You own your website.</li>
            <li>You keep your accounts.</li>
            <li>Transparent work.</li>
          </ul>
        </div>
      </div>
      <div class="footer-guarantee">
        <p class="footer-guarantee-label">Client guarantee</p>
        <p class="footer-guarantee-text">100% Full Access &amp; Source-Code Ownership <span>|</span> Free Cloudflare
          Hosting &amp; SSL Setup <span>|</span> Pay Only for Domain</p>
      </div>
      <div class="footer-bottom">
        <p>© <span id="year"></span> Townloc</p>
        <a href="{contact}" class="footer-cta">Get a Free Assessment</a>
      </div>
    </div>
  </footer>"""


def replace_block(text: str, tag: str, replacement: str) -> str:
    pattern = rf"<{tag}\b[\s\S]*?</{tag}>"
    if not re.search(pattern, text):
        raise ValueError(f"Missing <{tag}> block")
    return re.sub(pattern, replacement.strip(), text, count=1)


def ensure_body_shell(text: str) -> str:
    if 'class="grain"' not in text:
        text = text.replace(
            "<body",
            '<body',
            1,
        )
        text = re.sub(
            r"(<body[^>]*>)",
            r'\1\n  <div class="grain" aria-hidden="true"></div>',
            text,
            count=1,
        )
    if 'href="#main"' not in text and "Skip" not in text[:2000]:
        text = re.sub(
            r"(<div class=\"grain\"[^>]*></div>\s*)",
            r'\1  <a href="#main"\n    class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-4 focus:py-2 focus:text-paper">Skip\n    to content</a>\n\n',
            text,
            count=1,
        )
    return text


def remove_year_script(text: str) -> str:
    return re.sub(
        r'\s*<script>document\.getElementById\("year"\)\.textContent = new Date\(\)\.getFullYear\(\);</script>',
        "",
        text,
    )


def apply(path: Path, header: str, footer: str):
    text = path.read_text(encoding="utf-8")
    text = ensure_body_shell(text)
    text = replace_block(text, "header", header)
    text = replace_block(text, "footer", footer)
    text = remove_year_script(text)
    if 'id="main"' in text and 'pt-24' not in text and 'pt-32' not in text:
        text = re.sub(
            r'(<main id="main")([^>]*)(>)',
            lambda m: m.group(1)
            + (' class="pt-24 lg:pt-28"' if 'class=' not in m.group(2) else m.group(2).replace('class="', 'class="pt-24 lg:pt-28 '))
            + m.group(3),
            text,
            count=1,
        )
    path.write_text(text, encoding="utf-8")
    print(f"Updated {path.relative_to(ROOT)}")


def main():
    configs = [
        # rel, prefix, services_prefix, industries_prefix, home, hash_base, current, contact_href
        ("privacy.html", "", "services/", "industries/", "index.html", "index.html", None, None),
        ("terms.html", "", "services/", "industries/", "index.html", "index.html", None, None),
        ("industries/index.html", "../", "../services/", "", "../index.html", "../index.html", None, None),
        ("services/index.html", "../", "", "../industries/", "../index.html", "../index.html", None, None),
        ("services/google-business-profile-setup.html", "../", "", "../industries/", "../index.html", "../index.html", "gbp", "#contact"),
        ("services/google-maps-review-management.html", "../", "", "../industries/", "../index.html", "../index.html", "reviews", "#contact"),
        ("services/google-ads-campaigns.html", "../", "", "../industries/", "../index.html", "../index.html", "ads", "#contact"),
        ("services/web-development.html", "../", "", "../industries/", "../index.html", "../index.html", "web", "#contact"),
        ("services/local-seo.html", "../", "", "../industries/", "../index.html", "../index.html", "local-seo", "#contact"),
        ("services/remove-negative-reviews.html", "../", "", "../industries/", "../index.html", "../index.html", "neg-reviews", "#contact"),
    ]

    for rel, prefix, services_prefix, industries_prefix, home, hash_base, current, contact_href in configs:
        path = ROOT / rel
        header = render_header(prefix, services_prefix, industries_prefix, home, hash_base, current, contact_href)
        footer = render_footer(services_prefix, hash_base, contact_href)
        apply(path, header, footer)

    # Normalize industries page body classes
    industries = ROOT / "industries/index.html"
    text = industries.read_text(encoding="utf-8")
    text = text.replace('class="bg-[#f4f1ea] text-[#111] antialiased"', 'class="bg-paper text-ink antialiased"')
    industries.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    main()
