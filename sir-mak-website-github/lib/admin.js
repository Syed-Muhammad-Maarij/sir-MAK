// Admin interface: server-rendered forms generated from lib/schema.js.
// server.js only routes here after verifying the session; every POST is also CSRF-checked there.
const config = require("./config");
const store = require("./store");
const { collections, settingsFields } = require("./schema");
const { esc, formatDate } = require("./html");

const STATUS_LABEL = { draft: "Draft", published: "Published", archived: "Archived" };
const statusTag = (s) => `<span class="status status--${esc(s)}">${esc(STATUS_LABEL[s] || s)}</span>`;

// Where an editor can preview a record that has no page of its own.
const PREVIEW_PAGE = {
  resources: (r) => (r.topic ? `/learn/topics/${r.topic}` : `/learn/${r.level}`),
  classes: () => "/classes-workshops",
  workshops: () => "/classes-workshops",
  faqs: (r) => (r.group === "classes" ? "/classes-workshops" : r.group === "learning" ? "/learn/o-level-igcse" : "/"),
  testimonials: () => "/",
  announcements: () => "/",
  contacts: () => "/contact",
  credentials: () => "/about",
};
const previewHref = (name, r) => {
  const fn = collections[name].publicPath || PREVIEW_PAGE[name];
  return fn ? `${fn(r)}?preview=1` : "";
};

function layout(session, { title, active, body, flash }) {
  const nav = [
    ["/admin", "Dashboard", "dashboard"],
    ...Object.entries(collections).map(([k, c]) => [`/admin/${k}`, c.label, k]),
    ["/admin/settings", "Site settings", "settings"],
    ["/admin/enquiries", "Enquiries", "enquiries"],
  ].map(([href, label, key]) => `<li><a href="${href}"${key === active ? ' aria-current="page"' : ""}>${esc(label)}</a></li>`).join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(title)} | Admin</title>
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/assets/styles.css">
<link rel="stylesheet" href="/assets/admin.css">
<script src="/assets/admin.js" defer></script>
</head>
<body class="admin">
<a class="skip-link" href="#main">Skip to content</a>
<header class="admin-header"><div class="admin-wrap">
  <a class="wordmark" href="/admin"><span class="wordmark__name">Admin</span><span class="wordmark__tag">CMS</span></a>
  ${session ? `<div class="admin-header__right"><a href="/" target="_blank" rel="noopener">View site</a>
  <form method="post" action="/admin/logout"><input type="hidden" name="_csrf" value="${esc(session.csrf)}"><button class="btn btn--ghost btn--small" type="submit">Sign out</button></form></div>` : ""}
</div></header>
<div class="admin-wrap admin-body">
  ${session ? `<nav class="admin-nav" aria-label="Admin"><ul>${nav}</ul></nav>` : ""}
  <main id="main" tabindex="-1" class="admin-main">
    ${flash ? `<div class="callout callout--${flash.kind}" role="${flash.kind === "bad" ? "alert" : "status"}"><p>${flash.html}</p></div>` : ""}
    ${body}
  </main>
</div>
</body>
</html>`;
}

/* ---------- auth pages ---------- */
function notConfigured() {
  return layout(null, {
    title: "Admin not configured",
    body: `<h1>Admin is not set up yet</h1>
    <p>The admin area is switched off until an editor account is configured on the server. Nobody can sign in, and no content can be changed through the web.</p>
    <p>To enable it, set these environment variables (see <code>README.md</code>) and restart the server:</p>
    <ul><li><code>ADMIN_USERNAME</code></li><li><code>ADMIN_PASSWORD_HASH</code>, created with <code>npm run hash-password</code></li><li><code>SESSION_SECRET</code>, a random string of at least 32 characters</li></ul>`,
  });
}

function loginPage({ error, username = "" } = {}) {
  return layout(null, {
    title: "Sign in",
    flash: error ? { kind: "bad", html: esc(error) } : null,
    body: `<div class="admin-login">
    <h1>Editor sign in</h1>
    <form method="post" action="/admin/login" class="admin-form">
      <div class="field"><label for="username">Username</label><input id="username" name="username" autocomplete="username" required value="${esc(username)}"></div>
      <div class="field"><label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required></div>
      <button class="btn" type="submit">Sign in</button>
    </form></div>`,
  });
}

/* ---------- dashboard ---------- */
function setupChecklist() {
  const pub = (name, pred = () => true) => store.list(name).filter(pred).length;
  const s = store.settings();
  const destinations = config.enquiryDestinations();
  const items = [
    [destinations.length > 0, "Enquiry destination", destinations.length ? `Enquiries go to: ${destinations.join(", ")}.` : "Not configured. The enquiry form is disabled. Set <code>ENQUIRY_STORE=file</code>, <code>ENQUIRY_WEBHOOK_URL</code> or the Resend variables."],
    [!/localhost|127\.0\.0\.1|example\.com/.test(config.siteUrl), "Public site address", `<code>SITE_URL</code> is <code>${esc(config.siteUrl)}</code>. Canonical links and the sitemap use it.`],
    [config.admin.secureCookie || !config.production, "Secure admin cookie", config.admin.secureCookie ? "Cookies are sent over HTTPS only." : "Serve the site over HTTPS and set <code>COOKIE_SECURE=true</code> in production."],
    [pub("contacts", (c) => ["whatsapp", "phone", "email"].includes(c.kind)) > 0, "Verified contact route", "Publish the phone, WhatsApp or email Sir MAK approves in <a href=\"/admin/contacts\">Contacts &amp; social</a>. The supplied numbers conflict."],
    [pub("contacts", (c) => c.kind === "youtube") > 0, "Official YouTube channel", "Publish the channel link in <a href=\"/admin/contacts\">Contacts &amp; social</a> once it is confirmed as Sir MAK's."],
    [Boolean(s.bioApproved && s.bio), "Approved biography", "Edit and approve it in <a href=\"/admin/settings\">Site settings</a>."],
    [pub("credentials") > 0, "Qualifications and affiliations", "Publish approved items in <a href=\"/admin/credentials\">Profile details</a>."],
    [Boolean(s.portraitUrl), "Official portrait", "Add the approved portrait URL in <a href=\"/admin/settings\">Site settings</a>."],
    [pub("videos") > 0, "Video lessons", `${pub("videos")} published, ${store.list("videos", { includeDrafts: true }).length - pub("videos")} drafts. <a href="/admin/videos">Add YouTube IDs and publish</a>.`],
    [pub("classes") + pub("workshops") > 0, "Classes and workshops", "Publish confirmed timetables in <a href=\"/admin/classes\">Classes</a> and <a href=\"/admin/workshops\">Workshops</a>."],
    [store.list("courses").every((c) => c.edition || (c.combines && c.combines.length)), "Syllabus editions", "Add the confirmed edition / exam years to each <a href=\"/admin/courses\">course</a>."],
  ];
  return `<ul class="checklist">${items.map(([done, label, detail]) => `<li class="${done ? "is-done" : "is-todo"}"><span class="checklist__mark">${done ? "Done" : "To do"}</span><div><strong>${esc(label)}</strong><p>${detail}</p></div></li>`).join("")}</ul>`;
}

function dashboard(session) {
  const counts = Object.entries(collections).map(([k, c]) => {
    const rows = store.all(k);
    const by = (s) => rows.filter((r) => r.status === s).length;
    return `<tr><th scope="row"><a href="/admin/${k}">${esc(c.label)}</a></th><td>${by("published")}</td><td>${by("draft")}</td><td>${by("archived")}</td></tr>`;
  }).join("");
  const enquiries = config.enquiry.store ? store.listEnquiries().length : null;
  return layout(session, {
    title: "Dashboard",
    active: "dashboard",
    body: `<h1>Dashboard</h1>
    <p class="lede">Content changes take effect on the public site as soon as you save. Drafts are visible only to you, through <strong>Preview</strong>.</p>
    <h2>Launch checklist</h2>
    ${setupChecklist()}
    <h2>Content</h2>
    <div class="table-wrap"><table class="table"><thead><tr><th scope="col">Collection</th><th scope="col">Published</th><th scope="col">Drafts</th><th scope="col">Archived</th></tr></thead><tbody>${counts}</tbody></table></div>
    ${enquiries !== null ? `<p class="mt-5"><a href="/admin/enquiries">${enquiries} stored enquir${enquiries === 1 ? "y" : "ies"}</a></p>` : ""}`,
  });
}

/* ---------- collection list ---------- */
function listPage(session, name, url) {
  const def = collections[name];
  const filter = url.searchParams.get("status") || "";
  const qtext = (url.searchParams.get("q") || "").toLowerCase();
  const rows = store.all(name)
    .filter((r) => (!filter || r.status === filter) && (!qtext || JSON.stringify(r).toLowerCase().includes(qtext)))
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  const tabs = ["", "published", "draft", "archived"].map((s) =>
    `<li><a href="/admin/${name}${s ? `?status=${s}` : ""}"${s === filter ? ' aria-current="page"' : ""}>${s ? STATUS_LABEL[s] : "All"}</a></li>`).join("");
  const body = `<div class="admin-title"><h1>${esc(def.label)}</h1><a class="btn" href="/admin/${name}/new">New ${esc(def.singular)}</a></div>
  <p class="muted">${esc(def.help || "")}</p>
  <div class="admin-toolbar"><ul class="admin-tabs">${tabs}</ul>
  <form method="get" role="search" class="admin-search"><label class="visually-hidden" for="q">Search ${esc(def.label)}</label><input id="q" name="q" type="search" value="${esc(qtext)}" placeholder="Search">${filter ? `<input type="hidden" name="status" value="${esc(filter)}">` : ""}<button class="btn btn--ghost btn--small" type="submit">Search</button></form></div>
  ${rows.length ? `<div class="table-wrap"><table class="table"><thead><tr><th scope="col">${esc(def.fields.find((f) => f.name === def.titleField).label)}</th><th scope="col">Status</th><th scope="col">Updated</th><th scope="col"><span class="visually-hidden">Actions</span></th></tr></thead><tbody>
  ${rows.map((r) => {
    const id = store.idOf(name, r);
    const prev = previewHref(name, r);
    return `<tr><td><a href="/admin/${name}/${encodeURIComponent(id)}">${esc(String(r[def.titleField]).slice(0, 90) || "(untitled)")}</a>${r.level ? ` <span class="muted small">${esc(r.level)}</span>` : ""}</td><td>${statusTag(r.status)}</td><td class="small">${esc(formatDate(r.updatedAt))}</td><td>${prev ? `<a class="small" href="${esc(prev)}" target="_blank" rel="noopener">Preview</a>` : ""}</td></tr>`;
  }).join("")}</tbody></table></div>` : `<div class="empty"><p>No ${esc(def.label.toLowerCase())} ${filter ? `with status “${esc(filter)}”` : "yet"}.</p></div>`}`;
  return layout(session, { title: def.label, active: name, body });
}

/* ---------- forms ---------- */
function fieldInput(f, value, error) {
  const id = `f-${f.name}`;
  const describedBy = [f.hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ");
  const aria = `${describedBy ? ` aria-describedby="${describedBy}"` : ""}${error ? ' aria-invalid="true"' : ""}${f.required ? " required" : ""}`;
  const v = value ?? "";
  let control;
  switch (f.type) {
    case "textarea":
      control = `<textarea id="${id}" name="${f.name}"${aria}>${esc(v)}</textarea>`; break;
    case "lines":
      control = `<textarea id="${id}" name="${f.name}"${aria}>${esc(Array.isArray(v) ? v.join("\n") : v)}</textarea>`; break;
    case "checkbox":
      return `<div class="field field--check"><label class="choice"><input type="checkbox" id="${id}" name="${f.name}"${v ? " checked" : ""}${aria}> <span>${esc(f.label)}</span></label>${f.hint ? `<span class="field__hint" id="${id}-hint">${esc(f.hint)}</span>` : ""}${error ? `<p class="field__error" id="${id}-error">${esc(error)}</p>` : ""}</div>`;
    case "select": {
      const opts = (typeof f.options === "function" ? f.options(store) : f.options).map((o) => (Array.isArray(o) ? o : [o, o]));
      control = `<select id="${id}" name="${f.name}"${aria}><option value="">${f.required ? "Choose…" : "None"}</option>${opts.map(([ov, label]) => `<option value="${esc(ov)}"${String(ov) === String(v) ? " selected" : ""}>${esc(label)}</option>`).join("")}</select>`;
      break;
    }
    default: {
      const type = { date: "date", number: "number", url: "text" }[f.type] || "text";
      control = `<input id="${id}" name="${f.name}" type="${type}" value="${esc(v ?? "")}"${f.type === "number" ? ' step="any"' : ""}${aria}>`;
    }
  }
  return `<div class="field${f.type === "textarea" || f.type === "lines" ? " span-2" : ""}"><label for="${id}">${esc(f.label)}${f.required ? "" : ' <span class="muted">(optional)</span>'}</label>${control}${f.hint ? `<span class="field__hint" id="${id}-hint">${esc(f.hint)}</span>` : ""}${error ? `<p class="field__error" id="${id}-error">${esc(error)}</p>` : ""}</div>`;
}

function editPage(session, name, id, { record, errors = {}, flash } = {}) {
  const def = collections[name];
  const existing = id ? store.get(name, id) : null;
  if (id && !existing) return null;
  const r = record || existing || {};
  const status = existing ? existing.status : "new";
  const actions = {
    new: [["draft", "Save as draft", ""], ["published", "Save and publish", "btn--ghost"]],
    draft: [["draft", "Save draft", ""], ["published", "Save and publish", "btn--ghost"], ["archived", "Archive", "btn--ghost"]],
    published: [["published", "Save changes", ""], ["draft", "Unpublish (back to draft)", "btn--ghost"], ["archived", "Archive", "btn--ghost"]],
    archived: [["draft", "Restore as draft", ""]],
  }[status];
  const prev = existing ? previewHref(name, existing) : "";
  const errCount = Object.keys(errors).filter((k) => k !== "_form").length;
  const formFlash = errors._form || errCount
    ? { kind: "bad", html: `Not saved. ${esc(errors._form || "")} ${errCount ? `Fix the ${errCount} highlighted field${errCount > 1 ? "s" : ""}.` : ""}` }
    : flash;

  const body = `<p class="small"><a href="/admin/${name}">← ${esc(def.label)}</a></p>
  <div class="admin-title"><h1>${existing ? `Edit ${esc(def.singular)}` : `New ${esc(def.singular)}`}</h1>${existing ? statusTag(existing.status) : ""}</div>
  ${r._note ? `<div class="callout mb-5"><p><strong>Note:</strong> ${esc(r._note)}</p></div>` : ""}
  ${existing ? `<p class="small muted">Last saved ${esc(new Date(existing.updatedAt).toLocaleString("en-GB"))}${prev ? ` · <a href="${esc(prev)}" target="_blank" rel="noopener">Preview on the site</a>` : ""}</p>` : ""}
  <form method="post" class="admin-form" novalidate data-admin-form>
    <input type="hidden" name="_csrf" value="${esc(session.csrf)}">
    <div class="form-grid">${def.fields.map((f) => fieldInput(f, r[f.name], errors[f.name])).join("")}</div>
    <div class="admin-actions">${actions.map(([value, label, cls]) => `<button class="btn ${cls}" type="submit" name="_action" value="${value}">${esc(label)}</button>`).join("")}</div>
  </form>`;
  return layout(session, { title: `${existing ? "Edit" : "New"} ${def.singular}`, active: name, body, flash: formFlash });
}

function settingsPage(session, { record, errors = {}, flash } = {}) {
  const r = record || store.settings();
  const errCount = Object.keys(errors).length;
  const body = `<h1>Site settings</h1>
  <p class="muted">Brand, biography and portrait. Contact numbers and social links are managed in <a href="/admin/contacts">Contacts &amp; social</a>, so that each one can be verified separately.</p>
  <form method="post" class="admin-form" novalidate>
    <input type="hidden" name="_csrf" value="${esc(session.csrf)}">
    <div class="form-grid">${settingsFields.map((f) => fieldInput(f, r[f.name], errors[f.name])).join("")}</div>
    <div class="admin-actions"><button class="btn" type="submit">Save settings</button></div>
  </form>`;
  return layout(session, { title: "Site settings", active: "settings", body, flash: errCount ? { kind: "bad", html: `Not saved. Fix the ${errCount} highlighted field${errCount > 1 ? "s" : ""}.` } : flash });
}

function enquiriesPage(session, flash) {
  if (!config.enquiry.store) {
    return layout(session, { title: "Enquiries", active: "enquiries", body: `<h1>Enquiries</h1>
    <p>Enquiries are not stored on this server${config.enquiryDestinations().length ? `; they are delivered by ${esc(config.enquiryDestinations().join(" and "))}` : " and no destination is configured, so the public form is disabled"}.</p>
    <p class="muted">Set <code>ENQUIRY_STORE=file</code> to also keep a copy here.</p>` });
  }
  const list = store.listEnquiries();
  const { TYPES, ROLES } = require("./enquiry");
  const body = `<h1>Enquiries</h1>
  <p class="muted">Personal data. Reply, then delete enquiries you no longer need, and always delete on request.</p>
  ${list.length ? list.map((e) => `<article class="enquiry-item">
    <header><strong>${esc(TYPES[e.type] || e.type)}</strong>${e.level ? ` · ${esc(e.level)}` : ""} <span class="muted small">· ${esc(new Date(e.receivedAt).toLocaleString("en-GB"))} · ref ${esc(e.id.slice(0, 8))}</span></header>
    <dl class="facts facts--stack">
      ${[["Name", e.name], ["Role", ROLES[e.role]], ["Delivery", e.mode], ["Workshop", e.workshop], ["Phone", e.phone], ["Email", e.email], ["Page", e.page]].filter(([, v]) => v).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}
    </dl>
    ${e.message ? `<p class="enquiry-item__msg">${esc(e.message)}</p>` : ""}
    <form method="post" action="/admin/enquiries/delete" data-confirm="Delete this enquiry permanently?"><input type="hidden" name="_csrf" value="${esc(session.csrf)}"><input type="hidden" name="id" value="${esc(e.id)}"><button class="btn btn--ghost btn--small" type="submit">Delete</button></form>
  </article>`).join("") : `<div class="empty"><p>No enquiries stored.</p></div>`}`;
  return layout(session, { title: "Enquiries", active: "enquiries", body, flash });
}

module.exports = { notConfigured, loginPage, dashboard, listPage, editPage, settingsPage, enquiriesPage, previewHref };
