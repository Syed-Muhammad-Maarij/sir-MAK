// Sir MAK Computer Science website: a small, dependency-free Node server.
// Renders the public pages from content/, serves /public, handles enquiries and the admin CMS.
// Usage: node server.js   (settings come from environment variables or a .env file; see README.md)
const fs = require("fs");
const path = require("path");
const http = require("http");

const envFile = path.join(__dirname, ".env");
if (fs.existsSync(envFile) && !process.env.SKIP_DOTENV) process.loadEnvFile(envFile);

const config = require("./lib/config");
const store = require("./lib/store");
const auth = require("./lib/auth");
const enquiry = require("./lib/enquiry");
const pages = require("./lib/pages");
const admin = require("./lib/admin");
const { collections } = require("./lib/schema");

const MAX_BODY = 64 * 1024;
const loginLimiter = auth.rateLimiter({ limit: 5, windowMs: 15 * 60 * 1000 });
const enquiryLimiter = auth.rateLimiter({ limit: Number(process.env.ENQUIRY_RATE_LIMIT) || 5, windowMs: 10 * 60 * 1000 });

const TYPES = {
  ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".avif": "image/avif",
  ".pdf": "application/pdf", ".txt": "text/plain; charset=utf-8", ".ico": "image/x-icon", ".woff2": "font/woff2",
};

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' https://i.ytimg.com data:",
  "frame-src https://www.youtube-nocookie.com",
  "connect-src 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

// The code pad runs Python (Pyodide, from jsDelivr) inside a worker. Only that worker may load
// it, and the page and worker are cross-origin isolated so input() can wait for the terminal.
const ISOLATED = { "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "credentialless" };
const PYODIDE_CDN = "https://cdn.jsdelivr.net";
const WORKER_HEADERS = {
  ...ISOLATED,
  "Cross-Origin-Resource-Policy": "same-origin",
  "Content-Security-Policy": `default-src 'none'; script-src 'self' ${PYODIDE_CDN} 'wasm-unsafe-eval'; connect-src ${PYODIDE_CDN}`,
};

// Old static-site addresses and common variants, kept working with permanent redirects.
const REDIRECTS = {
  "/classes": "/classes-workshops",
  "/learn/o-level": "/learn/o-level-igcse",
  "/learn/igcse": "/learn/o-level-igcse",
  "/learn/a-level": "/learn/full-a-level",
  "/index.html": "/",
};

/* ---------- helpers ---------- */
function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": CSP,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
    "X-Frame-Options": "DENY",
    ...(config.siteUrl.startsWith("https://") ? { "Strict-Transport-Security": "max-age=31536000" } : {}),
    ...headers,
  });
  res.end(body);
}
const sendJson = (res, status, obj, headers = {}) => send(res, status, JSON.stringify(obj), { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
const redirect = (res, location, status = 303, headers = {}) => send(res, status, "", { Location: location, ...headers });

function clientIp(req) {
  if ((process.env.TRUST_PROXY === "true" || config.readOnly) && req.headers["x-forwarded-for"]) return String(req.headers["x-forwarded-for"]).split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(Object.assign(new Error("Body too large"), { status: 413 })); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      const type = req.headers["content-type"] || "";
      try {
        if (type.includes("application/json")) resolve(JSON.parse(raw || "{}"));
        else resolve(Object.fromEntries(new URLSearchParams(raw)));
      } catch {
        reject(Object.assign(new Error("Bad body"), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

// Blocks cross-site form posts: the Origin (or Referer) must be this site.
function sameOrigin(req) {
  let origin = req.headers.origin || "";
  if (!origin && req.headers.referer) {
    try { origin = new URL(req.headers.referer).origin; } catch { return false; }
  }
  if (!origin) return false;
  const host = req.headers.host;
  return origin === `http://${host}` || origin === `https://${host}` || origin === config.siteUrl;
}

function serveStatic(req, res, urlPath) {
  const file = path.normalize(path.join(config.publicDir, urlPath));
  if (!file.startsWith(config.publicDir + path.sep)) return false;
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return false;
  const versioned = /[?&]v=/.test(req.url);
  send(res, 200, fs.readFileSync(file), {
    "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream",
    "Cache-Control": versioned ? "public, max-age=31536000, immutable" : "public, max-age=300",
    ...(urlPath === "/assets/codepad-worker.js" ? WORKER_HEADERS : {}),
  });
  return true;
}

function enquiryContext() {
  const courses = store.list("courses");
  const workshops = store.list("workshops");
  return {
    levels: courses.map((c) => c.slug),
    workshops: workshops.map((w) => w.id),
    labels: (e) => ({
      level: courses.find((c) => c.slug === e.level)?.title,
      workshop: workshops.find((w) => w.id === e.workshop)?.title,
    }),
  };
}

/* ---------- public routes ---------- */
function publicRoute(ctx, p) {
  if (p === "/") return pages.home(ctx);
  if (p === "/learn") return pages.learnIndex(ctx);
  if (p === "/learn/topics") return pages.topicsLibrary(ctx);
  let m;
  if ((m = p.match(/^\/learn\/topics\/([a-z0-9-]+)$/))) return pages.topicPage(ctx, m[1]);
  if ((m = p.match(/^\/learn\/([a-z0-9-]+)$/))) return pages.levelPage(ctx, m[1]);
  if (p === "/videos") return pages.videosPage(ctx);
  if ((m = p.match(/^\/videos\/([a-z0-9-]+)$/))) return pages.videoPage(ctx, m[1]);
  if (p === "/tools") return pages.toolsPage(ctx);
  if (p === "/code-pad") return { ...pages.codePadPage(ctx), headers: ISOLATED };
  if (p === "/classes-workshops") return pages.classesPage(ctx);
  if (p === "/about") return pages.aboutPage(ctx);
  if (p === "/contact") return pages.contactPage(ctx);
  if (p === "/privacy") return pages.privacyPage(ctx);
  if (p === "/terms") return pages.termsPage(ctx);
  if (p === "/accessibility") return pages.accessibilityPage(ctx);
  return null;
}

async function handleEnquiry(req, res, ctx) {
  const wantsJson = (req.headers.accept || "").includes("application/json");
  if (!sameOrigin(req)) return wantsJson ? sendJson(res, 403, { ok: false, error: "forbidden" }) : send(res, 403, "Forbidden");
  const ip = clientIp(req);
  if (!enquiryLimiter.hit(ip)) {
    return wantsJson ? sendJson(res, 429, { ok: false, error: "rate_limited" })
      : (({ status, html }) => send(res, status, html))(pages.enquiryProblem(ctx, 429, "Too many enquiries", "Please wait a few minutes before sending another enquiry."));
  }
  const input = await readBody(req);
  const result = await enquiry.handle(input, enquiryContext());
  if (wantsJson) return sendJson(res, result.status, result.body);

  // No-JavaScript fallback: re-render the form with errors, or show a result page.
  const b = result.body;
  let page;
  if (b.ok) page = pages.enquirySent(ctx, b.reference);
  else if (b.errors) page = pages.contactPage(ctx, { prefill: { ...input, consent: input.consent === "on" }, errors: b.errors });
  else if (b.error === "setup_required") page = pages.enquiryProblem(ctx, 503, "Online enquiries are not open yet", "Nothing was sent. Please use the contact details on the contact page instead.");
  else if (b.error === "token") page = pages.enquiryProblem(ctx, 400, "Please try again", b.message);
  else page = pages.enquiryProblem(ctx, result.status, "Your enquiry could not be sent", "Nothing was delivered. Please try again in a few minutes.");
  send(res, page.status, page.html, { "Cache-Control": "no-store" });
}

/* ---------- admin routes ---------- */
async function adminRoute(req, res, url, session) {
  const p = url.pathname.replace(/\/+$/, "") || "/admin";
  const html = (body, status = 200) => send(res, status, body, { "Cache-Control": "no-store" });

  if (config.readOnly) return html(admin.readOnlyHost(), 503);
  if (!config.adminConfigured()) return html(admin.notConfigured(), 503);

  if (p === "/admin/login") {
    if (req.method === "GET") return session ? redirect(res, "/admin") : html(admin.loginPage());
    if (req.method !== "POST") return html("Method not allowed", 405);
    if (!sameOrigin(req)) return html("Forbidden", 403);
    const ip = clientIp(req);
    if (loginLimiter.blocked(ip)) return html(admin.loginPage({ error: "Too many attempts. Try again in 15 minutes." }), 429);
    const body = await readBody(req);
    if (auth.checkCredentials(String(body.username || ""), String(body.password || ""))) {
      loginLimiter.clear(ip);
      const { cookie } = auth.createSession(config.admin.username);
      return redirect(res, "/admin", 303, { "Set-Cookie": cookie });
    }
    loginLimiter.hit(ip);
    return html(admin.loginPage({ error: "That username and password don't match.", username: body.username }), 401);
  }

  // Everything below requires a valid session.
  if (!session) return req.method === "GET" ? redirect(res, "/admin/login") : html("Unauthorised", 401);

  let body = {};
  if (req.method === "POST") {
    if (!sameOrigin(req)) return html("Forbidden", 403);
    body = await readBody(req);
    if (!auth.safeEqual(body._csrf || "", session.csrf)) return html("Your session token was missing or out of date. Go back, reload the page and try again.", 403);
  } else if (req.method !== "GET") {
    return html("Method not allowed", 405);
  }

  if (p === "/admin/logout" && req.method === "POST") return redirect(res, "/", 303, { "Set-Cookie": auth.clearSessionCookie() });
  if (p === "/admin") return html(admin.dashboard(session));

  if (p === "/admin/settings") {
    if (req.method === "GET") return html(admin.settingsPage(session, { flash: url.searchParams.has("saved") ? { kind: "ok", html: "Settings saved." } : null }));
    const result = store.saveSettings(body);
    return result.ok ? redirect(res, "/admin/settings?saved=1") : html(admin.settingsPage(session, result), 422);
  }

  if (p === "/admin/enquiries") return html(admin.enquiriesPage(session, url.searchParams.has("deleted") ? { kind: "ok", html: "Enquiry deleted." } : null));
  if (p === "/admin/enquiries/delete" && req.method === "POST") {
    store.deleteEnquiry(String(body.id || ""));
    return redirect(res, "/admin/enquiries?deleted=1");
  }

  const m = p.match(/^\/admin\/([a-z]+)(?:\/([^/]+))?$/);
  if (m && collections[m[1]]) {
    const name = m[1];
    const id = m[2] && m[2] !== "new" ? decodeURIComponent(m[2]) : null;
    if (!m[2]) return req.method === "GET" ? html(admin.listPage(session, name, url)) : html("Method not allowed", 405);
    if (req.method === "GET") {
      const saved = url.searchParams.get("saved");
      const page = admin.editPage(session, name, id, { flash: saved ? { kind: "ok", html: `Saved${saved === "published" ? " and published" : saved === "archived" ? " and archived" : " as draft"}.` } : null });
      return page ? html(page) : html(pages.notFound({ url, preview: false }).html, 404);
    }
    const action = String(body._action || "draft");
    const result = store.save(name, id, body, action);
    if (!result.ok) {
      const page = admin.editPage(session, name, id, { record: result.record || body, errors: result.errors });
      return page ? html(page, 422) : html("Not found", 404);
    }
    return redirect(res, `/admin/${name}/${encodeURIComponent(store.idOf(name, result.record))}?saved=${result.record.status}`);
  }
  return html(pages.notFound({ url, preview: false }).html, 404);
}

/* ---------- server ---------- */
async function handler(req, res) {
  const url = new URL(req.url, "http://localhost");
  let p;
  try { p = decodeURIComponent(url.pathname); } catch { return send(res, 400, "Bad request"); }
  const session = auth.getSession(req);
  const ctx = { req, url, admin: session, preview: Boolean(session && url.searchParams.get("preview") === "1") };

  try {
    if (p.startsWith("/admin")) return await adminRoute(req, res, url, session);
    if (p === "/api/enquiry") {
      if (req.method !== "POST") return sendJson(res, 405, { ok: false, error: "method_not_allowed" }, { Allow: "POST" });
      return await handleEnquiry(req, res, ctx);
    }
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed", { Allow: "GET, HEAD" });

    if (p === "/healthz") return sendJson(res, 200, { ok: true });
    if (p === "/robots.txt") return send(res, 200, pages.robots(), { "Content-Type": "text/plain; charset=utf-8" });
    if (p === "/sitemap.xml") return send(res, 200, pages.sitemap(), { "Content-Type": "application/xml; charset=utf-8" });
    if (p.startsWith("/assets/") || p.startsWith("/files/") || p === "/favicon.ico") {
      if (serveStatic(req, res, p === "/favicon.ico" ? "/assets/favicon.svg" : p)) return;
      return send(res, 404, "Not found", { "Content-Type": "text/plain" });
    }

    // Canonical URLs have no trailing slash.
    const trimmed = p.length > 1 ? p.replace(/\/+$/, "") : p;
    if (REDIRECTS[trimmed]) return redirect(res, REDIRECTS[trimmed] + url.search, 301);
    if (trimmed !== p) return redirect(res, trimmed + url.search, 301);

    const page = publicRoute(ctx, p) || pages.notFound(ctx);
    // Pages show live content, so let browsers revalidate; never cache an editor's view.
    send(res, page.status, req.method === "HEAD" ? "" : page.html, { "Cache-Control": session ? "private, no-store" : "public, max-age=0, must-revalidate", ...page.headers });
  } catch (err) {
    if (err.status) return send(res, err.status, err.message);
    console.error(err);
    send(res, 500, "<!doctype html><title>Server error</title><h1>Something went wrong</h1><p>Please try again in a moment.</p>");
  }
}

if (require.main === module) {
  http.createServer(handler).listen(config.port, () => {
    console.log(`Sir MAK site running at http://localhost:${config.port}`);
    console.log(`Admin: ${config.adminConfigured() ? "enabled" : "disabled (set ADMIN_USERNAME, ADMIN_PASSWORD_HASH, SESSION_SECRET)"}`);
    console.log(`Enquiries: ${config.enquiryDestinations().join(", ") || "no destination configured (form disabled)"}`);
  });
}

module.exports = { handler };
