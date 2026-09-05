# GglMap Contact Worker

Cloudflare Worker backend for the Free Assessment / Contact form.

**Live Worker:** https://gglmap.catiq.workers.dev/

Validated form submissions are stored in **Cloudflare D1** (`leads` table).  
Email notifications are sent via **Resend** after each successful lead.

## Structure

```
backend/worker/
  src/index.js              # Worker entry (POST /api/contact)
  migrations/               # D1 SQL migrations
    0001_create_leads.sql
  wrangler.toml             # Cloudflare + D1 + email config
  package.json
  README.md
```

## 1. Install dependencies

```bash
cd backend/worker
npm install
```

## 2. D1 Database setup

### Create the database (once)

```bash
npx wrangler login
npx wrangler d1 create gglmap-leads
```

Copy the UUID into `wrangler.toml` → `database_id`.

### Run migrations

Local:
```bash
npm run db:migrate:local
```

Remote (production):
```bash
npm run db:migrate:remote
```

## 3. Resend email setup (Zoho inboxes)

Zoho mailboxes on `gglmap.com` (full send + receive):

| Address | Role |
|---|---|
| `contact@gglmap.com` | Lead / form notifications (used by the Worker) |
| `hello@gglmap.com` | General brand |
| `support@gglmap.com` | Client support |
| `marketing@gglmap.com` | Bulk marketing (later) |

Form alerts go **to** `contact@gglmap.com` and **from** `GglMap <contact@gglmap.com>`.  
Change in `wrangler.toml` anytime → `npm run deploy`.

### Step 1 — Create a Resend account

Go to https://resend.com and sign up (free tier: 100 emails/day).

### Step 2 — Verify `gglmap.com` in Resend

1. Open https://resend.com/domains
2. Add `gglmap.com`
3. Add the DNS records Resend shows (SPF / DKIM TXT)
4. Wait until status is **Verified**

> Zoho keeps MX for receiving. Resend only needs SPF/DKIM for **sending**. Do not remove Zoho MX.

### Step 3 — Create an API key

Go to https://resend.com/api-keys → Create API Key → copy it.

### Step 4 — Store the API key as a Cloudflare secret

```bash
npx wrangler secret put RESEND_API_KEY
```

### Step 5 — Deploy

```bash
npm run deploy
```

## 4. Environment variables & secrets

| Variable | Location | Purpose |
|---|---|---|
| `RESEND_API_KEY` | Cloudflare secret | Resend API key (never in Git) |
| `RECIPIENT_EMAIL` | `wrangler.toml` `[vars]` | Who receives leads (`contact@gglmap.com`) |
| `SENDER_EMAIL` | `wrangler.toml` `[vars]` | From address (`GglMap <contact@gglmap.com>`) |
| `ALLOWED_ORIGINS` | `wrangler.toml` `[vars]` | CORS allowed origins |

### Change email later

Edit `wrangler.toml` and redeploy:
```toml
RECIPIENT_EMAIL = "hello@gglmap.com"
SENDER_EMAIL = "GglMap <hello@gglmap.com>"
```

## 5. Spam protection

The Worker includes multiple layers of protection:

1. **Honeypot field** — hidden `website2` field; bots that fill it get a fake success response (silently rejected)
2. **Rate limiting** — max 3 submissions per IP per minute (in-memory, per-isolate)
3. **Server-side validation** — name, email, phone, business, service validated; length limits enforced
4. **CORS** — only allowed origins can submit
5. **Service allowlist** — only valid service options accepted

## 6. Run the Worker locally

```bash
npm run dev
```

Worker serves at `http://127.0.0.1:8787`.

For local testing, email notifications will only send if `RESEND_API_KEY` is set. You can create a `.dev.vars` file (not committed) to test locally:

```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxx
```

## 7. Test a submission

### Via curl

```bash
curl -X POST http://127.0.0.1:8787/api/contact \
  -H "Content-Type: application/json" \
  -H "Origin: http://127.0.0.1:5500" \
  -d "{
    \"clientName\": \"Jordan Hale\",
    \"email\": \"jordan@example.com\",
    \"phone\": \"+1 555 010 2841\",
    \"businessName\": \"Hale & Co. Plumbing\",
    \"service\": \"Google Ads\",
    \"mapsLink\": \"https://maps.google.com/?cid=example\",
    \"message\": \"Need help with ads.\",
    \"website2\": \"\"
  }"
```

### Test honeypot rejection

```bash
curl -X POST http://127.0.0.1:8787/api/contact \
  -H "Content-Type: application/json" \
  -H "Origin: http://127.0.0.1:5500" \
  -d "{
    \"clientName\": \"Bot\",
    \"email\": \"bot@spam.com\",
    \"phone\": \"5555555555\",
    \"businessName\": \"Spam Corp\",
    \"service\": \"Google Ads\",
    \"website2\": \"http://spam.example\"
  }"
```

This returns `200 success` (to fool the bot) but the lead is **not** saved.

### Via the website

```bash
# terminal A — static site
python -m http.server 5500

# terminal B — worker
cd backend/worker
npm run dev
```

Open http://127.0.0.1:5500/ and submit the form.

## 8. Verify stored leads

```bash
npm run db:leads:local
```

Or remote:
```bash
npx wrangler d1 execute gglmap-leads --remote \
  --command "SELECT id, name, email, service, status, created_at FROM leads ORDER BY id DESC LIMIT 10;"
```

## 9. Deploy

```bash
npm run deploy
```

Make sure `RESEND_API_KEY` is set as a secret before deploying:
```bash
npx wrangler secret put RESEND_API_KEY
```

## API responses

Success (`200`):
```json
{
  "success": true,
  "message": "Your message has been received."
}
```

Validation error (`400`):
```json
{
  "success": false,
  "message": "Please complete all required fields."
}
```

Rate limited (`429`):
```json
{
  "success": false,
  "message": "Too many requests. Please try again later."
}
```

Server error (`500`):
```json
{
  "success": false,
  "message": "Something went wrong. Please try again later."
}
```

## What this Worker does NOT do yet

- CMS / admin panel
- Authentication
- Bulk messaging
- Custom domain routing

Those will be added in later steps.
