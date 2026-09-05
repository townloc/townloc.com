# Backend + CMS (Master Package)

**Where is this file?** Inside the backend: `backend/worker/doc.md`

Why? Because you will **copy this backend** to other projects. The guide should travel with it.

---

## Simple idea (like a kitchen)

Think of a restaurant:

| Part | Real life | This project |
|------|-----------|--------------|
| **Frontend** | The dining room (looks nice) | Website pages & design |
| **Backend** | The kitchen (cooks & stores) | API, database, email |
| **Admin CMS** | The manager’s office | `/admin` login panel |

You can build a **new dining room** (new website design),  
and **reuse the same kitchen** (copy this backend + CMS),  
then only change the settings (config).

---

## Architecture (how it fits together)

```
Browser (visitor)
    |
    |  opens website pages
    v
Frontend pages  ------------------+
(index.html, assets, services…)   |
                                  |  form / admin requests
                                  v
                         Cloudflare Worker
                         (backend/worker)
                                  |
                    +-------------+-------------+
                    |             |             |
                    v             v             v
                 D1 Database   Resend email   Admin CMS
                 (leads/CMS)   (notifications) (admin/ UI)
```

**One deploy command** uploads:

1. Website files (frontend)
2. API (backend)
3. Admin pages

All live on your domain (example: `gglmap.com`).

---

## Folder structure

```
project/
├── admin/                 ← CMS screens (login + dashboard)
│   ├── index.html
│   ├── app.html
│   ├── admin.js
│   ├── admin-app.js
│   └── admin.css
│
├── backend/
│   └── worker/            ← MASTER PACKAGE (copy this)
│       ├── src/index.js   ← all API logic
│       ├── migrations/    ← database tables
│       ├── wrangler.toml  ← names, domain, DB, emails
│       ├── package.json
│       ├── doc.md         ← this file
│       └── README.md      ← how to run this worker
│
└── (frontend pages…)      ← NOT part of master; make new each project
```

**Copy for a new project:** `backend/worker/` + `admin/`

---

## What you do on a NEW project (step by step)

### Step 1 — Copy
Copy these two things into the new project:

- `backend/worker/`
- `admin/`

Keep the same layout as this project:

```
new-project/
├── admin/
├── backend/
│   └── worker/
├── index.html          ← your new website pages go here
└── assets/             ← your new website styles/images go here
```

The Worker looks at the **project root** (see `wrangler.toml` → `[assets]`), so `admin/` and your pages must sit there.

### Step 2 — Change names in `wrangler.toml`
Open `wrangler.toml` and change:

1. Worker name  
2. Website domain  
3. Database name / id (make a **new** database)  
4. Allowed website URLs  
5. Email addresses  

### Step 3 — Create a new database
```bash
cd backend/worker
npm install
npx wrangler login
npx wrangler d1 create your-new-db-name
```
Put the new database id into `wrangler.toml`.

### Step 4 — Build the database tables
```bash
npm run db:migrate:remote
```

### Step 5 — Add secrets (passwords / keys)
```bash
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put ADMIN_PASSWORD
npx wrangler secret put ADMIN_SECRET
```

### Step 6 — Connect the frontend
In the new website forms, set the API address to this Worker.

### Step 7 — Go live
```bash
npm run deploy
```

**Done.** Next time: copy → change config → deploy.

---

## Checklist (print this)

- [ ] Copied `backend/worker/` and `admin/`
- [ ] Changed Worker name
- [ ] Changed domain
- [ ] Created **new** D1 database
- [ ] Ran migrations
- [ ] Set email settings
- [ ] Set secrets
- [ ] Pointed frontend form to API
- [ ] Ran `npm run deploy`

---

## Golden rules

1. **One project = one Worker + one database**  
   Do not share one database with two websites.
2. **Always copy `admin/` with the worker**  
   Then you only configure next time.
3. **Git push does not update the live site**  
   You must run `npm run deploy`.

---

## Super short summary

> **Master** = kitchen + manager office (`backend/worker` + `admin`)  
> **New website** = new dining room (frontend design)  
> **Your job** = copy master → change config → deploy
