// Runtime configuration. Everything secret or deployment-specific comes from environment variables
// (or a local .env file, loaded by server.js). Nothing here is ever sent to the browser.
const path = require("path");

const ROOT = path.join(__dirname, "..");
const env = process.env;

const port = Number(env.PORT) || 4173;
const siteUrl = (env.SITE_URL || `http://localhost:${port}`).replace(/\/+$/, "");

module.exports = {
  ROOT,
  port,
  siteUrl,
  production: env.NODE_ENV === "production",
  contentDir: path.resolve(ROOT, env.CONTENT_DIR || "content"),
  dataDir: path.resolve(ROOT, env.DATA_DIR || "data"),
  publicDir: path.join(ROOT, "public"),

  admin: {
    username: env.ADMIN_USERNAME || "",
    passwordHash: env.ADMIN_PASSWORD_HASH || "",
    sessionSecret: env.SESSION_SECRET || "",
    secureCookie: env.COOKIE_SECURE ? env.COOKIE_SECURE === "true" : siteUrl.startsWith("https://"),
    sessionHours: Number(env.SESSION_HOURS) || 8,
  },

  enquiry: {
    // Each destination is optional. A submission is accepted only when at least one configured
    // destination confirms it received the enquiry.
    store: env.ENQUIRY_STORE === "file",
    webhookUrl: env.ENQUIRY_WEBHOOK_URL || "",
    resendKey: env.RESEND_API_KEY || "",
    emailTo: env.ENQUIRY_EMAIL_TO || "",
    emailFrom: env.ENQUIRY_EMAIL_FROM || "",
  },
};

module.exports.adminConfigured = () => {
  const a = module.exports.admin;
  return Boolean(a.username && a.passwordHash.startsWith("scrypt$") && a.sessionSecret.length >= 32);
};

module.exports.enquiryDestinations = () => {
  const e = module.exports.enquiry;
  const list = [];
  if (e.store) list.push("file");
  if (e.webhookUrl) list.push("webhook");
  if (e.resendKey && e.emailTo && e.emailFrom) list.push("email");
  return list;
};
