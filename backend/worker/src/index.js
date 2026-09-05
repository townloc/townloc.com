/**
 * GglMap — Free Assessment / Contact API
 * POST /api/contact
 *
 * Validates submissions, rejects spam (honeypot + rate limit),
 * stores leads in Cloudflare D1, and sends email notification via Resend.
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
  "Not sure",
]);

/* ── Rate-limit store (in-memory, per-isolate) ── */
const ipSubmissions = new Map();
const RATE_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_MAX = 3; // max submissions per IP per window

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
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "Content-Type",
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

/* ── Validation ── */

function validatePayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, message: "Invalid request body." };
  }

  // Honeypot check — bots fill the hidden field
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

/* ── D1 ── */

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
      <h1 style="margin:0;font-size:18px;color:#fff">New GglMap Lead</h1>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      ${rowsHtml}
    </table>
    <div style="padding:16px 24px;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb">
      GglMap Contact API &middot; Automated notification
    </div>
  </div>
</body></html>`;
}

function buildEmailText(data, submittedAt) {
  return [
    "New GglMap Lead",
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
    "— GglMap Contact API",
  ].join("\n");
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function sendNotification(env, data) {
  const apiKey = env.RESEND_API_KEY;
  const recipient = env.RECIPIENT_EMAIL || "contact@gglmap.com";

  if (!apiKey) {
    console.error("RESEND_API_KEY not configured — skipping email notification.");
    return;
  }

  const submittedAt = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";

  const payload = {
    from: env.SENDER_EMAIL || "GglMap <contact@gglmap.com>",
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

/* ── Handler ── */

async function handleContact(request, env, origin) {
  if (!origin && request.headers.get("Origin")) {
    return json(
      { success: false, message: "Origin not allowed." },
      403,
      null
    );
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
    // For honeypot catches, return 200 to fool bots
    if (result.spam) {
      return json(
        { success: true, message: "Your message has been received." },
        200,
        origin
      );
    }
    return json({ success: false, message: result.message }, 400, origin);
  }

  // Rate limit by IP — only count validated (non-spam) submissions
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

  // Send email notification (non-blocking — don't fail the response if email fails)
  try {
    await sendNotification(env, result.data);
  } catch (_) {
    console.error("Email notification failed silently.");
  }

  return json(
    {
      success: true,
      message: "Your message has been received.",
    },
    200,
    origin
  );
}

/* ── Router ── */

export default {
  async fetch(request, env) {
    const origin = resolveOrigin(request, env);
    const url = new URL(request.url);

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

      if (url.pathname === "/" || url.pathname === "/api" || url.pathname === "/api/") {
        return json(
          {
            success: true,
            message: "GglMap contact API is online.",
            endpoints: ["POST /api/contact"],
          },
          200,
          origin
        );
      }

      return json({ success: false, message: "Not found." }, 404, origin);
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
  },
};
