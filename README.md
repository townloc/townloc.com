# Townloc Website  Full Setup Playbook

**Live site:** https://townloc.com/  
**API:** https://townloc.com/api  
**Admin:** https://townloc.com/admin  
**GitHub repo:** https://github.com/townloc/townloc.com  
**Cloudflare Worker name:** `townloc`  
**D1 database name:** `townloc-leads`

One Cloudflare **Worker** serves the website **and** the API together.  
**Do not** create Cloudflare Pages for this project.

---

## Accounts & permissions (which login for what)

You may have more than one account on the same PC. Use the right one:

| Task | Account / place | How to check / switch |
|------|-----------------|------------------------|
| `git push` to `townloc/townloc.com` | GitHub user **`townloc`** (must have write access) | `gh auth status` then `gh auth switch` |
| Old personal repos (if any) | GitHub user **`ShamratX`** | Same  switch only when needed |
| Create DB, secrets, deploy Worker | Cloudflare account that owns **`townloc.com`** | `npx wrangler login` (browser approve) |
| Resend API key | Your Resend dashboard | Copy key; do not put it in git files |
| Email receive (inbox) | Zoho (or your mail host) DNS already on domain | Keep MX / TXT  do not delete |

### GitHub two accounts on one PC

```powershell
gh auth status
gh auth switch
gh auth setup-git
```

- Active account must be **`townloc`** before pushing to https://github.com/townloc/townloc.com  
- If active is `ShamratX`, push fails with **403 Permission denied**

### Cloudflare login (once per machine / when expired)

```powershell
cd backend/worker
npx wrangler login
```

Browser opens ? approve with the Cloudflare account that has domain `townloc.com`.

---

## Golden rules

1. **Worker only**  site + API = one Worker (`townloc`). No Pages.
2. **Git push ? live site**  push only updates GitHub. Live site needs `npm run deploy`.
3. **Secrets never in git**  use `wrangler secret put`, not `.env` committed to repo.
4. **One project = one D1 database**  do not reuse another sites DB id.
5. **Do not delete Zoho/Resend DNS** (MX, SPF, DKIM TXT) when fixing Pages conflict.

---

## Exact order of commands (first-time / new clone)

Run from PowerShell. Do steps **in this order**.

### A) Project folder

```powershell
cd "d:\Dextop\Important files\townloc"
```

(Adjust path if the folder moved.)

### B) GitHub remote (already set for this project)

```powershell
git remote -v
```

Should show:

```text
origin  https://github.com/townloc/townloc.com.git
```

If wrong:

```powershell
git remote set-url origin https://github.com/townloc/townloc.com.git
```

### C) GitHub login as townloc (for push)

```powershell
gh auth login
```

Choose: GitHub.com ? HTTPS ? Login with browser ? sign in as **`townloc`**.

Later, if you switched away:

```powershell
gh auth switch
```

Pick **`townloc`**, then:

```powershell
gh auth setup-git
```

### D) Save code to GitHub (optional anytime)

```powershell
git add .
git commit -m "Your message here"
git push -u origin main
```

If 403: you are on wrong GitHub account ? go back to step C.

### E) Backend folder + install

```powershell
cd "d:\Dextop\Important files\townloc\backend\worker"
npm install
```

### F) Cloudflare login

```powershell
npx wrangler login
```

Approve in browser (Cloudflare account for townloc.com).

### G) Create D1 database

```powershell
npx wrangler d1 create townloc-leads
```

Copy the printed `database_id`.

Open `backend/worker/wrangler.toml` and set:

```toml
[[d1_databases]]
binding = "DB"
database_name = "townloc-leads"
database_id = "PASTE-THE-NEW-ID-HERE"
migrations_dir = "migrations"
```

**Keep `binding = "DB"`** (code uses `env.DB`). Do not change binding to another name.

### H) Run database migrations

```powershell
npx wrangler d1 migrations apply townloc-leads --remote
```

All migrations should show success (leads, CMS, posts, media).

> Note: `npm run db:migrate:remote` in `package.json` may still say an old DB name. Prefer the command above with `townloc-leads`.

### I) Resend API key (secret)

```powershell
npx wrangler secret put RESEND_API_KEY
```

Paste your Resend key when asked ? Enter.  
You will not see the key on screen. Success message = done.

Also confirm in `wrangler.toml`:

- `RECIPIENT_EMAIL` (e.g. `contact@townloc.com`)
- `SENDER_EMAIL` (e.g. `townloc <contact@townloc.com>`)
- Domain verified in Resend (SPF/DKIM)

### J) Admin secrets

```powershell
npx wrangler secret put ADMIN_PASSWORD
```

Password you will use at `/admin`.

```powershell
npx wrangler secret put ADMIN_SECRET
```

Long random string (token signing). Not for daily login typing.

Optional later (publish pages to GitHub from CMS):

```powershell
npx wrangler secret put GITHUB_TOKEN
```

### K) Deploy Worker (site + API live)

```powershell
npm run deploy
```

Expect:

- Assets uploaded
- Worker `townloc` deployed
- Binding shows `env.DB (townloc-leads)`
- Custom domains `townloc.com` + `www.townloc.com` attached

Temporary URL (always works even if domain fails):

- https://townloc.townlocalbiz.workers.dev  
- https://townloc.townlocalbiz.workers.dev/api  

### L) Verify

- https://townloc.com/api ? JSON (not homepage HTML)
- https://townloc.com/admin ? login page
- Contact form on homepage submits without error

---

## What we learned  do NOT do this

| Mistake | What happens |
|---------|----------------|
| Create **Cloudflare Pages** from GitHub | Second app appears (e.g. `townloc-com`) |
| Add `townloc.com` to Pages | DNS CNAME ? `*.pages.dev` |
| Then deploy Worker with same domain | Error: hostname already has DNS records |
| `/api` shows homepage | Pages (or wrong DNS) is serving the site, not Worker |

**Correct hosting for this repo = Worker only.**

---

## Fix if Pages was created by mistake

Do this **before** a clean domain deploy:

1. Cloudflare Dashboard ? **Workers & Pages**
2. Open Pages project (example name: `townloc-com`)
3. **Custom domains** ? Remove `townloc.com` and `www.townloc.com`
4. DNS for `townloc.com` ? Delete CNAME pointing to `*.pages.dev`
5. **Keep** all Zoho MX and email TXT (SPF/DKIM/Resend)
6. Keep Worker named **`townloc`** (do not delete it)
7. You may delete the Pages project later if unused
8. Redeploy:

```powershell
cd "d:\Dextop\Important files\townloc\backend\worker"
npm run deploy
```

---

## Site CMS (free - no R2)

Admin -> **Site CMS**:
- Branding / header / footer
- Home + services + industries + each service page + privacy/terms
- Tick **Show image URL fields only** to edit images faster
- Images = URL only (empty URL keeps the HTML default)

Public site loads `GET /api/cms` via `assets/cms.js`.

Master copy later: `admin/` + `backend/worker/` (+ `assets/cms.js`), then config + deploy.

After code changes: `cd backend/worker` then `npm run deploy`.  
After CMS Save: refresh the website (no redeploy needed for text/URL edits).

---

## Everyday work (after first setup)

### Code change ? GitHub

```powershell
cd "d:\Dextop\Important files\townloc"
gh auth switch
# select townloc if needed
git add .
git commit -m "Describe change"
git push
```

### Code change ? live website

```powershell
cd "d:\Dextop\Important files\townloc\backend\worker"
npm run deploy
```

### Update a secret later

```powershell
cd "d:\Dextop\Important files\townloc\backend\worker"
npx wrangler secret put RESEND_API_KEY
# or ADMIN_PASSWORD / ADMIN_SECRET
npm run deploy
```

(Secrets apply to the Worker; deploy if you also changed files.)

### Watch live logs

```powershell
cd "d:\Dextop\Important files\townloc\backend\worker"
npm run tail
```

### Local frontend preview only (no API DB)

```powershell
cd "d:\Dextop\Important files\townloc"
python -m http.server 5500
```

Open http://localhost:5500/

### Local Worker + API

```powershell
cd "d:\Dextop\Important files\townloc\backend\worker"
npm run dev
```

---

## Config files you may edit

| File | What to change |
|------|----------------|
| `backend/worker/wrangler.toml` | Worker name, domains, `ALLOWED_ORIGINS`, emails, `database_id` |
| `backend/worker/src/index.js` | API logic (only if needed) |
| Root HTML / `assets/` | Website design and copy |
| `admin/` | CMS screens |

Never commit real API keys or passwords into these files.

---

## Checklist (print / copy)

**Permissions**
- [ ] `gh auth status` ? active = **townloc** (for this repo push)
- [ ] `npx wrangler login` done on Cloudflare account for **townloc.com**

**Hosting**
- [ ] Only Worker `townloc` owns the site (no Pages custom domain)
- [ ] DNS: no CNAME to `*.pages.dev` for apex/www
- [ ] Email MX/TXT kept

**Backend**
- [ ] D1 `townloc-leads` created
- [ ] `database_id` in `wrangler.toml`
- [ ] Migrations applied remote
- [ ] `RESEND_API_KEY` secret set
- [ ] `ADMIN_PASSWORD` + `ADMIN_SECRET` set
- [ ] `npm run deploy` succeeded
- [ ] https://townloc.com/api returns JSON

---

## Architecture (one picture)

```
Visitor -> townloc.com
              |
              v
     Cloudflare Worker (townloc)
              |
     +--------+--------+
     |                 |
     v                 v
  Static site      /api + Admin
  (HTML/CSS/JS)    (D1 + Resend)
```

---

## Super short memory

1. GitHub push ? account **`townloc`**  
2. Live site ? Cloudflare **Worker** deploy (not Pages)  
3. Order ? login Cloudflare ? create DB ? migrate ? secrets ? deploy  
4. Never attach the same domain to Pages and Worker  
5. Next time: open this README and follow the command order above
