# Kent Web Design — Client Portal (`kwd-portal`)

A client portal + automated website build pipeline for Kent Web Design.

A client is invited, sets a password, logs in, and completes an onboarding brief.
From the admin side we review the brief and click **Build site**, which provisions
a fresh WordPress site, installs our theme, and fills it with pages written by
Claude from the brief. Clients can also raise change requests once their site is live.

---

## The stack

| Piece | What it is | Where |
|---|---|---|
| App | Next.js 16 (App Router, TypeScript) | this repo |
| Hosting | Railway (auto-deploys on push to `main`) | railway.app |
| Database | PostgreSQL (Prisma ORM v6) | Railway service |
| Auth | Clerk (invite-only) | clerk.com |
| File storage | Cloudflare R2 (logos, photos) | Cloudflare |
| Site provisioning | InstaWP API (creates the WordPress sites) | app.instawp.io |
| AI copy | Claude API (Opus 4.8) writes the page content | console.anthropic.com |

**Deploy flow:** push to `main` → Railway builds and deploys automatically. There is
no separate deploy step.

---

## How it fits together

```
Client                                  Admin (you)
──────                                  ───────────
Gets invite email (Clerk)               Invite a client by email (/submissions)
Sets password, logs in
Dashboard (/dashboard)                  See all briefs (/submissions)
  → completes onboarding form (/brief)  Open a brief → see every answer + files
    (saved to Postgres, files to R2)    Click "Build site":
Later: raise change requests              1. Higgsfield generates bespoke imagery
                                          2. Claude plans the site + writes every page
                                          3. DESIGN REVIEW: the home page is rendered
                                             to real screenshots (headless Chrome),
                                             critiqued against the agency wow bar,
                                             refined, and re-checked (max 2 passes)
                                          4. InstaWP provisions WordPress + KWD theme
                                          5. Pages created; review score in buildData
                                        Manage change requests (/requests)
```

- **Roles:** an email listed in `ADMIN_EMAILS` is an admin (sees `/submissions`, `/requests`).
  Everyone else is a client (sees `/dashboard`). Logic in `src/middleware.ts` + `src/lib/auth.ts`.
- **The onboarding form** is the original static form (`public/brief/` assets +
  `form/index.html`), served behind login by `src/app/brief/route.ts`. It posts answers
  to `src/app/api/submit/route.ts`.

---

## Key files

| Path | What |
|---|---|
| `prisma/schema.prisma` | DB models: `Submission`, `ChangeRequest` |
| `src/middleware.ts` | Locks /brief, /dashboard, /submissions, /requests behind login |
| `src/lib/auth.ts` | `getViewer()` — who's logged in + are they admin |
| `src/lib/prisma.ts` | DB client |
| `src/lib/r2.ts` | Cloudflare R2 (presigned upload/download) |
| `src/lib/instawp.ts` | InstaWP API: create site + run WP-CLI commands |
| `src/lib/wp.ts` | WordPress REST client (create pages, set options) |
| `src/lib/ai.ts` | Claude pipeline: plan → write pages → design-review loop |
| `src/lib/render.ts` | Headless-Chrome screenshots of the generated home page |
| `src/lib/critique.ts` | Vision critique vs the wow bar + refine prompts |
| `src/lib/sitebuilder.ts` | Orchestrates the whole build pipeline |
| `src/app/api/submit/route.ts` | Receives a completed brief, saves it |
| `src/app/api/upload-url/route.ts` | Issues R2 upload URLs for the form |
| `src/app/submissions/` | Admin: briefs list, detail, invite, Build button |
| `src/app/requests/` | Admin: change requests |
| `src/app/dashboard/` | Client home |
| `theme-src/kwd-theme/` | The WordPress theme source (zipped to `public/themes/kwd-theme.zip`) |

---

## Running it locally

```bash
git clone https://github.com/kentwebdesign-jpg/kwd-portal.git
cd kwd-portal
npm install
cp .env.example .env      # then fill in the values (copy from Railway)
npm run dev               # http://localhost:3000
```

Without `DATABASE_URL` the app won't start; without the other keys, individual
features (auth, uploads, builds, AI copy) degrade or fall back. The full set of
values lives in Railway → `kwd-portal` service → Variables.

If you change the theme in `theme-src/kwd-theme/`, re-zip it:

```bash
cd theme-src && zip -r ../public/themes/kwd-theme.zip kwd-theme
```

---

## Environment variables

Set in **Railway → `kwd-portal` service → Variables**. See `.env.example` for the
full annotated list. None of the secret values are committed to git.

`NEXT_PUBLIC_*` variables are baked in at **build** time, so they must be set in
Railway *before* a deploy, not just at runtime.

---

## Status / roadmap

- ✅ Per-client accounts, dashboard, onboarding form, file uploads
- ✅ Admin: briefs + detail + invites, change requests
- ✅ Build pipeline: provision + theme + AI-written pages
- ✅ Design-review loop: render → critique → refine before publishing
- ⬜ Replace the placeholder `kwd-theme` with the real master theme
- ⬜ Higgsfield image generation in the pipeline
- ⬜ Custom domain `portal.kentwebdesign.com` + Clerk production instance

---

## Gotchas

- InstaWP sites on the current plan **expire after ~48 hours** — fine for drafts; a
  paid InstaWP plan is needed for sites that persist.
- The Claude copy step **falls back to raw brief text** if `ANTHROPIC_API_KEY` is unset.
- The design-review loop needs headless Chrome. It tries, in order:
  `PUPPETEER_EXECUTABLE_PATH` (env override) → `@sparticuz/chromium` (bundled
  static build, used on Railway) → a locally installed Chrome (dev Macs). If none
  launch, the build **continues without the review** and `buildData.design.verdict`
  records `skipped: renderer unavailable` — check that field on the first Railway
  build after deploying.
- The portal lives inside the larger `kentwebdesign` working tree as its own git repo.
