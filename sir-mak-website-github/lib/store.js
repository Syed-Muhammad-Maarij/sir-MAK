// JSON content store. Collections live in content/<name>.json and are held in memory.
// Writes are validated, written atomically (temp file + rename) and the previous version of the
// file is copied to data/backups/ first, so every edit can be rolled back by hand.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("./config");
const { collections, settingsFields, YOUTUBE_ID } = require("./schema");

const STATUSES = ["draft", "published", "archived"];
const MAX_BACKUPS = 50;

const cache = {};
const file = (name) => path.join(config.contentDir, `${name}.json`);

function load(name) {
  if (!cache[name]) {
    const f = file(name);
    cache[name] = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : name === "settings" ? {} : [];
  }
  return cache[name];
}

function backup(name) {
  const src = file(name);
  if (!fs.existsSync(src)) return;
  const dir = path.join(config.dataDir, "backups");
  fs.mkdirSync(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  fs.copyFileSync(src, path.join(dir, `${name}-${stamp}.json`));
  const old = fs.readdirSync(dir).filter((f) => f.startsWith(`${name}-`)).sort();
  old.slice(0, Math.max(0, old.length - MAX_BACKUPS)).forEach((f) => fs.rmSync(path.join(dir, f)));
}

function persist(name, data) {
  backup(name);
  fs.mkdirSync(config.contentDir, { recursive: true });
  const tmp = `${file(name)}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n");
  fs.renameSync(tmp, file(name));
  cache[name] = data;
}

const slugify = (s) =>
  String(s).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 60) || "item";

function youtubeIdFrom(input) {
  const v = String(input || "").trim();
  if (YOUTUBE_ID.test(v)) return v;
  const m = v.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : v;
}

/* ---------- reads ---------- */
function list(name, { includeDrafts = false, includeArchived = false } = {}) {
  return load(name).filter(
    (r) => r.status === "published" || (includeDrafts && r.status === "draft") || (includeArchived && r.status === "archived")
  );
}
const all = (name) => load(name).slice();
const idOf = (name, r) => r[collections[name].idField || "id"];
const get = (name, id) => load(name).find((r) => idOf(name, r) === id) || null;
const settings = () => load("settings");

/* ---------- validation ---------- */
function coerce(field, raw) {
  const v = raw === undefined || raw === null ? "" : raw;
  switch (field.type) {
    case "checkbox": return v === true || v === "on" || v === "true";
    case "number": return String(v).trim() === "" ? null : Number(v);
    case "lines": return (Array.isArray(v) ? v : String(v).split(/\r?\n/)).map((s) => String(s).trim()).filter(Boolean);
    default: return String(v).replace(/\r\n/g, "\n").trim();
  }
}

function validateFields(fields, input, store) {
  const values = {};
  const errors = {};
  for (const f of fields) {
    let v = coerce(f, input[f.name]);
    if (f.name === "youtubeId" || f.youtube) v = youtubeIdFrom(v);
    values[f.name] = v;
    const empty = v === "" || v === null || (Array.isArray(v) && !v.length);
    if (f.required && empty) { errors[f.name] = `${f.label} is required.`; continue; }
    if (empty) continue;
    if (f.type === "text" && v.length > 300) errors[f.name] = `${f.label} is too long (300 characters at most).`;
    if (f.type === "textarea" && v.length > 5000) errors[f.name] = `${f.label} is too long (5,000 characters at most).`;
    if (f.type === "number" && !Number.isFinite(v)) errors[f.name] = `${f.label} must be a number.`;
    if (f.type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) errors[f.name] = `${f.label} must be a date.`;
    if (f.type === "url" && !/^(https:\/\/[^\s]+|\/[^\s]*)$/.test(v)) errors[f.name] = `${f.label} must start with https:// or /.`;
    if (f.pattern && !f.pattern.test(v)) errors[f.name] = `${f.label} is not in the expected format.`;
    if (f.type === "select" && f.options) {
      const opts = (typeof f.options === "function" ? f.options(store) : f.options).map((o) => (Array.isArray(o) ? o[0] : o));
      if (!opts.includes(v)) errors[f.name] = `Choose a valid ${f.label.toLowerCase()}.`;
    }
  }
  return { values, errors };
}

/* ---------- writes ---------- */
// Creates or updates a record. `status` is the requested status after saving.
// Returns { ok, record, errors }.
function save(name, id, input, status) {
  const def = collections[name];
  if (!def) throw new Error(`Unknown collection ${name}`);
  if (!STATUSES.includes(status)) return { ok: false, errors: { _form: "Unknown status." } };
  const rows = all(name);
  const existing = id ? rows.find((r) => idOf(name, r) === id) : null;
  if (id && !existing) return { ok: false, errors: { _form: "That record no longer exists." } };

  const { values, errors } = validateFields(def.fields, input, module.exports);
  if (def.idField) {
    const clash = rows.find((r) => r[def.idField] === values[def.idField] && r !== existing);
    if (clash) errors[def.idField] = "Another record already uses this value.";
  }
  if (status === "published" && !Object.keys(errors).length) {
    const problems = (def.publishRules || []).map((rule) => rule(values)).filter(Boolean);
    if (problems.length) errors._form = problems.join(" ");
  }
  if (Object.keys(errors).length) return { ok: false, errors, record: { ...existing, ...values, status } };

  const now = new Date().toISOString();
  let record;
  if (existing) {
    record = { ...existing, ...values, status, updatedAt: now };
    rows[rows.indexOf(existing)] = record;
  } else {
    record = { ...values, status, createdAt: now, updatedAt: now };
    if (!def.idField) {
      const base = slugify(values[def.titleField]);
      let candidate = base;
      while (rows.some((r) => r.id === candidate)) candidate = `${base}-${crypto.randomBytes(2).toString("hex")}`;
      record = { id: candidate, ...record };
    }
    rows.push(record);
  }
  persist(name, rows);
  return { ok: true, record };
}

// Changes status only (publish / unpublish / archive), still enforcing the publish rules.
function setStatus(name, id, status) {
  const existing = get(name, id);
  if (!existing) return { ok: false, errors: { _form: "That record no longer exists." } };
  return save(name, id, existing, status);
}

function saveSettings(input) {
  const { values, errors } = validateFields(settingsFields, input, module.exports);
  if (Object.keys(errors).length) return { ok: false, errors, record: values };
  const record = { ...settings(), ...values, updatedAt: new Date().toISOString() };
  persist("settings", record);
  return { ok: true, record };
}

/* ---------- enquiries (personal data: kept out of content/, in data/) ---------- */
const enquiryFile = () => path.join(config.dataDir, "enquiries.jsonl");

function appendEnquiry(entry) {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.appendFileSync(enquiryFile(), JSON.stringify(entry) + "\n", { mode: 0o600 });
}
function listEnquiries() {
  if (!fs.existsSync(enquiryFile())) return [];
  return fs.readFileSync(enquiryFile(), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)).reverse();
}
function deleteEnquiry(id) {
  const keep = listEnquiries().reverse().filter((e) => e.id !== id);
  const tmp = `${enquiryFile()}.tmp`;
  fs.writeFileSync(tmp, keep.map((e) => JSON.stringify(e) + "\n").join(""), { mode: 0o600 });
  fs.renameSync(tmp, enquiryFile());
}

module.exports = {
  STATUSES, list, all, get, idOf, settings, save, setStatus, saveSettings, slugify, youtubeIdFrom,
  appendEnquiry, listEnquiries, deleteEnquiry,
};
