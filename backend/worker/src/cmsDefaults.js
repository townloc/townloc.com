/** Default CMS payload — empty image URLs keep HTML defaults. */
export const CMS_DEFAULTS = {
  branding: {
    name: "Townloc",
    mark: "N",
    logoUrl: "/assets/images/townloc-logo.png",
    faviconUrl: "/assets/images/townloc-favicon.png",
  },
  header: {},
  footer: {},
  /** Auto-scanned header/footer menu overrides: { header: { "text:0": "…" }, footer: {…} } */
  layout: {
    header: {},
    footer: {},
  },
  /** WordPress-style menus: named menus + theme locations */
  customMenus: {
    menus: [
      { id: "menu_primary", name: "Primary Menu", items: [] },
      { id: "menu_footer", name: "Footer Menu", items: [] },
    ],
    locations: {
      primary: "menu_primary",
      footer: "menu_footer",
    },
  },
  autoPages: {},
  /** User-created service pages: [{ path, title, description?, imageUrl?, created_at }] */
  customPages: [],
  pages: {
    home: {
      hero_eyebrow:
        "Google Business Profile · Google Reviews · Google Ads · Website Building · Local SEO · Remove Negative Reviews",
      hero_title: "Get Found on Google. Build Trust. Turn Searches Into Customers.",
      hero_lead:
        "We help local businesses improve their Google Business Profile, earn genuine customer reviews, run Google Ads, build websites, strengthen Local SEO, and carefully handle harmful reviews — so searches turn into calls, bookings, and leads.",
      hero_image: "",
      hero_cta_primary: "Get a Free Assessment",
      hero_cta_secondary: "Explore Services",
      trust_label: "Why Businesses Choose Townloc",
      problem_eyebrow: "Why this matters",
      problem_title: "Your Customers Are Already Searching",
      problem_lead: "We fix the gaps between Google search and the customer.",
      problem_image: "",
      services_eyebrow: "What we do",
      services_title: "Six services. One stronger presence on Google.",
      services_lead:
        "Google Business Reviews, Google Business Profile, Google Ads, Web Development, Local SEO, and Remove Negative Reviews — built to work together and owned by you.",
      svc1_label: "01 · Google Business Profile",
      svc1_title: "Get Your Google Business Profile Working for You",
      svc1_lead:
        "We set up, fix, and optimize your Google Business Profile so customers can find the right business information when they search.",
      svc1_cta: "Optimize My Profile →",
      svc2_label: "02 · Google Reviews",
      svc2_title: "Get More Genuine Google Reviews",
      svc2_lead:
        "Turn completed jobs and happy customers into authentic Google reviews that build trust before someone calls.",
      svc2_cta: "Improve My Reviews →",
      svc3_label: "03 · Google Ads",
      svc3_title: "Get In Front of Customers Ready to Buy",
      svc3_lead:
        "We build Google Search campaigns around high-intent searches so your budget is focused on people actively looking for your service.",
      svc3_cta: "Launch My Google Ads →",
      svc4_label: "04 · Website Building",
      svc4_title: "Turn Google Visitors Into Customers",
      svc4_lead:
        "Fast, mobile-friendly websites built around calls, bookings, quote requests, and local search—not just pretty pages.",
      svc4_cta: "Build My Website →",
      svc5_label: "05 · Local SEO",
      svc5_title: "Get Found by Local Customers Searching Nearby",
      svc5_lead:
        "We improve your local search presence so nearby customers can find your business when they need your service.",
      svc5_cta: "Grow My Local SEO →",
      svc6_label: "06 · Remove Negative Reviews",
      svc6_title: "Handle Harmful Reviews the Right Way",
      svc6_lead:
        "We help you address unfair or damaging Google reviews with a careful process that protects your reputation.",
      svc6_cta: "Fix My Reviews →",
      svc_card_gbp_image: "",
      svc_card_reviews_image: "",
      svc_card_ads_image: "",
      svc_card_web_image: "",
      svc_card_local_image: "",
      svc_card_neg_image: "",
      journey_eyebrow: "How they work together",
      journey_title: "They stack. They do not replace each other.",
      journey_lead:
        "A complete Google Business Profile tells the truth. Reviews make the tap feel safe. Ads can buy the click. A website gives it somewhere to land.",
      journey_footer: "One Customer Journey",
      industries_eyebrow: "Who we help",
      industries_title: "Built for Local Businesses",
      industries_lead:
        "Home-service companies, trades, and local shops that need Google to send real customers — not just traffic.",
      ind_plumbing_image: "",
      ind_hvac_image: "",
      ind_electrician_image: "",
      ind_roofing_image: "",
      ind_landscaping_image: "",
      ind_auto_image: "",
      ind_cleaning_image: "",
      ind_salon_image: "",
      deliverables_eyebrow: "What you actually get",
      deliverables_title: "Clear deliverables. No mystery work.",
      deliverables_lead: "Real assets you can see, use, and own — depending on the service you choose.",
      deliv_gbp_image: "",
      deliv_reviews_image: "",
      deliv_ads_image: "",
      deliv_website_image: "",
      deliv_local_image: "",
      deliv_neg_image: "",
      process_eyebrow: "How it works",
      process_title: "From assessment to assets you own.",
      process_1_title: "Tell Us About Your Business",
      process_1_lead: "Send your website, Google Business Profile, or business details.",
      process_2_title: "We Find the Gaps",
      process_2_lead:
        "We identify what's stopping customers from finding, trusting, or contacting you.",
      process_3_title: "We Build & Optimize",
      process_3_lead: "We implement the selected service.",
      process_4_title: "You Get Full Access",
      process_4_lead: "Your business assets stay under your control.",
      process_cta: "Get My Free Assessment",
      work_eyebrow: "How we approach the work",
      work_title: "Work That Looks Good Because It Works",
      work_lead:
        "Every business has a different gap. We identify what is holding back visibility, trust, or conversions — then fix the right piece.",
      work_note:
        "These are demonstration examples. Real client case studies will be added as projects are completed and contracts allow.",
      trust_eyebrow: "Built around trust",
      trust_title: "We believe local marketing should be transparent, measurable, and owned by the business.",
      trust_lead: "Your business should own its growth system.",
      faq_eyebrow: "FAQ",
      faq_title: "Questions we hear before getting started",
      faq_lead:
        "Straight answers. If your question is about one service only, the page for that service has more.",
      faq1_q: "What services do you provide?",
      faq1_a:
        "Six core services: Google Business Profile, Google Reviews, Google Ads, Website Building, Local SEO, and Remove Negative Reviews. Most local businesses need more than one over time.",
      faq2_q: "Do you work with my type of business?",
      faq2_a:
        "Yes — if customers search Google before they call, book, or visit. We work with home services, trades, clinics, restaurants, retail, and other local businesses.",
      faq3_q: "Do you buy Google reviews?",
      faq3_a:
        "No. We never buy stars, farm accounts, or post fake check-ins. Review work is a timed ask after a real job so customers who already used you can write what they experienced.",
      faq4_q: "Can you help if I don't have a Google Business Profile?",
      faq4_a:
        "Yes. We can claim, verify, and build out a new profile — or fix an existing one that is thin, wrong, or unclaimed.",
      faq5_q: "Do I need a website?",
      faq5_a:
        "Not always on day one — but a website gives ads and organic traffic somewhere to convert. If you do not have one, or yours does not work on mobile, see web development.",
      faq6_q: "Who pays for Google Ads?",
      faq6_a:
        "You pay Google for media. Townloc builds and runs the campaigns. We do not mark up a mystery ad budget. The invoice from Google is yours to see.",
      faq7_q: "Who owns my website?",
      faq7_a:
        "You do. Website source files are yours. Cloudflare hosting and SSL are set up at no extra charge on web projects. You pay only for the domain.",
      faq8_q: "Do I keep my Google account?",
      faq8_a:
        "Yes. The Business Profile stays in an account in your name. We work inside your access — not a locked dashboard you cannot leave with.",
      mid_cta_eyebrow: "Free assessment",
      mid_cta_title: "Not Sure What Your Business Needs?",
      mid_cta_lead:
        "Send us your website or Google Business Profile. We'll review where you're losing visibility, trust, or leads and recommend the best place to start.",
      cta_image: "",
      contact_eyebrow: "Contact",
      contact_title: "Tell us where the business stands.",
      contact_lead: "Let's build what your business actually needs.",
    },
    services: {
      title: "",
      lead: "",
      hero_image: "",
    },
    industries: {
      title: "",
      lead: "",
    },
    privacy: {
      title: "",
      lead: "",
    },
    terms: {
      title: "",
      lead: "",
    },
    "services/google-business-profile-setup": {
      title: "",
      lead: "",
      hero_image: "",
      problem_image: "",
      cta_image: "",
      ind_1_image: "",
      ind_2_image: "",
      ind_3_image: "",
      ind_4_image: "",
    },
    "services/google-maps-review-management": {
      title: "",
      lead: "",
      hero_image: "",
      problem_image: "",
      cta_image: "",
      ind_1_image: "",
      ind_2_image: "",
      ind_3_image: "",
      ind_4_image: "",
      ind_5_image: "",
      ind_6_image: "",
    },
    "services/google-ads-campaigns": {
      title: "",
      lead: "",
      hero_image: "",
      problem_image: "",
      cta_image: "",
      ind_1_image: "",
      ind_2_image: "",
      ind_3_image: "",
      ind_4_image: "",
      ind_5_image: "",
      ind_6_image: "",
    },
    "services/web-development": {
      title: "",
      lead: "",
      hero_image: "",
      problem_image: "",
      cta_image: "",
      ind_1_image: "",
      ind_2_image: "",
      ind_3_image: "",
      ind_4_image: "",
    },
    "services/local-seo": {
      title: "",
      lead: "",
      hero_image: "",
      problem_image: "",
      cta_image: "",
      ind_1_image: "",
      ind_2_image: "",
      ind_3_image: "",
      ind_4_image: "",
    },
    "services/remove-negative-reviews": {
      title: "",
      lead: "",
      hero_image: "",
      problem_image: "",
      cta_image: "",
      ind_1_image: "",
      ind_2_image: "",
      ind_3_image: "",
      ind_4_image: "",
      ind_5_image: "",
      ind_6_image: "",
    },
  },
};

function fieldsFromKeys(obj, labels) {
  return Object.keys(obj).map((key) => {
    const isUrl =
      key === "logoUrl" ||
      key === "faviconUrl" ||
      key.endsWith("_image") ||
      /_image$/i.test(key);
    const isLong =
      /lead|tagline|guaranteeText|hero_title|hero_lead|services_lead|problem_lead|services_title|journey_title|journey_lead|work_lead|work_note|trust_title|faq_lead|faq\d_a|mid_cta_lead|process_\d_lead|svc\d_lead|svc\d_title/.test(
        key
      );
    return {
      key,
      label: (labels && labels[key]) || key.replace(/_/g, " "),
      type: isUrl ? "url" : isLong ? "textarea" : "text",
    };
  });
}

const homeLabels = {
  hero_image: "Hero banner image URL",
  problem_image: "Problem section image URL",
  svc_card_gbp_image: "Service card · GBP image URL",
  svc_card_reviews_image: "Service card · Reviews image URL",
  svc_card_ads_image: "Service card · Ads image URL",
  svc_card_web_image: "Service card · Web image URL",
  svc_card_local_image: "Service card · Local SEO image URL",
  svc_card_neg_image: "Service card · Neg. reviews image URL",
  ind_plumbing_image: "Industry · Plumbing image URL",
  ind_hvac_image: "Industry · HVAC image URL",
  ind_electrician_image: "Industry · Electrician image URL",
  ind_roofing_image: "Industry · Roofing image URL",
  ind_landscaping_image: "Industry · Landscaping image URL",
  ind_auto_image: "Industry · Auto image URL",
  ind_cleaning_image: "Industry · Cleaning image URL",
  ind_salon_image: "Industry · Salon image URL",
  deliv_gbp_image: "Deliverable · GBP image URL",
  deliv_reviews_image: "Deliverable · Reviews image URL",
  deliv_ads_image: "Deliverable · Ads image URL",
  deliv_website_image: "Deliverable · Website image URL",
  deliv_local_image: "Deliverable · Local SEO image URL",
  deliv_neg_image: "Deliverable · Neg. reviews image URL",
  cta_image: "Mid-CTA / assessment image URL",
  journey_eyebrow: "Journey eyebrow",
  journey_title: "Journey title",
  journey_lead: "Journey lead",
  journey_footer: "Journey footer label",
  industries_eyebrow: "Industries eyebrow",
  industries_title: "Industries title",
  industries_lead: "Industries lead",
  deliverables_eyebrow: "Deliverables eyebrow",
  deliverables_title: "Deliverables title",
  deliverables_lead: "Deliverables lead",
  process_eyebrow: "Process eyebrow",
  process_title: "Process title",
  process_cta: "Process CTA button",
  work_eyebrow: "Work eyebrow",
  work_title: "Work title",
  work_lead: "Work lead",
  work_note: "Work note",
  trust_eyebrow: "Trust section eyebrow",
  trust_title: "Trust section title",
  trust_lead: "Trust section lead",
  trust_label: "Trust strip label (top)",
  faq_eyebrow: "FAQ eyebrow",
  faq_title: "FAQ title",
  faq_lead: "FAQ lead",
  mid_cta_eyebrow: "Free assessment eyebrow",
  mid_cta_title: "Free assessment title",
  mid_cta_lead: "Free assessment lead",
  contact_eyebrow: "Contact eyebrow",
  contact_title: "Contact title",
  contact_lead: "Contact lead",
};

const svcPageLabels = {
  title: "Hero / page title",
  lead: "Hero lead text",
  hero_image: "Hero image URL",
  problem_image: "Problem image URL",
  cta_image: "CTA image URL",
  ind_1_image: "Industry image 1 URL",
  ind_2_image: "Industry image 2 URL",
  ind_3_image: "Industry image 3 URL",
  ind_4_image: "Industry image 4 URL",
  ind_5_image: "Industry image 5 URL",
  ind_6_image: "Industry image 6 URL",
};

export const CMS_FIELD_META = {
  branding: [
    { key: "name", label: "Brand name", type: "text" },
    { key: "mark", label: "Header mark letter (if no logo URL)", type: "text" },
    { key: "logoUrl", label: "Logo image URL", type: "url" },
    { key: "faviconUrl", label: "Favicon image URL", type: "url" },
  ],
  // header/footer menus are auto-scanned (see layout) — not hardcoded per site
  header: [],
  footer: [],
  pages: {
    home: fieldsFromKeys(CMS_DEFAULTS.pages.home, homeLabels),
    services: [
      { key: "title", label: "Page title", type: "text" },
      { key: "lead", label: "Page lead", type: "textarea" },
      { key: "hero_image", label: "Hero image URL", type: "url" },
    ],
    industries: [
      { key: "title", label: "Page title", type: "text" },
      { key: "lead", label: "Page lead", type: "textarea" },
    ],
    privacy: [
      { key: "title", label: "Page title override", type: "text" },
      { key: "lead", label: "Intro lead override", type: "textarea" },
    ],
    terms: [
      { key: "title", label: "Page title override", type: "text" },
      { key: "lead", label: "Intro lead override", type: "textarea" },
    ],
    "services/google-business-profile-setup": fieldsFromKeys(
      CMS_DEFAULTS.pages["services/google-business-profile-setup"],
      svcPageLabels
    ),
    "services/google-maps-review-management": fieldsFromKeys(
      CMS_DEFAULTS.pages["services/google-maps-review-management"],
      svcPageLabels
    ),
    "services/google-ads-campaigns": fieldsFromKeys(
      CMS_DEFAULTS.pages["services/google-ads-campaigns"],
      svcPageLabels
    ),
    "services/web-development": fieldsFromKeys(
      CMS_DEFAULTS.pages["services/web-development"],
      svcPageLabels
    ),
    "services/local-seo": fieldsFromKeys(
      CMS_DEFAULTS.pages["services/local-seo"],
      svcPageLabels
    ),
    "services/remove-negative-reviews": fieldsFromKeys(
      CMS_DEFAULTS.pages["services/remove-negative-reviews"],
      svcPageLabels
    ),
  },
};

export function deepMerge(base, patch) {
  if (!patch || typeof patch !== "object") return base;
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const key of Object.keys(patch)) {
    const pv = patch[key];
    if (
      pv &&
      typeof pv === "object" &&
      !Array.isArray(pv) &&
      base &&
      typeof base[key] === "object" &&
      base[key] &&
      !Array.isArray(base[key])
    ) {
      out[key] = deepMerge(base[key], pv);
    } else if (pv !== undefined) {
      out[key] = pv;
    }
  }
  return out;
}
