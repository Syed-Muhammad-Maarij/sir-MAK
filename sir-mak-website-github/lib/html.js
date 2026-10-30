// Shared HTML helpers, the page layout and building blocks used by the public pages.
const fs = require("fs");
const path = require("path");
const config = require("./config");
const store = require("./store");
const { byLevelThenNumber } = require("./schema");

const esc = (s = "") =>
  String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

const formatDate = (iso) =>
  iso ? new Date(iso.slice(0, 10) + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";

const NAV = [
  { href: "/", label: "Home", key: "home" },
  { href: "/learn", label: "Learn", key: "learn" },
  { href: "/videos", label: "Videos", key: "videos" },
  { href: "/code-pad", label: "Code Pad", key: "code" },
  { href: "/tools", label: "Tools", key: "tools" },
  { href: "/classes-workshops", label: "Classes & Workshops", key: "classes" },
  { href: "/about", label: "About", key: "about" },
  { href: "/contact", label: "Contact", key: "contact" },
];

/* ---------- content queries that respect admin preview ---------- */
// In preview mode (signed-in editor + ?preview=1) drafts are shown, marked with a Draft label.
function query(ctx) {
  const opts = { includeDrafts: Boolean(ctx.preview) };
  const courses = store.list("courses", opts).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  const course = (slug) => courses.find((c) => c.slug === slug);
  const topics = store.list("topics", opts).sort(byLevelThenNumber(store));
  const videos = store.list("videos", opts);
  const resources = store.list("resources", opts);
  const contacts = store.list("contacts", opts);
  return {
    settings: store.settings(),
    courses,
    course,
    topics,
    topic: (id) => topics.find((t) => t.id === id),
    topicsFor: (slug) => {
      const c = course(slug);
      const levels = c && c.combines && c.combines.length ? c.combines : [slug];
      return topics.filter((t) => levels.includes(t.level));
    },
    videos,
    videosFor: (pred) => videos.filter(pred),
    resources,
    classes: store.list("classes", opts),
    workshops: store.list("workshops", opts),
    faqs: (group) => store.list("faqs", opts).filter((f) => !group || f.group === group).sort((a, b) => (a.order ?? 99) - (b.order ?? 99)),
    testimonials: store.list("testimonials", opts),
    credentials: store.list("credentials", opts).sort((a, b) => (a.order ?? 99) - (b.order ?? 99)),
    contacts,
    contact: (kind) => contacts.find((c) => c.kind === kind),
    socials: contacts.filter((c) => c.kind === "youtube" || c.kind === "social"),
    announcement: () => {
      const today = new Date().toISOString().slice(0, 10);
      return store
        .list("announcements", opts)
        .filter((a) => (!a.startDate || a.startDate <= today) && (!a.endDate || a.endDate >= today))
        .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
    },
  };
}

const enquiryOpen = () => config.enquiryDestinations().length > 0;
// A "working contact route" is an open enquiry form or at least one verified (published) contact.
const contactRoute = (q) => enquiryOpen() || q.contacts.some((c) => ["whatsapp", "phone", "email"].includes(c.kind));

/* ---------- small blocks ---------- */
const draftTag = (r) => (r && r.status && r.status !== "published" ? ` <span class="status status--draft">${esc(r.status)}</span>` : "");

const availabilityLabel = {
  open: "Open for registration",
  waitlist: "Wait-list only",
  full: "Full",
  closed: "Registration closed",
  cancelled: "Cancelled",
};
const availabilityTag = (a) => `<span class="status status--${esc(a)}">${esc(availabilityLabel[a] || a)}</span>`;

// Visible only to a signed-in editor: explains what is missing and where to fix it.
function adminNote(ctx, html) {
  if (!ctx.admin) return "";
  return `<div class="admin-note" role="note"><p><strong>Editor note</strong> (only you can see this): ${html}</p></div>`;
}

function crumbs(items) {
  const lis = items
    .map((it, i) => (i === items.length - 1 ? `<li aria-current="page">${esc(it[0])}</li>` : `<li><a href="${esc(it[1])}">${esc(it[0])}</a></li>`))
    .join("");
  return `<nav class="crumbs" aria-label="Breadcrumb"><ol>${lis}</ol></nav>`;
}

function pageHead({ trail, eyebrow, title, lede, extra = "", mod = "" }) {
  return `<div class="page-head${mod ? ` page-head--${mod}` : ""}"><div class="wrap">
  ${crumbs(trail)}
  <h1>${title}</h1>
  ${eyebrow ? `<p class="page-meta">${eyebrow}</p>` : ""}
  ${lede ? `<p class="lede">${lede}</p>` : ""}
  ${extra}
</div></div>`;
}

function faqBlock(list) {
  if (!list.length) return "";
  return `<div class="faq">${list
    .map((f) => `<details><summary>${esc(f.question)}${draftTag(f)}</summary><p>${esc(f.answer)}</p></details>`)
    .join("")}</div>`;
}

const ytThumb = (id) => `https://i.ytimg.com/vi/${encodeURIComponent(id)}/hqdefault.jpg`;

function videoCard(v, q, { headingLevel = 3 } = {}) {
  const c = q.course(v.level);
  const t = v.topic ? q.topic(v.topic) : null;
  const h = `h${headingLevel}`;
  return `<article class="video-card">
    <a class="video-card__thumb" href="/videos/${esc(v.id)}" tabindex="-1" aria-hidden="true">
      ${v.youtubeId ? `<img src="${ytThumb(v.youtubeId)}" alt="" width="480" height="360" loading="lazy" decoding="async" data-yt-thumb>` : `<span class="video-card__nothumb">No video linked yet</span>`}
      ${v.duration ? `<span class="video-card__dur">${esc(v.duration)}</span>` : ""}
    </a>
    <div class="video-card__body">
      <p class="eyebrow">${esc(c ? c.short || c.title : v.level)}${v.paper ? ` · ${esc(v.paper)}` : ""}${draftTag(v)}</p>
      <${h} class="video-card__title"><a href="/videos/${esc(v.id)}">${esc(v.title)}</a></${h}>
      ${t ? `<p class="small muted">Topic: ${esc(t.number ? t.number + ". " : "")}${esc(t.title)}</p>` : ""}
    </div>
  </article>`;
}

/* ---------- layout ---------- */
function layout(ctx, { title, description, path, active, body, jsonLd, noindex, scripts = [] }) {
  const q = query(ctx);
  const s = q.settings;
  const brand = s.brand || "Sir MAK";
  const fullTitle = title ? `${title} | ${brand} Computer Science` : `${brand} | O Level, IGCSE & A Level Computer Science`;
  const canonical = `${config.siteUrl}${path}`;
  const version = assetVersion();
  const nav = NAV.map(
    (n) => `<li><a href="${n.href}"${n.key === active ? ' aria-current="page"' : ""}>${esc(n.label)}</a></li>`
  ).join("");
  const wordmark = s.logoUrl
    ? `<img src="${esc(s.logoUrl)}" alt="${esc(brand)}" height="40" class="logo">`
    : `<span class="wordmark__name">${esc(brand)}</span><span class="wordmark__tag" aria-hidden="true">CS</span>`;
  const previewBar = ctx.admin
    ? `<div class="editor-bar"><div class="wrap"><p>Signed in as editor. ${
        ctx.preview
          ? `<strong>Preview mode:</strong> drafts are shown. <a href="${esc(path)}">Exit preview</a>`
          : `<a href="${esc(path)}?preview=1">Preview drafts on this page</a>`
      } · <a href="/admin">Admin</a></p></div></div>`
    : "";
  const ld = jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>` : "";

  return `<!doctype html>
<html lang="en" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
${noindex || ctx.preview ? '<meta name="robots" content="noindex">' : ""}
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:site_name" content="${esc(brand)} Computer Science">
<meta property="og:title" content="${esc(title || fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(canonical)}">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#060b14">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&family=Newsreader:ital,opsz,wght@0,6..72,500;0,6..72,600;0,6..72,700;1,6..72,500&family=Public+Sans:wght@400;500;600&display=swap">
<link rel="stylesheet" href="/assets/styles.css?v=${version}">
<script src="/assets/theme.js?v=${version}"></script>
<script src="/assets/main.js?v=${version}" defer></script>
${scripts.map((src) => `<script src="${esc(src)}?v=${version}" defer></script>`).join("\n")}
${ld}
</head>
<body>
<canvas class="cs-bg" data-cs-bg aria-hidden="true"></canvas>
<a class="skip-link" href="#main">Skip to content</a>
${previewBar}
${s.previewBanner ? `<div class="preview-banner"><div class="wrap"><p>${esc(s.previewBanner)}</p></div></div>` : ""}
<header class="site-header">
  <div class="wrap">
    <a class="wordmark" href="/" aria-label="${esc(brand)} Computer Science, home">${wordmark}</a>
    <nav class="site-nav" id="site-nav" aria-label="Main">
      <ul>${nav}</ul>
    </nav>
    <div class="header-actions">
      <button class="theme-switch" type="button" role="switch" aria-checked="true" data-theme-switch hidden>
        <span class="visually-hidden">Dark theme</span>
        <span class="theme-switch__track" aria-hidden="true"><span class="theme-switch__stars"></span><span class="theme-switch__knob"></span></span>
      </button>
      <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>
    </div>
  </div>
</header>
<main id="main" tabindex="-1">
${body}
</main>
${footer(q)}
</body>
</html>
`;
}

function footer(q) {
  const s = q.settings;
  const brand = s.brand || "Sir MAK";
  const levels = q.courses.map((c) => `<li><a href="/learn/${esc(c.slug)}">${esc(c.title)}</a></li>`).join("");
  const socials = q.socials.map((c) => `<li><a href="${esc(c.value)}" rel="noopener">${esc(c.label)}</a></li>`).join("");
  const year = s.copyrightYear || new Date().getFullYear();
  return `<footer class="site-footer">
  <div class="wrap">
    <div class="footer-grid">
      <div>
        <p class="wordmark"><span class="wordmark__name">${esc(brand)}</span><span class="wordmark__tag" aria-hidden="true">CS</span></p>
        <p class="muted">O Level, IGCSE, AS and A Level Computer Science with ${esc(s.fullName)}${s.city ? `, ${esc(s.city)}` : ""}.</p>
      </div>
      <nav aria-labelledby="f-levels"><h2 id="f-levels">Learn</h2><ul>${levels}<li><a href="/learn/topics">Topic library</a></li></ul></nav>
      <nav aria-labelledby="f-site"><h2 id="f-site">Site</h2><ul>
        <li><a href="/videos">MAKCS video library</a></li>
        <li><a href="/code-pad">Python code pad</a></li>
        <li><a href="/tools">Calculators &amp; games</a></li>
        <li><a href="/classes-workshops">Classes &amp; workshops</a></li>
        <li><a href="/about">About Sir MAK</a></li>
        <li><a href="/contact">Contact</a></li>
      </ul></nav>
      <nav aria-labelledby="f-legal"><h2 id="f-legal">Policies</h2><ul>
        <li><a href="/privacy">Privacy</a></li>
        <li><a href="/terms">Terms</a></li>
        <li><a href="/accessibility">Accessibility</a></li>
      </ul></nav>
      ${socials ? `<nav aria-labelledby="f-social"><h2 id="f-social">Follow</h2><ul>${socials}</ul></nav>` : ""}
    </div>
    <div class="footer-legal">
      <p>© ${esc(year)} ${esc(s.copyrightName || s.fullName)}. Independent teaching, not affiliated with or endorsed by Cambridge International.</p>
      <p>Spotted a mistake? <a href="/contact#correction">Report it</a>.</p>
    </div>
  </div>
</footer>`;
}

// Changes whenever styles.css or main.js changes, so long-cached assets are refreshed after edits.
const assetVersion = () =>
  ["styles.css", "main.js", "theme.js", "tools.js", "codepad.js", "codepad-worker.js"]
    .map((f) => fs.statSync(path.join(config.publicDir, "assets", f)).mtimeMs)
    .reduce((a, b) => Math.max(a, b), 0)
    .toString(36);

module.exports = {
  esc, formatDate, query, enquiryOpen, contactRoute, draftTag, availabilityTag, availabilityLabel,
  adminNote, crumbs, pageHead, faqBlock, videoCard, ytThumb, layout,
};
