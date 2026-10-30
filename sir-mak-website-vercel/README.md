# Deploying on Vercel

1. Upload everything in this folder to a GitHub repository.
2. In Vercel: **Add New → Project**, import the repository and press **Deploy**. Leave the settings as they are.
3. Optional, in **Settings → Environment Variables** (then redeploy):
   - `SITE_URL`: your custom domain, such as `https://www.example.com`.
   - To switch on the enquiry form: `SESSION_SECRET` (any random text of 32 or more characters, needed so the form's spam check works on Vercel), plus either `ENQUIRY_WEBHOOK_URL`, or `RESEND_API_KEY` with `ENQUIRY_EMAIL_TO` and `ENQUIRY_EMAIL_FROM`.

**What differs on Vercel:** the admin area is off and enquiries cannot be stored on the site, because Vercel cannot save files. To change content, edit the JSON files in `content/` on GitHub; Vercel republishes automatically. For the homepage video, set `homeVideo` (the 11-character YouTube ID) and `homeVideoTitle` in `content/settings.json`.

---

# Sir MAK Computer Science website

Public website, enquiry handling and a protected admin CMS for Sir Muhammad Ali Khan (Sir MAK).
It is a small Node.js server with **no runtime dependencies**: pages are rendered on the server from JSON content files, so every route loads directly, works without JavaScript and is readable by search engines.

## Why this stack

The project folder had only a phase-1 static site generator: no framework, database, CMS or hosting configuration. A secure admin and a working enquiry endpoint need a server, so the site now runs as one Node process:

- **Rendering:** plain server-side templates (`lib/pages.js`), reusing the phase-1 design system.
- **Content storage:** one JSON file per collection in `content/`. Each save is validated, written atomically, and the previous version is copied to `data/backups/` (last 50 per collection).
- **Admin:** server-rendered forms generated from the content model (`lib/schema.js`), behind scrypt password hashing, signed HttpOnly SameSite=Strict session cookies, CSRF tokens, same-origin checks and login rate limiting.
- **Enquiries:** `/api/enquiry` validates on the server, applies spam checks (honeypot, signed form-age token, per-IP rate limit), de-duplicates repeat submissions, and delivers to whichever destinations are configured. It only reports success when a destination confirms receipt.

Known limitations, chosen deliberately for a first release:

- One editor account, configured by environment variables. Multiple editors with roles would need a user table.
- Content is stored on disk, so the host needs a **persistent filesystem** (a VPS, or a platform with a mounted volume). It will not run on static hosting or on serverless platforms without persistent disk.
- Resources are added by link (put files in `public/files/` or a shared drive). There is no upload form in the admin yet.
- Rate limits and duplicate detection are in memory, which suits a single server process.

## Run it locally

Requires Node.js 20.12 or newer (developed on Node 24).

```bash
cp .env.example .env
```

```bash
npm run hash-password
```

Paste the printed `ADMIN_PASSWORD_HASH` and `SESSION_SECRET` into `.env`, set `ADMIN_USERNAME`, and set `ENQUIRY_STORE=file` to keep enquiries locally. Then:

```bash
npm start
```

The site is at http://localhost:4173 and the admin at http://localhost:4173/admin. Use `npm run dev` to restart automatically on code changes.

> A local `.env` with a generated development login was created while building this. It is for local testing only and is ignored by git; replace it before deploying.

## Pages

| Route | Page |
| --- | --- |
| `/` | Home: hero, choose your level, understand/practise/program, featured lessons, programming & Paper 2, classes, about, testimonials (only when published), FAQ |
| `/learn` | Learning overview |
| `/learn/o-level-igcse`, `/learn/as-level`, `/learn/a2-level`, `/learn/full-a-level` | Level pages: syllabus facts, papers, topic index, lessons, notes, FAQ, enquiry link |
| `/learn/topics` | Topic library with search and level / paper / resource-type filters |
| `/learn/topics/:id` | Topic page with its lessons and resources |
| `/videos` | MAKCS video library with search and level / topic / paper filters |
| `/videos/:id` | Lesson page with a click-to-load, privacy-enhanced YouTube player and an unavailable-video fallback |
| `/classes-workshops` | Published classes and workshops, each with its last-confirmed date |
| `/about` | About Sir MAK |
| `/contact` | Enquiry form (class, workshop, general question, correction) and verified contact details |
| `/privacy`, `/terms`, `/accessibility` | Policies |
| `/sitemap.xml`, `/robots.txt`, `/healthz` | SEO and health check |
| `/admin` | CMS (protected) |
| anything else | Helpful 404 |

Old phase-1 addresses (`/classes/`, `/learn/o-level/`, `/learn/a-level/`) and trailing-slash variants redirect permanently.

## Editing content

Sign in at `/admin`. Every collection supports create, edit, **preview**, publish, unpublish (back to draft) and archive:

Courses · Topics · Videos · Resources · Classes · Workshops · FAQs · Testimonials · Announcements · Contacts & social · Profile details · Site settings · Enquiries.

- **Drafts never appear publicly.** While signed in, add `?preview=1` to any page (or use the bar at the top) to see drafts in place, marked "Draft".
- **Editor notes**: when you are signed in, public pages show yellow notes explaining what is missing and where to fix it. Visitors never see them.
- **Publish rules** enforced on the server: a video needs a valid YouTube ID; a resource needs publishing rights confirmed; a class or workshop needs a "last confirmed" date; a testimonial needs recorded consent; phone/WhatsApp numbers must be in international digits.
- **Contacts are unpublished until verified.** Publishing a contact record is how you mark it approved.
- The dashboard shows a **launch checklist** computed from the live configuration and content.

Content can also be edited by hand in `content/*.json` (restart the server afterwards). Every record has `status`: `draft`, `published` or `archived`.

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `SITE_URL` | Yes in production | Public address, used for canonical links, sitemap, HSTS and secure cookies |
| `PORT` | No | Default 4173 |
| `NODE_ENV` | No | `production` on the live server |
| `TRUST_PROXY` | Behind a proxy | `true` so rate limits use the visitor's IP from `X-Forwarded-For` |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD_HASH`, `SESSION_SECRET` | For admin | All three enable `/admin`. Without them the admin is switched off. |
| `COOKIE_SECURE` | No | Defaults to true when `SITE_URL` is https |
| `ENQUIRY_STORE` | One destination required | `file`: keep enquiries in `data/enquiries.jsonl`, readable and deletable in the admin |
| `ENQUIRY_WEBHOOK_URL` | | POST each enquiry as JSON to a service you control (Formspree, Make, Zapier, Google Apps Script) |
| `RESEND_API_KEY`, `ENQUIRY_EMAIL_TO`, `ENQUIRY_EMAIL_FROM` | | Email each enquiry through Resend. The From address must be on a domain verified in Resend. |
| `CONTENT_DIR`, `DATA_DIR` | No | Override storage locations (e.g. a mounted volume) |

**Until at least one enquiry destination is set, the form is shown disabled** with a notice, and the API returns `503 setup_required`. Nothing is ever simulated or silently discarded.

## Deployment

1. Use a host that runs a long-lived Node process with persistent disk: a small VPS (with nginx or Caddy for HTTPS), or a platform such as Render, Railway or Fly.io with a mounted volume for `content/` and `data/`.
2. Copy the project (git is easiest), set the environment variables, and run `npm start` under a process manager (systemd, pm2 or the platform's own).
3. Serve over HTTPS and set `SITE_URL` to the https address. Set `TRUST_PROXY=true` behind a reverse proxy.
4. Visit `/admin`, work through the launch checklist, then submit a test enquiry and confirm it arrives.

**Backups.** Back up both `content/` (the site) and `data/` (enquiries and automatic content backups), for example a nightly copy to off-site storage. To roll back a collection, copy a file from `data/backups/` over the matching file in `content/` and restart.

**Never commit `.env` or `data/`.** Both are in `.gitignore`.

## Tests

```bash
npm test
```

26 end-to-end tests start real server processes with temporary copies of the content and check: every public route (status, single h1, title, description, canonical, CSP), 404 and redirects, that no unverified contact details, credentials or schedules leak publicly, draft visibility and preview, server-side topic filters and empty states, sitemap and robots, the disabled form and `setup_required` response, enquiry validation, cross-site refusal, honeypot, form-age token, successful storage, concurrent duplicate submission, the no-JavaScript path and rate limiting, admin redirects, wrong and correct login, cookie flags, forged cookies, CSRF and origin checks, every publish rule, publish/preview/unpublish/archive of a video, settings changes, editor-only notes, enquiry deletion and sign-out.

## Project layout

```
server.js            HTTP server, routing, security headers, admin and enquiry handlers
lib/config.js        Environment configuration
lib/schema.js        Content model: fields, validation and publish rules for every collection
lib/store.js         JSON content store (atomic writes, backups) and enquiry storage
lib/auth.js          Password hashing, signed sessions, rate limiting
lib/enquiry.js       Enquiry validation, spam checks, delivery
lib/html.js          Layout, footer, shared blocks, preview-aware content queries
lib/pages.js         Public pages, sitemap, robots
lib/admin.js         Admin pages
public/assets/       styles.css (design tokens at the top), main.js, admin.css, admin.js, favicon
public/files/        Downloadable resources you host yourself
content/             Site content (JSON)
data/                Runtime data: enquiries and backups (not in git)
scripts/             hash-password.js
test/                End-to-end tests
```

Design tokens (colours, type scale, spacing) are CSS custom properties at the top of `public/assets/styles.css`, so the palette and fonts can be changed in one place once the official brand is approved.

## Waiting on Sir MAK

Everything below is saved as a **draft** or left blank, and is not shown to visitors until approved:

- [ ] **Brand:** official name, logo and colours (the site uses a typographic wordmark until then).
- [ ] **Portrait:** an approved photo (a designed placeholder is shown; no generated portrait is used).
- [ ] **Biography:** approve or rewrite the draft in Site settings, then tick "approved".
- [ ] **Qualifications and affiliations:** NED University (telecommunication engineering), IBA (entrepreneurship), and teaching at Cedar College, Highbrow, TCR, The Classroom and SOT Live. Confirm which are accurate and current; publish only those.
- [ ] **Contact routes:** the phone numbers in the planning material conflict. Confirm which number (if any) should be published for WhatsApp and calls, and an email address.
- [ ] **YouTube channel:** confirm the MAKCS channel URL is Sir MAK's official channel.
- [ ] **Social profiles:** confirm the Facebook and LinkedIn links.
- [ ] **Video inventory:** 20 planned lesson entries exist as drafts. For each real video, supply the exact title, YouTube ID, duration and topic.
- [ ] **Classes:** three draft entries from the brief (AS online, A2 online, in-person at The Classroom). Confirm days, times, venue, fees and terms.
- [ ] **Workshops:** "Paper 2 Fast Track" is a draft. Confirm level, topics, dates, fee and registration route.
- [ ] **Syllabus editions:** confirm the edition / exam years for 2210/0478 and 9618 (the rows are hidden until then).
- [ ] **FAQs:** three answers are drafts (online vs in-person, notes and recordings, missed classes).
- [ ] **Notes and resources:** any notes, worksheets or practice to publish, with confirmation of rights.
- [ ] **Testimonials:** only genuine feedback with written consent (parent or guardian for under-18s). None exist yet, so the section is hidden.
- [ ] **Policies:** review the privacy, terms and accessibility pages (legal advice recommended), especially registration, cancellation and refund terms.
- [ ] **Enquiry recipient:** who should receive enquiries, and by which route (email, webhook or the admin inbox).
- [ ] **Domain:** the public address for `SITE_URL`.

## Future expansion

The content model and routing leave room for: topic quizzes, flashcards, past-paper practice, a study planner, student accounts (`/student`), bookmarks and assignments. None of these are built or advertised as available. A programming playground must run student code in an isolated sandbox with resource limits, never on this web server, and any AI study tool must be clearly labelled, grounded in approved material, protect student data, and let students report wrong answers.

This site is independent and is not affiliated with or endorsed by Cambridge International.
