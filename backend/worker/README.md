# Backend Worker — Easy Guide

This folder is the **brain** of the website.

It:

- saves contact form leads
- sends email alerts
- runs the Admin CMS API
- can also serve the website files

**Live:** https://townloc.com (API under `/api/...`)  
**Admin:** https://townloc.com/admin

**Do not use Cloudflare Pages for this project.** One Worker serves the site and API together.  
Full step-by-step (including “Pages by mistake” fix): see the root `README.md`.

For “copy this backend to another project”, read **`doc.md`** in this folder.

---

## Architecture (simple)

```
Website form / Admin panel
          |
          v
   Cloudflare Worker  (this folder)
          |
   +------+------+
   |             |
   v             v
Database       Email
(D1)           (Resend)
```

---

## Structure

```
backend/worker/
├── src/index.js       ← main code (API)
├── migrations/        ← database table files
├── wrangler.toml      ← settings (name, domain, DB, emails)
├── package.json       ← npm commands
├── doc.md             ← how to reuse on other projects
└── README.md          ← this file
```

Related (outside this folder, but needed for CMS):

```
admin/                 ← CMS screens (design + buttons)
```

---

## First-time setup (do once)

```bash
cd backend/worker
npm install
npx wrangler login
```

### 1) Database
```bash
npx wrangler d1 create townloc-leads
```
Paste the database id into `wrangler.toml`.

Then:
```bash
npm run db:migrate:remote
```

### 2) Email (Resend)
1. Make a Resend account  
2. Verify your domain  
3. Create an API key  
4. Save it:
```bash
npx wrangler secret put RESEND_API_KEY
```

Set `RECIPIENT_EMAIL` and `SENDER_EMAIL` in `wrangler.toml`.

### 3) Admin login secrets
```bash
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put ADMIN_SECRET
```

### 4) Deploy
```bash
npm run deploy
```

---

## Everyday use

Change code or website files, then:

```bash
cd backend/worker
npm run deploy
```

That one command updates:

- website pages
- API
- admin files (if served as assets)

---

## Useful commands

| Command | What it does |
|---------|----------------|
| `npm run deploy` | Put everything live |
| `npm run dev` | Test locally |
| `npm run db:migrate:remote` | Update live database tables |
| `npm run tail` | Watch live logs |

---

## Remember

- Edit settings in `wrangler.toml`
- Keep passwords in **secrets**, not in files
- Each new client/project should get its **own** Worker + database  
  (see `doc.md`)
