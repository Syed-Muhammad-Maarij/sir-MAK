// Admin authentication: one editor account configured by environment variables.
// Passwords are verified against a scrypt hash; sessions are HMAC-signed, HttpOnly, SameSite=Strict
// cookies carrying a per-session CSRF token. Every admin route checks the session on the server.
const crypto = require("crypto");
const config = require("./config");

const COOKIE = "mak_admin";

function hashPassword(password, { N = 16384, r = 8, p = 1 } = {}) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

function verifyPassword(password, stored) {
  const parts = String(stored).split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, N, r, p, salt, hash] = parts;
  const expected = Buffer.from(hash, "base64");
  const actual = crypto.scryptSync(String(password), Buffer.from(salt, "base64"), expected.length, { N: +N, r: +r, p: +p });
  return crypto.timingSafeEqual(actual, expected);
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const sign = (data) => crypto.createHmac("sha256", config.admin.sessionSecret).update(data).digest("base64url");

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function cookieHeader(value, maxAge) {
  return [
    `${COOKIE}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAge}`,
    config.admin.secureCookie ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

function createSession(username) {
  const payload = {
    u: username,
    exp: Date.now() + config.admin.sessionHours * 3600 * 1000,
    csrf: crypto.randomBytes(18).toString("base64url"),
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { cookie: cookieHeader(`${data}.${sign(data)}`, config.admin.sessionHours * 3600), session: payload };
}

const clearSessionCookie = () => cookieHeader("", 0);

// Returns the session payload, or null. Never trusts anything that fails the signature check.
function getSession(req) {
  if (!config.adminConfigured()) return null;
  const raw = parseCookies(req)[COOKIE];
  if (!raw || !raw.includes(".")) return null;
  const [data, mac] = raw.split(".");
  if (!safeEqual(mac, sign(data))) return null;
  try {
    const s = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    if (s.u !== config.admin.username || !(s.exp > Date.now())) return null;
    return s;
  } catch {
    return null;
  }
}

function checkCredentials(username, password) {
  if (!config.adminConfigured()) return false;
  const userOk = safeEqual(username, config.admin.username);
  const passOk = verifyPassword(password, config.admin.passwordHash); // always run, to keep timing even
  return userOk && passOk;
}

// Simple fixed-window limiter keyed by IP (or any string). In-memory: fine for one server process.
function rateLimiter({ limit, windowMs }) {
  const hits = new Map();
  return {
    hit(key) {
      const now = Date.now();
      const entry = hits.get(key);
      if (!entry || entry.reset < now) { hits.set(key, { count: 1, reset: now + windowMs }); return true; }
      entry.count++;
      return entry.count <= limit;
    },
    blocked(key) {
      const e = hits.get(key);
      return Boolean(e && e.reset > Date.now() && e.count >= limit);
    },
    clear(key) { hits.delete(key); },
  };
}

module.exports = {
  hashPassword, verifyPassword, createSession, clearSessionCookie, getSession, checkCredentials,
  rateLimiter, safeEqual, parseCookies,
};
