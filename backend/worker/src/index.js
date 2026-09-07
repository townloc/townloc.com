/**
 * Townloc — Contact API + Admin CMS
 * POST /api/contact
 * Public posts + admin leads/posts/pages
 */

const MAX = {
  clientName: 120,
  email: 180,
  phone: 40,
  businessName: 160,
  mapsLink: 500,
  service: 80,
  message: 4000,
};

const ALLOWED_SERVICES = new Set([
  "Google Business Profile",
  "Google Reviews & Reputation Management",
  "Google Ads",
  "Website Design & Development",
  "Local SEO",
  "Remove Negative Reviews",
  "Not sure",
]);

const PAGE_ALLOWLIST = [
  "index.html",
  "privacy.html",
  "terms.html",
  "industries/index.html",
  "services/index.html",
  "services/google-business-profile-setup.html",
  "services/google-maps-review-management.html",
  "services/google-ads-campaigns.html",
  "services/web-development.html",
  "services/local-seo.html",
  "services/remove-negative-reviews.html",
];

const PAGE_ALLOWLIST_SET = new Set(PAGE_ALLOWLIST);

/* ── Rate-limit store (in-memory, per-isolate) ── */
const ipSubmissions = new Map();
const RATE_WINDOW_MS = 60 * 1000;
const RATE_MAX = 3;

function isRateLimited(ip) {
  if (!ip) return false;
  const now = Date.now();
  const entry = ipSubmissions.get(ip);

  if (!entry || now - entry.windowStart > RATE_WINDOW_MS) {
    ipSubmissions.set(ip, { windowStart: now, count: 1 });
    return false;
  }

  entry.count++;
  if (entry.count > RATE_MAX) return true;
  return false;
}

/* ── Helpers ── */

function json(data, status, origin) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  };
  Object.assign(headers, corsHeaders(origin));
  return new Response(JSON.stringify(data), { status, headers });
}

function parseAllowedOrigins(env) {
  const raw = (env && env.ALLOWED_ORIGINS) || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(origin) {
  const headers = {
    "access-control-allow-methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "access-control-allow-headers": "Content-Type, Authorization",
    "access-control-max-age": "86400",
  };
  if (origin) {
    headers["access-control-allow-origin"] = origin;
    headers.vary = "Origin";
  }
  return headers;
}

function resolveOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return null;

  const allowed = parseAllowedOrigins(env);
  if (allowed.includes(origin)) return origin;

  try {
    const url = new URL(origin);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return origin;
    }
  } catch (_) {
    /* ignore */
  }

  return null;
}

function clean(value, max) {
  if (typeof value !== "string") return "";
  return value.replace(/\0/g, "").trim().slice(0, max);
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= MAX.email;
}

function isValidPhone(value) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

function isValidUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (_) {
    return false;
  }
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function strToBase64(str) {
  return bytesToBase64(new TextEncoder().encode(str));
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const enc = new TextEncoder();
  const aa = enc.encode(a);
  const bb = enc.encode(b);
  if (aa.length !== bb.length) return false;
  let out = 0;
  for (let i = 0; i < aa.length; i++) out |= aa[i] ^ bb[i];
  return out === 0;
}

/* ── Validation (contact) ── */

function validatePayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "Invalid request body." };
  }

  if (body.website2 && typeof body.website2 === "string" && body.website2.trim().length > 0) {
    return { ok: false, message: "Invalid submission.", spam: true };
  }

  const data = {
    clientName: clean(body.clientName, MAX.clientName),
    email: clean(body.email, MAX.email),
    phone: clean(body.phone, MAX.phone),
    businessName: clean(body.businessName, MAX.businessName),
    mapsLink: clean(body.mapsLink, MAX.mapsLink),
    service: clean(body.service, MAX.service),
    message: clean(body.message, MAX.message),
  };

  if (
    !data.clientName ||
    !data.email ||
    !data.phone ||
    !data.businessName ||
    !data.service
  ) {
    return { ok: false, message: "Please complete all required fields." };
  }

  if (!isValidEmail(data.email)) {
    return { ok: false, message: "Please enter a valid email address." };
  }

  if (!isValidPhone(data.phone)) {
    return {
      ok: false,
      message: "Please enter a phone number with at least 10 digits.",
    };
  }

  if (!ALLOWED_SERVICES.has(data.service)) {
    return { ok: false, message: "Please select a valid service option." };
  }

  if (data.mapsLink && !isValidUrl(data.mapsLink)) {
    return {
      ok: false,
      message: "The Google Maps link must be a full http(s) URL.",
    };
  }

  return { ok: true, data };
}

/* ── D1 contact ── */

async function saveLead(env, data) {
  if (!env.DB) {
    throw new Error("Database binding is not configured.");
  }

  await env.DB.prepare(
    `INSERT INTO leads (
      name, email, phone, business, service, message, website_url, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'new')`
  )
    .bind(
      data.clientName,
      data.email,
      data.phone || null,
      data.businessName || null,
      data.service,
      data.message || null,
      data.mapsLink || null
    )
    .run();
}

/* ── Email notification via Resend ── */

function buildEmailHtml(data, submittedAt) {
  const rows = [
    ["Name", data.clientName],
    ["Email", data.email],
    ["Phone", data.phone || "Not provided"],
    ["Business", data.businessName || "Not provided"],
    ["Service", data.service],
    ["Message", data.message || "Not provided"],
    ["Website / GBP URL", data.mapsLink || "Not provided"],
    ["Submitted", submittedAt],
  ];

  const rowsHtml = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;font-weight:600;color:#374151;white-space:nowrap;vertical-align:top">${label}</td><td style="padding:8px 12px;color:#111827">${escapeHtml(value)}</td></tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">
    <div style="background:#111827;padding:20px 24px">
      <h1 style="margin:0;font-size:18px;color:#fff">New Townloc Lead</h1>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${rowsHtml}
    </table>
    <div style="padding:16px 24px;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb">
      Townloc Contact API &middot; Automated notification
    </div>
  </div>
</body></html>`;
}

function buildEmailText(data, submittedAt) {
  return [
    "New Townloc Lead",
    "═══════════════════",
    "",
    `Name:         ${data.clientName}`,
    `Email:        ${data.email}`,
    `Phone:        ${data.phone || "Not provided"}`,
    `Business:     ${data.businessName || "Not provided"}`,
    `Service:      ${data.service}`,
    `Message:      ${data.message || "Not provided"}`,
    `Website/GBP:  ${data.mapsLink || "Not provided"}`,
    `Submitted:    ${submittedAt}`,
    "",
    "— Townloc Contact API",
  ].join("\n");
}

async function sendNotification(env, data) {
  const apiKey = env.RESEND_API_KEY;
  const recipient = env.RECIPIENT_EMAIL || "contact@townloc.com";

  if (!apiKey) {
    console.error("RESEND_API_KEY not configured — skipping email notification.");
    return;
  }

  const submittedAt = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";

  const payload = {
    from: env.SENDER_EMAIL || "Townloc <contact@townloc.com>",
    to: [recipient],
    subject: `New Lead: ${data.clientName} — ${data.service}`,
    html: buildEmailHtml(data, submittedAt),
    text: buildEmailText(data, submittedAt),
    reply_to: data.email,
  };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`Resend API error (${res.status}): ${errText}`);
    }
  } catch (err) {
    console.error("Failed to send notification email:", err.message);
  }
}

/* ── Contact handler ── */

async function handleContact(request, env, origin) {
  if (!origin && request.headers.get("Origin")) {
    return json({ success: false, message: "Origin not allowed." }, 403, null);
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json(
      { success: false, message: "Request body must be valid JSON." },
      400,
      origin
    );
  }

  const result = validatePayload(body);
  if (!result.ok) {
    if (result.spam) {
      return json(
        { success: true, message: "Your message has been received." },
        200,
        origin
      );
    }
    return json({ success: false, message: result.message }, 400, origin);
  }

  const ip =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For") ||
    "unknown";

  if (isRateLimited(ip)) {
    return json(
      { success: false, message: "Too many requests. Please try again later." },
      429,
      origin
    );
  }

  try {
    await saveLead(env, result.data);
  } catch (_) {
    return json(
      {
        success: false,
        message: "Something went wrong. Please try again later.",
      },
      500,
      origin
    );
  }

  try {
    await sendNotification(env, result.data);
  } catch (_) {
    console.error("Email notification failed silently.");
  }

  return json(
    { success: true, message: "Your message has been received." },
    200,
    origin
  );
}

/* ── Admin auth ── */

async function hmacSign(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(message)
  );
  return bytesToBase64(new Uint8Array(sig));
}

async function createAdminToken(env) {
  const exp = Date.now() + 12 * 60 * 60 * 1000;
  const payload = `admin:${exp}`;
  const sig = await hmacSign(env.ADMIN_SECRET, payload);
  return `${payload}.${sig}`;
}

async function verifyAdminToken(env, token) {
  if (!env.ADMIN_SECRET || !token || typeof token !== "string") return false;
  const parts = token.split(".");
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  if (!payload.startsWith("admin:")) return false;
  const exp = Number(payload.slice(6));
  if (!Number.isFinite(exp) || Date.now() > exp) return false;
  const expected = await hmacSign(env.ADMIN_SECRET, payload);
  return timingSafeEqual(sig, expected);
}

function getBearerToken(request) {
  const h = request.headers.get("Authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}

async function requireAdmin(request, env, origin) {
  if (!env.ADMIN_PASSWORD || !env.ADMIN_SECRET) {
    return {
      ok: false,
      response: json(
        { success: false, message: "Admin is not configured." },
        503,
        origin
      ),
    };
  }
  const token = getBearerToken(request);
  const valid = await verifyAdminToken(env, token);
  if (!valid) {
    return {
      ok: false,
      response: json({ success: false, message: "Unauthorized." }, 401, origin),
    };
  }
  return { ok: true };
}

async function handleAdminLogin(request, env, origin) {
  if (!env.ADMIN_PASSWORD || !env.ADMIN_SECRET) {
    return json(
      { success: false, message: "Admin is not configured." },
      503,
      origin
    );
  }

  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ success: false, message: "Invalid JSON." }, 400, origin);
  }

  const password = typeof body.password === "string" ? body.password : "";
  if (!timingSafeEqual(password, env.ADMIN_PASSWORD)) {
    return json({ success: false, message: "Invalid password." }, 401, origin);
  }

  const token = await createAdminToken(env);
  return json({ success: true, token }, 200, origin);
}

/* ── Public posts ── */

async function handlePublicPostsList(env, origin) {
  const { results } = await env.DB.prepare(
    `SELECT id, slug, title, excerpt, featured_image, status, created_at, updated_at
     FROM posts WHERE status = 'published'
     ORDER BY updated_at DESC`
  ).all();
  return json({ success: true, posts: results || [] }, 200, origin);
}

async function handlePublicPostGet(env, origin, slug) {
  const row = await env.DB.prepare(
    `SELECT id, slug, title, body, excerpt, featured_image, meta_title, meta_description, og_image, status, created_at, updated_at
     FROM posts WHERE slug = ? AND status = 'published' LIMIT 1`
  )
    .bind(slug)
    .first();
  if (!row) {
    return json({ success: false, message: "Post not found." }, 404, origin);
  }
  return json({ success: true, post: row }, 200, origin);
}

/* ── Admin leads ── */

function csvEscape(value) {
  const s = value == null ? "" : String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function leadsToCsv(rows) {
  const header = [
    "ID",
    "Name",
    "Email",
    "Phone",
    "Business",
    "Service",
    "Message",
    "Website URL",
    "Status",
    "Created At",
  ];
  const lines = [header.map(csvEscape).join(",")];
  for (const row of rows || []) {
    lines.push(
      [
        row.id,
        row.name,
        row.email,
        row.phone,
        row.business,
        row.service,
        row.message,
        row.website_url,
        row.status,
        row.created_at,
      ]
        .map(csvEscape)
        .join(",")
    );
  }
  return lines.join("\r\n") + "\r\n";
}

async function handleAdminLeadsList(env, origin) {
  const { results } = await env.DB.prepare(
    `SELECT id, name, email, phone, business, service, message, website_url, status, created_at
     FROM leads ORDER BY id DESC LIMIT 200`
  ).all();
  return json({ success: true, leads: results || [] }, 200, origin);
}

async function handleAdminLeadsExport(env, origin) {
  const { results } = await env.DB.prepare(
    `SELECT id, name, email, phone, business, service, message, website_url, status, created_at
     FROM leads ORDER BY id ASC`
  ).all();

  const csv = leadsToCsv(results || []);
  const day = new Date().toISOString().slice(0, 10);
  const filename = `townloc-leads-${day}.csv`;
  const headers = {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="${filename}"`,
    "cache-control": "no-store",
  };
  Object.assign(headers, corsHeaders(origin));
  // UTF-8 BOM helps Excel open the file correctly
  return new Response("\uFEFF" + csv, { status: 200, headers });
}

async function handleAdminLeadDelete(env, origin, id) {
  if (!Number.isInteger(id) || id < 1) {
    return json({ success: false, message: "Invalid lead ID." }, 400, origin);
  }
  const result = await env.DB.prepare(`DELETE FROM leads WHERE id = ?`)
    .bind(id)
    .run();
  if (!result.meta || result.meta.changes === 0) {
    return json({ success: false, message: "Lead not found." }, 404, origin);
  }
  return json({ success: true, message: "Lead deleted." }, 200, origin);
}

async function handleAdminLeadPatch(request, env, origin, id) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ success: false, message: "Invalid JSON." }, 400, origin);
  }
  const status = clean(body.status, 40);
  const allowed = new Set(["new", "contacted", "closed"]);
  if (!allowed.has(status)) {
    return json({ success: false, message: "Invalid status." }, 400, origin);
  }
  const result = await env.DB.prepare(`UPDATE leads SET status = ? WHERE id = ?`)
    .bind(status, id)
    .run();
  if (!result.meta || result.meta.changes === 0) {
    return json({ success: false, message: "Lead not found." }, 404, origin);
  }
  return json({ success: true }, 200, origin);
}

/* ── Admin posts ── */

function parsePostFields(body) {
  const title = clean(body.title, 200);
  const postBody = typeof body.body === "string" ? body.body.slice(0, 200000) : "";
  const status = body.status === "published" ? "published" : "draft";
  const slug = slugify(body.slug || title);
  const featured_image = clean(body.featured_image || body.featuredImage || "", 500);
  const excerpt = clean(body.excerpt, 500);
  const meta_title = clean(body.meta_title || body.metaTitle || "", 200);
  const meta_description = clean(
    body.meta_description || body.metaDescription || "",
    320
  );
  const og_image = clean(body.og_image || body.ogImage || "", 500);

  if (featured_image && !isValidUrl(featured_image)) {
    return { ok: false, message: "Featured image must be a full http(s) URL." };
  }
  if (og_image && !isValidUrl(og_image)) {
    return { ok: false, message: "OG image must be a full http(s) URL." };
  }

  if (!title || !slug) {
    return { ok: false, message: "Title and slug are required." };
  }

  return {
    ok: true,
    data: {
      title,
      slug,
      body: postBody,
      status,
      featured_image,
      excerpt,
      meta_title,
      meta_description,
      og_image,
    },
  };
}

async function handleAdminPostsList(env, origin) {
  const { results } = await env.DB.prepare(
    `SELECT id, slug, title, featured_image, og_image, status, created_at, updated_at
     FROM posts ORDER BY updated_at DESC`
  ).all();
  return json({ success: true, posts: results || [] }, 200, origin);
}

async function handleAdminPostGet(env, origin, id) {
  const row = await env.DB.prepare(
    `SELECT id, slug, title, body, excerpt, featured_image, meta_title, meta_description, og_image, status, created_at, updated_at
     FROM posts WHERE id = ?`
  )
    .bind(id)
    .first();
  if (!row) {
    return json({ success: false, message: "Post not found." }, 404, origin);
  }
  return json({ success: true, post: row }, 200, origin);
}

async function handleAdminPostCreate(request, env, origin) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ success: false, message: "Invalid JSON." }, 400, origin);
  }

  const parsed = parsePostFields(body);
  if (!parsed.ok) {
    return json({ success: false, message: parsed.message }, 400, origin);
  }
  const d = parsed.data;

  try {
    const result = await env.DB.prepare(
      `INSERT INTO posts (
        slug, title, body, status, featured_image, excerpt, meta_title, meta_description, og_image, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
      .bind(
        d.slug,
        d.title,
        d.body,
        d.status,
        d.featured_image,
        d.excerpt,
        d.meta_title,
        d.meta_description,
        d.og_image
      )
      .run();
    return json(
      { success: true, id: result.meta.last_row_id, slug: d.slug },
      201,
      origin
    );
  } catch (err) {
    return json(
      { success: false, message: "Could not create post (slug may exist)." },
      409,
      origin
    );
  }
}

async function handleAdminPostUpdate(request, env, origin, id) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ success: false, message: "Invalid JSON." }, 400, origin);
  }

  const existing = await env.DB.prepare(`SELECT id FROM posts WHERE id = ?`)
    .bind(id)
    .first();
  if (!existing) {
    return json({ success: false, message: "Post not found." }, 404, origin);
  }

  const parsed = parsePostFields(body);
  if (!parsed.ok) {
    return json({ success: false, message: parsed.message }, 400, origin);
  }
  const d = parsed.data;

  try {
    await env.DB.prepare(
      `UPDATE posts SET
        slug = ?, title = ?, body = ?, status = ?,
        featured_image = ?, excerpt = ?, meta_title = ?, meta_description = ?, og_image = ?,
        updated_at = datetime('now')
       WHERE id = ?`
    )
      .bind(
        d.slug,
        d.title,
        d.body,
        d.status,
        d.featured_image,
        d.excerpt,
        d.meta_title,
        d.meta_description,
        d.og_image,
        id
      )
      .run();
    return json({ success: true }, 200, origin);
  } catch (_) {
    return json(
      { success: false, message: "Could not update post (slug may exist)." },
      409,
      origin
    );
  }
}

async function handleAdminPostDelete(env, origin, id) {
  const result = await env.DB.prepare(`DELETE FROM posts WHERE id = ?`)
    .bind(id)
    .run();
  if (!result.meta || result.meta.changes === 0) {
    return json({ success: false, message: "Post not found." }, 404, origin);
  }
  return json({ success: true }, 200, origin);
}

/* ── Admin pages + GitHub publish ── */

async function handleAdminPagesList(env, origin) {
  const { results } = await env.DB.prepare(
    `SELECT path, updated_at, length(html) AS html_length FROM pages`
  ).all();
  const byPath = {};
  for (const row of results || []) byPath[row.path] = row;

  const pages = PAGE_ALLOWLIST.map((path) => ({
    path,
    saved: Boolean(byPath[path]),
    updated_at: byPath[path] ? byPath[path].updated_at : null,
    html_length: byPath[path] ? byPath[path].html_length : 0,
  }));

  return json({ success: true, pages }, 200, origin);
}

async function handleAdminPageGet(env, origin, path) {
  if (!PAGE_ALLOWLIST_SET.has(path)) {
    return json({ success: false, message: "Path not allowed." }, 400, origin);
  }
  const row = await env.DB.prepare(
    `SELECT path, html, updated_at FROM pages WHERE path = ?`
  )
    .bind(path)
    .first();
  return json(
    {
      success: true,
      page: row || { path, html: "", updated_at: null },
    },
    200,
    origin
  );
}

async function handleAdminPageSave(request, env, origin) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ success: false, message: "Invalid JSON." }, 400, origin);
  }

  const path = typeof body.path === "string" ? body.path.trim() : "";
  if (!PAGE_ALLOWLIST_SET.has(path)) {
    return json({ success: false, message: "Path not allowed." }, 400, origin);
  }
  const html = typeof body.html === "string" ? body.html : "";
  if (html.length > 2_000_000) {
    return json({ success: false, message: "HTML too large." }, 400, origin);
  }

  await env.DB.prepare(
    `INSERT INTO pages (path, html, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(path) DO UPDATE SET html = excluded.html, updated_at = datetime('now')`
  )
    .bind(path, html)
    .run();

  return json({ success: true }, 200, origin);
}

async function githubGetFileSha(env, path) {
  const repo = env.GITHUB_REPO;
  const branch = env.GITHUB_BRANCH || "main";
  const token = env.GITHUB_TOKEN;
  if (!repo || !token) {
    return { ok: false, message: "GitHub publish is not configured." };
  }

  const url = `https://api.github.com/repos/${repo}/contents/${encodeURI(path)}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "townloc-cms",
    },
  });

  if (res.status === 404) {
    return { ok: true, sha: null };
  }
  if (!res.ok) {
    const text = await res.text();
    return { ok: false, message: `GitHub read failed (${res.status}): ${text}` };
  }
  const data = await res.json();
  return { ok: true, sha: data.sha || null };
}

async function githubPutFile(env, path, html, sha) {
  const repo = env.GITHUB_REPO;
  const branch = env.GITHUB_BRANCH || "main";
  const token = env.GITHUB_TOKEN;

  const payload = {
    message: `cms: update ${path}`,
    content: strToBase64(html),
    branch,
  };
  if (sha) payload.sha = sha;

  const url = `https://api.github.com/repos/${repo}/contents/${encodeURI(path)}`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      "User-Agent": "townloc-cms",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    return { ok: false, message: `GitHub write failed (${res.status}): ${text}` };
  }
  return { ok: true };
}

async function handleAdminPagePublish(request, env, origin) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return json({ success: false, message: "Invalid JSON." }, 400, origin);
  }

  const path = typeof body.path === "string" ? body.path.trim() : "";
  if (!PAGE_ALLOWLIST_SET.has(path)) {
    return json({ success: false, message: "Path not allowed." }, 400, origin);
  }

  let html = typeof body.html === "string" ? body.html : null;
  if (html == null) {
    const row = await env.DB.prepare(`SELECT html FROM pages WHERE path = ?`)
      .bind(path)
      .first();
    if (!row) {
      return json(
        { success: false, message: "Save the page to D1 before publishing." },
        400,
        origin
      );
    }
    html = row.html;
  }

  if (html.length > 2_000_000) {
    return json({ success: false, message: "HTML too large." }, 400, origin);
  }

  await env.DB.prepare(
    `INSERT INTO pages (path, html, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(path) DO UPDATE SET html = excluded.html, updated_at = datetime('now')`
  )
    .bind(path, html)
    .run();

  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) {
    return json(
      {
        success: true,
        published: false,
        message: "Saved to D1. Set GITHUB_TOKEN and GITHUB_REPO to publish to the repo.",
      },
      200,
      origin
    );
  }

  const shaResult = await githubGetFileSha(env, path);
  if (!shaResult.ok) {
    return json({ success: false, message: shaResult.message }, 502, origin);
  }

  const putResult = await githubPutFile(env, path, html, shaResult.sha);
  if (!putResult.ok) {
    return json({ success: false, message: putResult.message }, 502, origin);
  }

  return json(
    { success: true, published: true, message: "Published to GitHub." },
    200,
    origin
  );
}

/* ── Admin router ── */

async function handleAdmin(request, env, origin, url) {
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (path === "/api/admin/login" && request.method === "POST") {
    return handleAdminLogin(request, env, origin);
  }

  const auth = await requireAdmin(request, env, origin);
  if (!auth.ok) return auth.response;

  if (path === "/api/admin/settings" && request.method === "GET") {
    const repo = String(env.GITHUB_REPO || "").trim();
    const hasToken = Boolean(String(env.GITHUB_TOKEN || "").trim());
    const configured = Boolean(repo && hasToken);
    return json(
      {
        success: true,
        github_publishing: {
          status: configured ? "connected" : "not_configured",
          repository: configured ? repo : null,
        },
      },
      200,
      origin
    );
  }

  if (path === "/api/admin/leads" && request.method === "GET") {
    return handleAdminLeadsList(env, origin);
  }

  if (path === "/api/admin/leads/export" && request.method === "GET") {
    return handleAdminLeadsExport(env, origin);
  }

  const leadMatch = path.match(/^\/api\/admin\/leads\/(\d+)$/);
  if (leadMatch && request.method === "PATCH") {
    return handleAdminLeadPatch(request, env, origin, Number(leadMatch[1]));
  }
  if (leadMatch && request.method === "DELETE") {
    return handleAdminLeadDelete(env, origin, Number(leadMatch[1]));
  }

  if (path === "/api/admin/posts" && request.method === "GET") {
    return handleAdminPostsList(env, origin);
  }
  if (path === "/api/admin/posts" && request.method === "POST") {
    return handleAdminPostCreate(request, env, origin);
  }

  const postMatch = path.match(/^\/api\/admin\/posts\/(\d+)$/);
  if (postMatch && request.method === "GET") {
    return handleAdminPostGet(env, origin, Number(postMatch[1]));
  }
  if (postMatch && request.method === "PATCH") {
    return handleAdminPostUpdate(request, env, origin, Number(postMatch[1]));
  }
  if (postMatch && request.method === "DELETE") {
    return handleAdminPostDelete(env, origin, Number(postMatch[1]));
  }

  if (path === "/api/admin/pages" && request.method === "GET") {
    return handleAdminPagesList(env, origin);
  }
  if (path === "/api/admin/pages" && request.method === "PUT") {
    return handleAdminPageSave(request, env, origin);
  }
  if (path === "/api/admin/pages/publish" && request.method === "POST") {
    return handleAdminPagePublish(request, env, origin);
  }

  const pageGet = path.match(/^\/api\/admin\/pages\/(.+)$/);
  if (pageGet && request.method === "GET") {
    const pagePath = decodeURIComponent(pageGet[1]);
    return handleAdminPageGet(env, origin, pagePath);
  }

  return json({ success: false, message: "Not found." }, 404, origin);
}

/* ── Router ── */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Apex canonical: www → non-www
    if (url.hostname === "www.townloc.com") {
      url.hostname = "townloc.com";
      return Response.redirect(url.toString(), 301);
    }

    const origin = resolveOrigin(request, env);

    try {
      if (request.method === "OPTIONS") {
        if (request.headers.get("Origin") && !origin) {
          return new Response(null, { status: 403 });
        }
        return new Response(null, {
          status: 204,
          headers: corsHeaders(origin),
        });
      }

      if (url.pathname === "/api/contact" || url.pathname === "/api/contact/") {
        if (request.method !== "POST") {
          return json(
            { success: false, message: "Method not allowed." },
            405,
            origin
          );
        }
        return await handleContact(request, env, origin);
      }

      if (url.pathname.startsWith("/api/admin")) {
        return await handleAdmin(request, env, origin, url);
      }

      if (
        (url.pathname === "/api/posts" || url.pathname === "/api/posts/") &&
        request.method === "GET"
      ) {
        return await handlePublicPostsList(env, origin);
      }

      const publicPost = url.pathname.match(/^\/api\/posts\/([^/]+)\/?$/);
      if (publicPost && request.method === "GET") {
        return await handlePublicPostGet(
          env,
          origin,
          decodeURIComponent(publicPost[1])
        );
      }

      if (url.pathname === "/api" || url.pathname === "/api/") {
        return json(
          {
            success: true,
            message: "Townloc contact API is online.",
            endpoints: [
              "POST /api/contact",
              "GET /api/posts",
              "GET /api/posts/:slug",
              "POST /api/admin/login",
            ],
          },
          200,
          origin
        );
      }

      // Non-/api requests are served by Workers static assets (see wrangler.toml).
      if (env.ASSETS) {
        return env.ASSETS.fetch(request);
      }

      return json({ success: false, message: "Not found." }, 404, origin);
    } catch (err) {
      console.error(err);
      return json(
        {
          success: false,
          message: "Something went wrong. Please try again later.",
        },
        500,
        origin
      );
    }
  },
};
