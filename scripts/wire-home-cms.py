from pathlib import Path
import re

path = Path(r"d:\Dextop\Important files\townloc\index.html")
html = path.read_text(encoding="utf-8")

replacements = [
    (
        r'<p class="text-xs font-medium uppercase tracking-\[0\.22em\] text-muted">How they work together</p>',
        'data-cms="page.journey_eyebrow"',
    ),
    (
        r'<h2 class="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">They stack\. They do not replace each other\.\s*</h2>',
        'data-cms="page.journey_title"',
    ),
    (
        r'<p class="reveal mt-8 text-center text-sm uppercase tracking-\[0\.16em\] text-muted">One Customer Journey</p>',
        'data-cms="page.journey_footer"',
    ),
    (
        r'<p class="text-xs font-medium uppercase tracking-\[0\.22em\] text-muted">Who we help</p>',
        'data-cms="page.industries_eyebrow"',
    ),
    (
        r'<h2 class="section-heading mt-3 font-serif tracking-tight">Built for Local Businesses</h2>',
        'data-cms="page.industries_title"',
    ),
    (
        r'<p class="text-xs font-medium uppercase tracking-\[0\.22em\] text-muted">What you actually get</p>',
        'data-cms="page.deliverables_eyebrow"',
    ),
    (
        r'<h2 class="section-heading mt-3 font-serif tracking-tight">Clear deliverables\. No mystery work\.</h2>',
        'data-cms="page.deliverables_title"',
    ),
    (
        r'<p class="text-xs font-medium uppercase tracking-\[0\.22em\] text-ink/45">How it works</p>',
        'data-cms="page.process_eyebrow"',
    ),
    (
        r'<h2 class="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">From assessment to assets you own\.</h2>',
        'data-cms="page.process_title"',
    ),
    (
        r'<p class="text-xs font-medium uppercase tracking-\[0\.22em\] text-muted">How we approach the work</p>',
        'data-cms="page.work_eyebrow"',
    ),
    (
        r'<h2 class="work-compact-heading mt-2 font-serif tracking-tight">Work That Looks Good Because It Works</h2>',
        'data-cms="page.work_title"',
    ),
    (
        r'<p class="text-xs font-medium uppercase tracking-\[0\.22em\] text-muted">Built around trust</p>',
        'data-cms="page.trust_eyebrow"',
    ),
    (
        r'<p class="text-xs font-medium uppercase tracking-\[0\.22em\] text-muted">FAQ</p>',
        'data-cms="page.faq_eyebrow"',
    ),
    (
        r'<h2 class="section-heading mt-3 font-serif tracking-tight">Questions we hear before getting started</h2>',
        'data-cms="page.faq_title"',
    ),
    (
        r'<p class="text-xs font-medium uppercase tracking-\[0\.22em\] text-muted">Free assessment</p>',
        'data-cms="page.mid_cta_eyebrow"',
    ),
    (
        r'<h2 class="section-heading mt-3 font-serif tracking-tight">Not Sure What Your Business Needs\?</h2>',
        'data-cms="page.mid_cta_title"',
    ),
]

for pat, attr in replacements:
    m = re.search(pat, html, flags=re.S)
    if not m:
        print("MISS", attr)
        continue
    tag = m.group(0)
    if "data-cms=" in tag:
        print("SKIP", attr)
        continue
    new = re.sub(r"^<([a-zA-Z0-9]+)", rf"<\1 {attr}", tag, count=1)
    html = html[: m.start()] + new + html[m.end() :]
    print("OK", attr)

# journey lead paragraph
m = re.search(
    r'<p class="mt-4 text-muted">A complete Google Business Profile tells the truth[\s\S]*?</p>',
    html,
)
if m and "data-cms=" not in m.group(0):
    tag = m.group(0)
    new = tag.replace('<p class="mt-4 text-muted">', '<p class="mt-4 text-muted" data-cms="page.journey_lead">', 1)
    html = html[: m.start()] + new + html[m.end() :]
    print("OK journey_lead")

# industries lead
m = re.search(
    r'<p class="body-lg mt-4 text-muted">Home-service companies, trades[\s\S]*?</p>',
    html,
)
if m and "data-cms=" not in m.group(0):
    tag = m.group(0)
    new = tag.replace(
        '<p class="body-lg mt-4 text-muted">',
        '<p class="body-lg mt-4 text-muted" data-cms="page.industries_lead">',
        1,
    )
    html = html[: m.start()] + new + html[m.end() :]
    print("OK industries_lead")

# deliverables lead if present
m = re.search(
    r'<p class="body-lg mt-4 text-muted">Real assets you can see[\s\S]*?</p>',
    html,
)
if m and "data-cms=" not in m.group(0):
    new = m.group(0).replace(
        '<p class="body-lg mt-4 text-muted">',
        '<p class="body-lg mt-4 text-muted" data-cms="page.deliverables_lead">',
        1,
    )
    html = html[: m.start()] + new + html[m.end() :]
    print("OK deliverables_lead")

# work leads
m = re.search(
    r'<p class="mt-3 text-sm leading-relaxed text-muted">Every business has a different gap[\s\S]*?</p>',
    html,
)
if m and "data-cms=" not in m.group(0):
    new = m.group(0).replace(
        '<p class="mt-3 text-sm leading-relaxed text-muted">',
        '<p class="mt-3 text-sm leading-relaxed text-muted" data-cms="page.work_lead">',
        1,
    )
    html = html[: m.start()] + new + html[m.end() :]
    print("OK work_lead")

m = re.search(
    r'<p class="mt-2 text-sm leading-relaxed text-muted">These are demonstration examples[\s\S]*?</p>',
    html,
)
if m and "data-cms=" not in m.group(0):
    new = m.group(0).replace(
        '<p class="mt-2 text-sm leading-relaxed text-muted">',
        '<p class="mt-2 text-sm leading-relaxed text-muted" data-cms="page.work_note">',
        1,
    )
    html = html[: m.start()] + new + html[m.end() :]
    print("OK work_note")

# trust title (may be multiline)
m = re.search(
    r'<h2 class="trust-compact-heading mt-2 font-serif tracking-tight">We believe local marketing should be[\s\S]*?</h2>',
    html,
)
if m and "data-cms=" not in m.group(0):
    new = re.sub(
        r"^<h2 ",
        '<h2 data-cms="page.trust_title" ',
        m.group(0),
        count=1,
    )
    html = html[: m.start()] + new + html[m.end() :]
    print("OK trust_title")

# faq lead
m = re.search(
    r'<p class="body-lg mt-4 text-muted">Straight answers[\s\S]*?</p>',
    html,
)
if m and "data-cms=" not in m.group(0):
    new = m.group(0).replace(
        '<p class="body-lg mt-4 text-muted">',
        '<p class="body-lg mt-4 text-muted" data-cms="page.faq_lead">',
        1,
    )
    html = html[: m.start()] + new + html[m.end() :]
    print("OK faq_lead")

# mid cta lead
m = re.search(
    r'<p class="body-lg mt-4 text-muted">Send us your website or Google Business Profile[\s\S]*?</p>',
    html,
)
if m and "data-cms=" not in m.group(0):
    new = m.group(0).replace(
        '<p class="body-lg mt-4 text-muted">',
        '<p class="body-lg mt-4 text-muted" data-cms="page.mid_cta_lead">',
        1,
    )
    html = html[: m.start()] + new + html[m.end() :]
    print("OK mid_cta_lead")

card_titles = [
    ("Get Your Google Business Profile Working for You", "svc1_title"),
    ("Get More Genuine Google Reviews", "svc2_title"),
    ("Get In Front of Customers Ready to Buy", "svc3_title"),
    ("Turn Google Visitors Into Customers", "svc4_title"),
    ("Get Found by Local Customers Searching Nearby", "svc5_title"),
    ("Handle Harmful Reviews the Right Way", "svc6_title"),
]
for text, key in card_titles:
    pat = rf'<h3 class="mt-3 font-serif text-2xl leading-snug">{re.escape(text)}</h3>'
    m = re.search(pat, html)
    if m and "data-cms=" not in m.group(0):
        html = (
            html[: m.start()]
            + f'<h3 class="mt-3 font-serif text-2xl leading-snug" data-cms="page.{key}">{text}</h3>'
            + html[m.end() :]
        )
        print("OK", key)

labels = [
    ("01 · Google Business Profile", "svc1_label"),
    ("02 · Google Reviews", "svc2_label"),
    ("03 · Google Ads", "svc3_label"),
    ("04 · Website Building", "svc4_label"),
    ("05 · Local SEO", "svc5_label"),
    ("06 · Remove Negative Reviews", "svc6_label"),
]
for text, key in labels:
    pat = rf'<p class="text-xs tracking-\[0\.18em\] text-ink/40">{re.escape(text)}</p>'
    m = re.search(pat, html)
    if m and "data-cms=" not in m.group(0):
        html = (
            html[: m.start()]
            + f'<p class="text-xs tracking-[0.18em] text-ink/40" data-cms="page.{key}">{text}</p>'
            + html[m.end() :]
        )
        print("OK", key)

# service card leads - first flex-1 sm lead after each svc title
leads = [
    (
        "We set up, fix, and optimize your Google",
        "svc1_lead",
    ),
    (
        "Turn completed jobs and happy customers into",
        "svc2_lead",
    ),
    (
        "We build Google Search campaigns around",
        "svc3_lead",
    ),
    (
        "Fast, mobile-friendly websites built around calls",
        "svc4_lead",
    ),
    (
        "We improve your local search presence so nearby",
        "svc5_lead",
    ),
    (
        "We help you address unfair or damaging Google reviews",
        "svc6_lead",
    ),
]
for snippet, key in leads:
    m = re.search(
        rf'<p class="mt-3 flex-1 text-sm leading-relaxed text-ink/65">{re.escape(snippet)}[\s\S]*?</p>',
        html,
    )
    if not m:
        print("MISS", key)
        continue
    if "data-cms=" in m.group(0):
        continue
    new = m.group(0).replace(
        '<p class="mt-3 flex-1 text-sm leading-relaxed text-ink/65">',
        f'<p class="mt-3 flex-1 text-sm leading-relaxed text-ink/65" data-cms="page.{key}">',
        1,
    )
    html = html[: m.start()] + new + html[m.end() :]
    print("OK", key)

proc = [
    ("Tell Us About Your Business", "process_1_title"),
    ("We Find the Gaps", "process_2_title"),
    ("We Build &amp; Optimize", "process_3_title"),
    ("You Get Full Access", "process_4_title"),
]
for text, key in proc:
    pat = rf'<h3 class="mt-2 font-serif text-xl">{re.escape(text)}</h3>'
    m = re.search(pat, html)
    if m and "data-cms=" not in m.group(0):
        html = (
            html[: m.start()]
            + f'<h3 class="mt-2 font-serif text-xl" data-cms="page.{key}">{text}</h3>'
            + html[m.end() :]
        )
        print("OK", key)

path.write_text(html, encoding="utf-8")
print("done")
