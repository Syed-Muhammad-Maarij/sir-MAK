// Enquiry handling: validation (shared rules with the browser), spam checks, duplicate protection
// and delivery to whichever destinations are configured. A submission counts as accepted only when
// at least one destination confirms receipt; otherwise the visitor is told it was not sent.
const crypto = require("crypto");
const config = require("./config");
const store = require("./store");

const TYPES = {
  class: "Classes",
  workshop: "A workshop",
  general: "A general question",
  correction: "Reporting a mistake on the site",
};
const ROLES = { student: "Student", parent: "Parent or guardian", other: "Other" };
const MODES = { online: "Online", "in-person": "In person", either: "Either" };

const tokenSecret = config.admin.sessionSecret || crypto.randomBytes(32).toString("hex");
const MIN_FILL_MS = 3000;
const MAX_TOKEN_AGE_MS = 24 * 3600 * 1000;

// A signed timestamp rendered into the form. Bots that post instantly, or replay old tokens, fail.
function formToken(now = Date.now()) {
  const t = String(now);
  return `${t}.${crypto.createHmac("sha256", tokenSecret).update(t).digest("base64url").slice(0, 22)}`;
}
function tokenProblem(token, now = Date.now()) {
  const [t, mac] = String(token || "").split(".");
  const expected = crypto.createHmac("sha256", tokenSecret).update(String(t)).digest("base64url").slice(0, 22);
  if (!t || mac !== expected) return "The form has expired. Please reload the page and try again.";
  const age = now - Number(t);
  if (age < MIN_FILL_MS) return "That was very fast. Please check your details and send again.";
  if (age > MAX_TOKEN_AGE_MS) return "The form has expired. Please reload the page and try again.";
  return "";
}

function validate(input, { levels, workshops }) {
  const v = (k) => String(input[k] ?? "").trim();
  const data = {
    type: v("type"),
    name: v("name"),
    role: v("role"),
    level: v("level"),
    mode: v("mode"),
    workshop: v("workshop"),
    phone: v("phone"),
    email: v("email"),
    page: v("page"),
    message: v("message"),
    consent: input.consent === true || input.consent === "on" || input.consent === "true",
  };
  const errors = {};
  const isCorrection = data.type === "correction";
  if (!TYPES[data.type]) errors.type = "Choose what your enquiry is about.";
  if (!isCorrection) {
    if (data.name.length < 2 || data.name.length > 80) errors.name = "Enter the student's name.";
    if (!ROLES[data.role]) errors.role = "Tell us whether you are a student or a parent.";
  }
  if ((data.type === "class" || data.type === "workshop") && !levels.includes(data.level)) errors.level = "Choose a level.";
  if (data.level && !levels.includes(data.level)) errors.level = "Choose a level.";
  if (data.mode && !MODES[data.mode]) errors.mode = "Choose how you would like to attend.";
  if (data.workshop && !workshops.includes(data.workshop)) errors.workshop = "Choose a workshop from the list.";
  const phoneDigits = data.phone.replace(/[\s()-]/g, "");
  if (data.phone && !/^\+?\d{10,15}$/.test(phoneDigits)) errors.phone = "Enter a phone number such as 0300-1234567.";
  if (data.email && (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email) || data.email.length > 120)) errors.email = "Check the email address.";
  if (!isCorrection && !data.phone && !data.email && !errors.phone && !errors.email) errors.phone = "Give a phone number or an email address so we can reply.";
  if ((data.type === "general" || isCorrection) && data.message.length < 5) errors.message = isCorrection ? "Tell us what looks wrong." : "Write your question.";
  if (data.message.length > 1000) errors.message = "Keep the message under 1,000 characters.";
  if (data.page.length > 200) errors.page = "Keep the page address under 200 characters.";
  if (!data.consent) errors.consent = "Please agree so we can reply to you.";
  return { data, errors };
}

function summary(e, labels) {
  return [
    `Enquiry type: ${TYPES[e.type]}`,
    e.name && `Name: ${e.name}`,
    e.role && `Role: ${ROLES[e.role]}`,
    e.level && `Level: ${labels.level || e.level}`,
    e.mode && `Preferred delivery: ${MODES[e.mode]}`,
    e.workshop && `Workshop: ${labels.workshop || e.workshop}`,
    e.phone && `Phone: ${e.phone}`,
    e.email && `Email: ${e.email}`,
    e.page && `Page: ${e.page}`,
    e.message && `\nMessage:\n${e.message}`,
    `\nReceived: ${e.receivedAt}`,
  ].filter(Boolean).join("\n");
}

async function postJson(url, body, headers = {}) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
}

async function deliver(entry, labels) {
  const delivered = [];
  const failed = [];
  const attempt = async (name, fn) => {
    try { await fn(); delivered.push(name); } catch (err) { failed.push(name); console.error(`[enquiry] ${name} delivery failed:`, err.message); }
  };
  const destinations = config.enquiryDestinations();
  if (destinations.includes("file")) await attempt("file", async () => store.appendEnquiry(entry));
  if (destinations.includes("webhook")) await attempt("webhook", () => postJson(config.enquiry.webhookUrl, { ...entry, summary: summary(entry, labels) }));
  if (destinations.includes("email")) {
    await attempt("email", () =>
      postJson(
        "https://api.resend.com/emails",
        {
          from: config.enquiry.emailFrom,
          to: config.enquiry.emailTo.split(",").map((s) => s.trim()),
          subject: `Website enquiry: ${TYPES[entry.type]}${entry.level ? ` (${labels.level || entry.level})` : ""}`,
          text: summary(entry, labels),
          ...(entry.email ? { reply_to: entry.email } : {}),
        },
        { Authorization: `Bearer ${config.enquiry.resendKey}` }
      )
    );
  }
  return { delivered, failed };
}

// Remembers recent submission IDs so a double click or a retried request is not delivered twice.
const recent = new Map();
function remember(id, result) {
  recent.set(id, { result, at: Date.now() });
  for (const [k, v] of recent) if (v.at < Date.now() - MAX_TOKEN_AGE_MS) recent.delete(k);
}

const inflight = new Map();

async function handle(input, ctx) {
  if (!config.enquiryDestinations().length) return { status: 503, body: { ok: false, error: "setup_required" } };
  if (String(input.website || "").trim()) return { status: 400, body: { ok: false, error: "rejected" } };
  const submissionId = String(input.submissionId || "").slice(0, 64);
  if (!submissionId) return processEnquiry(input, ctx, "");
  if (recent.has(submissionId)) return recent.get(submissionId).result;
  if (inflight.has(submissionId)) return inflight.get(submissionId);
  const pending = processEnquiry(input, ctx, submissionId);
  inflight.set(submissionId, pending);
  try { return await pending; } finally { inflight.delete(submissionId); }
}

async function processEnquiry(input, ctx, submissionId) {
  const { data, errors } = validate(input, ctx);
  if (Object.keys(errors).length) return { status: 422, body: { ok: false, errors } };
  const tokenErr = tokenProblem(input.formToken);
  if (tokenErr) return { status: 400, body: { ok: false, error: "token", message: tokenErr } };

  const entry = { id: crypto.randomUUID(), receivedAt: new Date().toISOString(), ...data };
  const { delivered } = await deliver(entry, ctx.labels(entry));
  const result = delivered.length
    ? { status: 200, body: { ok: true, reference: entry.id.slice(0, 8) } }
    : { status: 502, body: { ok: false, error: "delivery_failed" } };
  if (submissionId && delivered.length) remember(submissionId, result);
  return result;
}

module.exports = { TYPES, ROLES, MODES, formToken, tokenProblem, validate, handle };
