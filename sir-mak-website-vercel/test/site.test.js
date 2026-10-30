// End-to-end tests. Each suite starts a real server process on a free port with its own copy of
// content/ and an empty data directory, then drives it over HTTP.  Run: npm test
const { test, describe, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { hashPassword } = require("../lib/auth");

const ROOT = path.join(__dirname, "..");
const SECRET = "test-secret-".padEnd(48, "x");
const PASSWORD = "correct horse battery staple";

const freePort = () => new Promise((resolve) => {
  const srv = net.createServer().listen(0, () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
});

async function startServer(extraEnv) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "mak-test-"));
  fs.cpSync(path.join(ROOT, "content"), path.join(dir, "content"), { recursive: true });
  const port = await freePort();
  const env = {
    PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, SKIP_DOTENV: "1",
    PORT: String(port), SITE_URL: "https://sirmak.test", CONTENT_DIR: path.join(dir, "content"), DATA_DIR: path.join(dir, "data"),
    ...extraEnv,
  };
  const child = spawn(process.execPath, [path.join(ROOT, "server.js")], { env, stdio: ["ignore", "pipe", "pipe"] });
  let stderr = "";
  child.stderr.on("data", (d) => { stderr += d; });
  await new Promise((resolve, reject) => {
    child.stdout.on("data", (d) => { if (String(d).includes("running at")) resolve(); });
    child.on("exit", (code) => reject(new Error(`server exited ${code}: ${stderr}`)));
  });
  const base = `http://localhost:${port}`;
  return { base, dir, child, stop: () => { child.kill(); fs.rmSync(dir, { recursive: true, force: true }); } };
}

const PUBLIC_ROUTES = [
  "/", "/learn", "/learn/o-level-igcse", "/learn/as-level", "/learn/a2-level", "/learn/full-a-level", "/learn/topics",
  "/learn/topics/igcse-8-programming", "/videos", "/tools", "/code-pad", "/classes-workshops", "/about", "/contact", "/privacy", "/terms", "/accessibility",
];
// Unverified planning data that must never reach a public visitor.
const UNVERIFIED = ["1111827", "ali.khan.313371", "linkedin.com", "UCvndBoTRYy3", "NED University", "Cedar College", "SOT Live", "North Nazimabad"];

const formToken = (ageMs) => {
  const t = String(Date.now() - ageMs);
  return `${t}.${crypto.createHmac("sha256", SECRET).update(t).digest("base64url").slice(0, 22)}`;
};

/* ======================================================================= */
describe("unconfigured server (no admin, no enquiry destination)", () => {
  let s;
  before(async () => { s = await startServer({}); });
  after(() => s.stop());

  test("every public route loads directly with one h1, a title, description and canonical URL", async () => {
    for (const route of PUBLIC_ROUTES) {
      const res = await fetch(s.base + route);
      assert.equal(res.status, 200, route);
      const html = await res.text();
      assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `one h1 on ${route}`);
      assert.match(html, /<title>[^<]+<\/title>/, route);
      assert.match(html, /<meta name="description" content="[^"]{20,}"/, route);
      assert.ok(html.includes(`<link rel="canonical" href="https://sirmak.test${route}">`), `canonical on ${route}`);
      assert.match(res.headers.get("content-security-policy"), /default-src 'self'/);
    }
  });

  test("unknown routes return a helpful 404; trailing slashes and old URLs redirect", async () => {
    const res = await fetch(`${s.base}/no-such-page`);
    assert.equal(res.status, 404);
    assert.match(await res.text(), /That page isn't here/);
    const slash = await fetch(`${s.base}/about/`, { redirect: "manual" });
    assert.equal(slash.status, 301);
    assert.equal(slash.headers.get("location"), "/about");
    const old = await fetch(`${s.base}/learn/o-level/`, { redirect: "manual" });
    assert.equal(old.status, 301);
    assert.equal(old.headers.get("location"), "/learn/o-level-igcse");
  });

  test("no unverified contact details, credentials or schedules are published", async () => {
    for (const route of PUBLIC_ROUTES) {
      const html = await (await fetch(s.base + route)).text();
      for (const needle of UNVERIFIED) assert.ok(!html.includes(needle), `${needle} leaked on ${route}`);
      assert.ok(!html.includes("Editor note"), `editor note visible to public on ${route}`);
    }
  });

  test("draft lessons are not public and the video library shows an empty state", async () => {
    assert.equal((await fetch(`${s.base}/videos/ol-binary`)).status, 404);
    const html = await (await fetch(`${s.base}/videos`)).text();
    assert.match(html, /video library is being prepared/);
    assert.match(await (await fetch(`${s.base}/`)).text(), /MAKCS video lessons are being added/);
  });

  test("preview mode is ignored without an editor session", async () => {
    const html = await (await fetch(`${s.base}/videos?preview=1`)).text();
    assert.ok(!html.includes("Binary, denary"));
  });

  test("topic library filters on the server, with an empty state", async () => {
    const as = await (await fetch(`${s.base}/learn/topics?level=as-level`)).text();
    assert.match(as, /12 of 30 topics shown/);
    const paper = await (await fetch(`${s.base}/learn/topics?level=o-level-igcse&paper=Paper+2`)).text();
    assert.match(paper, /4 of 30 topics shown/);
    const search = await (await fetch(`${s.base}/learn/topics?q=recursion`)).text();
    assert.match(search, /1 of 30 topics shown/);
    const none = await (await fetch(`${s.base}/learn/topics?q=zzzz`)).text();
    assert.match(none, /0 of 30 topics shown/);
    assert.match(none, /<div class="empty" data-empty>/);
    const type = await (await fetch(`${s.base}/learn/topics?type=Notes`)).text();
    assert.match(type, /0 of 30 topics shown/);
  });

  test("sitemap lists public pages only; robots blocks admin", async () => {
    const xml = await (await fetch(`${s.base}/sitemap.xml`)).text();
    for (const route of PUBLIC_ROUTES) assert.ok(xml.includes(`<loc>https://sirmak.test${route}</loc>`), route);
    assert.ok(!xml.includes("/videos/ol-binary"));
    assert.ok(!xml.includes("/admin"));
    const robots = await (await fetch(`${s.base}/robots.txt`)).text();
    assert.match(robots, /Disallow: \/admin/);
    assert.match(robots, /Sitemap: https:\/\/sirmak.test\/sitemap.xml/);
  });

  test("enquiry form is disabled and the API reports that setup is required", async () => {
    const html = await (await fetch(`${s.base}/contact`)).text();
    assert.match(html, /Online enquiries are not open yet/);
    assert.match(html, /<fieldset class="form-grid" disabled>/);
    const res = await fetch(`${s.base}/api/enquiry`, {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json", Origin: s.base },
      body: JSON.stringify({ type: "general", name: "Test", role: "student", phone: "03001234567", message: "Hello there", consent: "on", formToken: formToken(5000) }),
    });
    assert.equal(res.status, 503);
    assert.deepEqual(await res.json(), { ok: false, error: "setup_required" });
  });

  test("admin is switched off when not configured", async () => {
    for (const p of ["/admin", "/admin/login", "/admin/videos"]) {
      const res = await fetch(s.base + p, { redirect: "manual" });
      assert.equal(res.status, 503, p);
      assert.match(await res.text(), /Admin is not set up yet/);
    }
  });
});

/* ======================================================================= */
describe("on Vercel (read-only disk)", () => {
  let s;
  before(async () => { s = await startServer({ VERCEL: "1", SITE_URL: "", VERCEL_PROJECT_PRODUCTION_URL: "sirmak.vercel.test", ENQUIRY_STORE: "file" }); });
  after(() => s.stop());

  test("pages work, canonical links use the Vercel address, and the code pad is isolated", async () => {
    const res = await fetch(`${s.base}/code-pad`);
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("cross-origin-embedder-policy"), "credentialless");
    assert.ok((await res.text()).includes('href="https://sirmak.vercel.test/code-pad"'));
  });

  test("admin explains it is unavailable, and enquiries are not offered a file destination", async () => {
    const res = await fetch(`${s.base}/admin/login`, { redirect: "manual" });
    assert.equal(res.status, 503);
    assert.match(await res.text(), /not available on this host/);
    assert.match(await (await fetch(`${s.base}/contact`)).text(), /<fieldset class="form-grid" disabled>/);
  });
});

/* ======================================================================= */
describe("configured server (admin + file enquiry store)", () => {
  let s;
  let cookie = "";
  let csrf = "";
  const json = (body, headers = {}) => ({
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", Origin: s.base, ...headers },
    body: JSON.stringify(body),
  });
  const valid = (extra = {}) => ({
    type: "class", name: "Ayesha", role: "parent", level: "as-level", mode: "online", phone: "0300-1234567",
    consent: "on", formToken: formToken(5000), ...extra,
  });
  const adminGet = (p) => fetch(s.base + p, { headers: { Cookie: cookie }, redirect: "manual" });
  const adminPost = (p, fields, { withCsrf = true, origin = true } = {}) =>
    fetch(s.base + p, {
      method: "POST",
      redirect: "manual",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Cookie: cookie, ...(origin ? { Origin: s.base } : {}) },
      body: new URLSearchParams({ ...(withCsrf ? { _csrf: csrf } : {}), ...fields }).toString(),
    });

  before(async () => {
    s = await startServer({
      ADMIN_USERNAME: "editor", ADMIN_PASSWORD_HASH: hashPassword(PASSWORD), SESSION_SECRET: SECRET,
      ENQUIRY_STORE: "file", ENQUIRY_RATE_LIMIT: "8", COOKIE_SECURE: "false",
    });
  });
  after(() => s.stop());

  const stored = () => {
    const f = path.join(s.dir, "data", "enquiries.jsonl");
    return fs.existsSync(f) ? fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map(JSON.parse) : [];
  };

  test("enquiry form is open when a destination is configured", async () => {
    const html = await (await fetch(`${s.base}/contact?type=workshop&level=a2-level`)).text();
    assert.ok(!html.includes("Online enquiries are not open yet"));
    assert.match(html, /<option value="workshop" selected>/);
    assert.match(html, /<option value="a2-level" selected>/);
  });

  test("enquiry: cross-site posts are refused", async () => {
    const res = await fetch(`${s.base}/api/enquiry`, json(valid(), { Origin: "https://evil.example" }));
    assert.equal(res.status, 403);
  });

  test("enquiry: validation errors are returned per field and nothing is stored", async () => {
    const res = await fetch(`${s.base}/api/enquiry`, json({ type: "class", phone: "12", email: "nope", formToken: formToken(5000) }));
    assert.equal(res.status, 422);
    const body = await res.json();
    for (const f of ["name", "role", "level", "phone", "email", "consent"]) assert.ok(body.errors[f], f);
    assert.equal(stored().length, 0);
  });

  test("enquiry: honeypot and too-fast submissions are rejected", async () => {
    assert.equal((await fetch(`${s.base}/api/enquiry`, json(valid({ website: "spam.example" })))).status, 400);
    const fast = await fetch(`${s.base}/api/enquiry`, json(valid({ formToken: formToken(0) })));
    assert.equal(fast.status, 400);
    assert.equal((await fast.json()).error, "token");
    const forged = await fetch(`${s.base}/api/enquiry`, json(valid({ formToken: `${Date.now() - 9000}.forged` })));
    assert.equal(forged.status, 400);
    assert.equal(stored().length, 0);
  });

  test("enquiry: a valid submission is accepted and stored; a duplicate is not stored twice", async () => {
    const submissionId = crypto.randomUUID();
    const [a, b] = await Promise.all([
      fetch(`${s.base}/api/enquiry`, json(valid({ submissionId }))),
      fetch(`${s.base}/api/enquiry`, json(valid({ submissionId }))),
    ]);
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    const ra = await a.json();
    const rb = await b.json();
    assert.equal(ra.ok, true);
    assert.equal(ra.reference, rb.reference);
    const rows = stored();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].name, "Ayesha");
    assert.equal(rows[0].level, "as-level");
  });

  test("enquiry: works without JavaScript (form post renders a result page)", async () => {
    const res = await fetch(`${s.base}/api/enquiry`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: s.base },
      body: new URLSearchParams({ type: "correction", page: "/learn/topics", message: "Typo in topic 3", consent: "on", formToken: formToken(5000) }).toString(),
    });
    assert.equal(res.status, 200);
    assert.match(await res.text(), /your enquiry has been received/);
    const bad = await fetch(`${s.base}/api/enquiry`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: s.base },
      body: new URLSearchParams({ type: "general", formToken: formToken(5000) }).toString(),
    });
    assert.equal(bad.status, 422);
    assert.match(await bad.text(), /Please check the highlighted fields/);
    assert.equal(stored().length, 2);
  });

  test("enquiry: rate limit applies per connection", async () => {
    let last;
    for (let i = 0; i < 3; i++) last = await fetch(`${s.base}/api/enquiry`, json(valid({ submissionId: crypto.randomUUID() })));
    assert.equal(last.status, 429);
  });

  test("admin: unauthenticated requests are redirected or refused", async () => {
    const page = await fetch(`${s.base}/admin/videos`, { redirect: "manual" });
    assert.equal(page.status, 303);
    assert.equal(page.headers.get("location"), "/admin/login");
    const post = await fetch(`${s.base}/admin/videos/new`, { method: "POST", redirect: "manual", headers: { Origin: s.base } });
    assert.equal(post.status, 401);
    const forged = await fetch(`${s.base}/admin`, { redirect: "manual", headers: { Cookie: "mak_admin=eyJ1IjoiZWRpdG9yIn0.forged" } });
    assert.equal(forged.status, 303);
  });

  test("admin: wrong password is refused; correct password sets a secure session cookie", async () => {
    const bad = await fetch(`${s.base}/admin/login`, {
      method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: s.base },
      body: "username=editor&password=wrong",
    });
    assert.equal(bad.status, 401);
    const good = await fetch(`${s.base}/admin/login`, {
      method: "POST", redirect: "manual", headers: { "Content-Type": "application/x-www-form-urlencoded", Origin: s.base },
      body: new URLSearchParams({ username: "editor", password: PASSWORD }).toString(),
    });
    assert.equal(good.status, 303);
    const setCookie = good.headers.get("set-cookie");
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Strict/);
    cookie = setCookie.split(";")[0];
    const dash = await adminGet("/admin");
    assert.equal(dash.status, 200);
    const html = await dash.text();
    assert.match(html, /Launch checklist/);
    csrf = html.match(/name="_csrf" value="([^"]+)"/)[1];
  });

  test("admin: posts without a CSRF token or from another origin are refused", async () => {
    assert.equal((await adminPost("/admin/faqs/new", { question: "Q?", answer: "A", group: "general", _action: "draft" }, { withCsrf: false })).status, 403);
    assert.equal((await adminPost("/admin/faqs/new", { question: "Q?", answer: "A", group: "general", _action: "draft" }, { origin: false })).status, 403);
  });

  test("admin: a video cannot be published without a valid YouTube ID", async () => {
    const res = await adminPost("/admin/videos/new", { title: "Arrays", level: "o-level-igcse", youtubeId: "not-an-id", _action: "published" });
    assert.equal(res.status, 422);
    assert.match(await res.text(), /Add a valid YouTube video ID before publishing/);
  });

  test("admin: publish, preview, unpublish and archive a video", async () => {
    const create = await adminPost("/admin/videos/new", {
      title: "Test lesson on arrays", level: "o-level-igcse", topic: "igcse-8-programming", paper: "Paper 2",
      youtubeId: "https://www.youtube.com/watch?v=dQw4w9WgXcQ", duration: "12:30", featured: "on", _action: "published",
    });
    assert.equal(create.status, 303);
    const editUrl = create.headers.get("location").split("?")[0];
    assert.equal(editUrl, "/admin/videos/test-lesson-on-arrays");

    const page = await fetch(`${s.base}/videos/test-lesson-on-arrays`);
    assert.equal(page.status, 200);
    const pageHtml = await page.text();
    assert.match(pageHtml, /data-video-id="dQw4w9WgXcQ"/);
    assert.match(await (await fetch(`${s.base}/videos`)).text(), /Test lesson on arrays/);
    assert.match(await (await fetch(`${s.base}/`)).text(), /Test lesson on arrays/);
    assert.match(await (await fetch(`${s.base}/learn/topics/igcse-8-programming`)).text(), /Test lesson on arrays/);
    assert.match(await (await fetch(`${s.base}/learn/topics?type=Video+lesson`)).text(), /1 of 30 topics shown/);
    assert.match(await (await fetch(`${s.base}/sitemap.xml`)).text(), /\/videos\/test-lesson-on-arrays/);

    const unpublish = await adminPost(editUrl, { title: "Test lesson on arrays", level: "o-level-igcse", youtubeId: "dQw4w9WgXcQ", _action: "draft" });
    assert.equal(unpublish.status, 303);
    assert.equal((await fetch(`${s.base}/videos/test-lesson-on-arrays`)).status, 404);
    const preview = await adminGet("/videos/test-lesson-on-arrays?preview=1");
    assert.equal(preview.status, 200);
    assert.match(await preview.text(), /status--draft/);

    const archive = await adminPost(editUrl, { title: "Test lesson on arrays", level: "o-level-igcse", youtubeId: "dQw4w9WgXcQ", _action: "archived" });
    assert.equal(archive.status, 303);
    assert.equal((await adminGet("/videos/test-lesson-on-arrays?preview=1")).status, 404);
    assert.ok(fs.readdirSync(path.join(s.dir, "data", "backups")).some((f) => f.startsWith("videos-")), "backup written");
  });

  test("admin: testimonials need recorded consent, classes need a confirmation date", async () => {
    const t1 = await adminPost("/admin/testimonials/new", { quote: "Clear explanations.", attribution: "AS student", _action: "published" });
    assert.equal(t1.status, 422);
    const t2 = await adminPost("/admin/testimonials/new", { quote: "Clear explanations.", attribution: "AS student", consentRecorded: "on", _action: "published" });
    assert.equal(t2.status, 303);
    assert.match(await (await fetch(`${s.base}/`)).text(), /Clear explanations\./);

    const c1 = await adminPost("/admin/classes/new", { title: "AS evening class", level: "as-level", mode: "Online", availability: "open", _action: "published" });
    assert.equal(c1.status, 422);
    const c2 = await adminPost("/admin/classes/new", { title: "AS evening class", level: "as-level", mode: "Online", availability: "open", days: "Monday", lastConfirmed: "2026-10-29", _action: "published" });
    assert.equal(c2.status, 303);
    const classes = await (await fetch(`${s.base}/classes-workshops`)).text();
    assert.match(classes, /AS evening class/);
    assert.match(classes, /Details last confirmed 29 October 2026/);
  });

  test("admin: publishing a verified contact shows it; settings change the site", async () => {
    const wa = await adminGet("/admin/contacts/whatsapp-enquiries");
    assert.equal(wa.status, 200);
    const pub = await adminPost("/admin/contacts/whatsapp-enquiries", { label: "WhatsApp enquiries", kind: "whatsapp", value: "923001234567", display: "0300-1234567", _action: "published" });
    assert.equal(pub.status, 303);
    assert.match(await (await fetch(`${s.base}/contact`)).text(), /wa\.me\/923001234567/);

    const settings = await adminPost("/admin/settings", { brand: "Sir MAK CS", fullName: "Sir Muhammad Ali Khan", bio: "Approved bio paragraph.", bioApproved: "on" });
    assert.equal(settings.status, 303);
    const about = await (await fetch(`${s.base}/about`)).text();
    assert.match(about, /Approved bio paragraph\./);
    assert.match(about, /\| Sir MAK CS Computer Science<\/title>/);
  });

  test("admin: editor notes show only to the signed-in editor", async () => {
    assert.match(await (await adminGet("/videos")).text(), /Editor note/);
    assert.ok(!(await (await fetch(`${s.base}/videos`)).text()).includes("Editor note"));
  });

  test("admin: stored enquiries can be read and deleted", async () => {
    const page = await (await adminGet("/admin/enquiries")).text();
    assert.match(page, /Ayesha/);
    const id = stored()[0].id;
    const del = await adminPost("/admin/enquiries/delete", { id });
    assert.equal(del.status, 303);
    assert.ok(!stored().some((e) => e.id === id));
  });

  test("admin: sign out clears the session", async () => {
    const out = await adminPost("/admin/logout", {});
    assert.equal(out.status, 303);
    assert.match(out.headers.get("set-cookie"), /Max-Age=0/);
  });
});
