// Content model. Each collection is one JSON file in content/. The admin forms, server-side
// validation and the publish rules are all generated from these definitions.
//
// Field types: text, textarea, url, date, number, checkbox, select, lines (array of strings, one per line).
// `options` may be an array or a function of the store (for options that depend on other content).

const LEVEL_OPTIONS = (store) => store.list("courses").map((c) => [c.slug, c.title]);
const TOPIC_OPTIONS = (store) =>
  store
    .list("topics")
    .sort(byLevelThenNumber(store))
    .map((t) => [t.id, `${courseShort(store, t.level)} · ${t.number ? t.number + ". " : ""}${t.title}`]);
const PAPER_OPTIONS = ["Paper 1", "Paper 2", "Paper 3", "Paper 4"];
const AVAILABILITY = [
  ["open", "Open for registration"],
  ["waitlist", "Wait-list only"],
  ["full", "Full"],
  ["closed", "Registration closed"],
  ["cancelled", "Cancelled"],
];
const RESOURCE_TYPES = ["Notes", "Worksheet", "Practice questions", "Slides", "Code sample", "Diagram"];

function courseShort(store, slug) {
  const c = store.list("courses").find((x) => x.slug === slug);
  return c ? c.short || c.title : slug;
}
function byLevelThenNumber(store) {
  const order = Object.fromEntries(store.list("courses").map((c) => [c.slug, Number(c.order) || 0]));
  return (a, b) => (order[a.level] ?? 99) - (order[b.level] ?? 99) || (Number(a.number) || 0) - (Number(b.number) || 0);
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

const collections = {
  courses: {
    label: "Courses",
    singular: "course",
    titleField: "title",
    idField: "slug",
    publicPath: (r) => `/learn/${r.slug}`,
    help: "The four learning routes. Topics, videos and resources point at a course by its slug.",
    fields: [
      { name: "slug", label: "URL slug", type: "text", required: true, pattern: /^[a-z0-9-]+$/, hint: "Lowercase letters, numbers and hyphens. Changing it changes the page address." },
      { name: "title", label: "Title", type: "text", required: true },
      { name: "short", label: "Short name", type: "text", hint: "Used in tags and buttons, e.g. \"AS\"." },
      { name: "order", label: "Display order", type: "number" },
      { name: "codes", label: "Syllabus code(s)", type: "text", hint: "e.g. 9618. Shown on the course page." },
      { name: "edition", label: "Syllabus edition / exam years", type: "text", hint: "Leave blank until Sir MAK confirms it; the row is hidden while blank." },
      { name: "audience", label: "Who it is for", type: "textarea" },
      { name: "summary", label: "Summary", type: "textarea", required: true },
      { name: "papers", label: "Papers / components", type: "lines", hint: "One per line: Paper 1 | Computer Systems" },
      { name: "combines", label: "Combines courses", type: "lines", hint: "Slugs of the courses this route combines (Full A Level only)." },
      { name: "lastReviewed", label: "Last reviewed", type: "date" },
    ],
  },

  topics: {
    label: "Topics",
    singular: "topic",
    titleField: "title",
    publicPath: (r) => `/learn/topics/${r.id}`,
    help: "The topic library. Each topic appears on its course page and in the topic library, with any videos and resources tagged to it.",
    fields: [
      { name: "title", label: "Topic title", type: "text", required: true },
      { name: "level", label: "Course", type: "select", required: true, options: LEVEL_OPTIONS },
      { name: "number", label: "Syllabus topic number", type: "number" },
      { name: "section", label: "Syllabus section reference", type: "text", hint: "Only once confirmed against the current syllabus." },
      { name: "paper", label: "Paper / component", type: "select", options: PAPER_OPTIONS },
      { name: "description", label: "Short description", type: "textarea", required: true },
      { name: "keywords", label: "Keywords", type: "text", hint: "Comma-separated. Used by the library search." },
      { name: "lastReviewed", label: "Last reviewed", type: "date" },
    ],
  },

  videos: {
    label: "Videos",
    singular: "video",
    titleField: "title",
    publicPath: (r) => `/videos/${r.id}`,
    help: "MAKCS lessons. A video can only be published with a valid YouTube video ID.",
    fields: [
      { name: "title", label: "Title", type: "text", required: true, hint: "Use the title exactly as it appears on YouTube." },
      { name: "youtubeId", label: "YouTube video ID or URL", type: "text", hint: "Paste the video URL or the 11-character ID." },
      { name: "description", label: "Description", type: "textarea" },
      { name: "level", label: "Course", type: "select", required: true, options: LEVEL_OPTIONS },
      { name: "topic", label: "Topic", type: "select", options: TOPIC_OPTIONS },
      { name: "paper", label: "Paper / component", type: "select", options: PAPER_OPTIONS },
      { name: "duration", label: "Duration", type: "text", hint: "e.g. 18:42. Leave blank if unknown.", pattern: /^(\d{1,2}:)?\d{1,2}:\d{2}$/ },
      { name: "language", label: "Language", type: "text", hint: "e.g. English, Urdu and English" },
      { name: "publishedOn", label: "YouTube publication date", type: "date" },
      { name: "captions", label: "Captions available on YouTube", type: "checkbox" },
      { name: "featured", label: "Feature on the homepage", type: "checkbox" },
    ],
    publishRules: [
      (r) => (YOUTUBE_ID.test(r.youtubeId || "") ? "" : "Add a valid YouTube video ID before publishing."),
    ],
  },

  resources: {
    label: "Resources",
    singular: "resource",
    titleField: "title",
    help: "Notes, worksheets and other downloads. Host the file (for example in public/files/ or a shared drive) and paste its link.",
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "type", label: "Resource type", type: "select", required: true, options: RESOURCE_TYPES },
      { name: "level", label: "Course", type: "select", required: true, options: LEVEL_OPTIONS },
      { name: "topic", label: "Topic", type: "select", options: TOPIC_OPTIONS },
      { name: "paper", label: "Paper / component", type: "select", options: PAPER_OPTIONS },
      { name: "url", label: "File or page link", type: "url", required: true, hint: "A link starting with https:// or a site path such as /files/arrays-notes.pdf" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "rightsConfirmed", label: "Sir MAK owns or is licensed to publish this resource", type: "checkbox" },
      { name: "lastReviewed", label: "Last reviewed", type: "date" },
    ],
    publishRules: [(r) => (r.rightsConfirmed ? "" : "Confirm publishing rights before publishing.")],
  },

  classes: {
    label: "Classes",
    singular: "class",
    titleField: "title",
    help: "Regular classes. Publish only confirmed details, and update \"last confirmed\" whenever you check them.",
    fields: [
      { name: "title", label: "Class name", type: "text", required: true },
      { name: "level", label: "Course", type: "select", required: true, options: LEVEL_OPTIONS },
      { name: "mode", label: "Delivery", type: "select", required: true, options: ["Online", "In person", "Online and in person"] },
      { name: "days", label: "Days", type: "text" },
      { name: "time", label: "Session times (Pakistan time)", type: "text" },
      { name: "dateRange", label: "Date range", type: "text", hint: "e.g. 3 January – 30 April 2027" },
      { name: "venue", label: "Venue or joining instructions", type: "textarea" },
      { name: "fee", label: "Fee", type: "text" },
      { name: "conditions", label: "Fee conditions / terms", type: "textarea" },
      { name: "capacity", label: "Capacity", type: "number" },
      { name: "availability", label: "Availability", type: "select", required: true, options: AVAILABILITY },
      { name: "registrationUrl", label: "Registration link", type: "url", hint: "Optional. Without it, the class links to the enquiry form." },
      { name: "lastConfirmed", label: "Last confirmed", type: "date" },
    ],
    publishRules: [(r) => (r.lastConfirmed ? "" : "Set the date these details were last confirmed before publishing.")],
  },

  workshops: {
    label: "Workshops",
    singular: "workshop",
    titleField: "title",
    help: "One-off or short-course workshops such as Paper 2 revision.",
    fields: [
      { name: "title", label: "Workshop name", type: "text", required: true },
      { name: "level", label: "Course", type: "select", required: true, options: LEVEL_OPTIONS },
      { name: "topics", label: "Topics covered", type: "lines", hint: "One per line." },
      { name: "mode", label: "Delivery", type: "select", options: ["Online", "In person", "Online and in person"] },
      { name: "startDate", label: "Start date", type: "date" },
      { name: "sessionTimes", label: "Session times (Pakistan time)", type: "text" },
      { name: "venue", label: "Venue or joining instructions", type: "textarea" },
      { name: "fee", label: "Fee", type: "text" },
      { name: "conditions", label: "Fee conditions / terms", type: "textarea" },
      { name: "capacity", label: "Capacity", type: "number" },
      { name: "availability", label: "Availability", type: "select", required: true, options: AVAILABILITY },
      { name: "registrationUrl", label: "Registration link", type: "url" },
      { name: "lastConfirmed", label: "Last confirmed", type: "date" },
    ],
    publishRules: [(r) => (r.lastConfirmed ? "" : "Set the date these details were last confirmed before publishing.")],
  },

  faqs: {
    label: "FAQs",
    singular: "FAQ",
    titleField: "question",
    help: "Answers about schedules, fees, recordings or registration must reflect confirmed arrangements.",
    fields: [
      { name: "question", label: "Question", type: "text", required: true },
      { name: "answer", label: "Answer", type: "textarea", required: true },
      { name: "group", label: "Shown on", type: "select", required: true, options: [["general", "Home and level pages"], ["classes", "Classes page"], ["learning", "Learning pages"]] },
      { name: "order", label: "Order", type: "number" },
    ],
  },

  testimonials: {
    label: "Testimonials",
    singular: "testimonial",
    titleField: "attribution",
    help: "Genuine student feedback only, with recorded consent. The section is hidden while none are published.",
    fields: [
      { name: "quote", label: "Feedback (as given)", type: "textarea", required: true },
      { name: "attribution", label: "Attribution", type: "text", required: true, hint: "As the student agreed, e.g. \"A2 student, 2026\"." },
      { name: "level", label: "Course", type: "select", options: LEVEL_OPTIONS },
      { name: "consentRecorded", label: "Written consent to publish is on file (parent/guardian if under 18)", type: "checkbox" },
    ],
    publishRules: [(r) => (r.consentRecorded ? "" : "Record consent before publishing a testimonial.")],
  },

  announcements: {
    label: "Announcements",
    singular: "announcement",
    titleField: "text",
    help: "A one-line notice at the top of the homepage. Only one is shown: the newest published one within its dates.",
    fields: [
      { name: "text", label: "Announcement", type: "text", required: true },
      { name: "link", label: "Link", type: "url" },
      { name: "linkLabel", label: "Link text", type: "text" },
      { name: "startDate", label: "Show from", type: "date" },
      { name: "endDate", label: "Show until", type: "date" },
    ],
  },

  contacts: {
    label: "Contacts & social",
    singular: "contact",
    titleField: "label",
    help: "Phone, WhatsApp, email, YouTube and social links. Publishing a record means the owner has verified it. Unpublished records never appear on the site.",
    fields: [
      { name: "label", label: "Label", type: "text", required: true },
      { name: "kind", label: "Kind", type: "select", required: true, options: [["whatsapp", "WhatsApp"], ["phone", "Phone"], ["email", "Email"], ["youtube", "YouTube channel"], ["social", "Social profile"], ["address", "Address"]] },
      { name: "value", label: "Number, address or URL", type: "text", required: true, hint: "WhatsApp/phone in international format, e.g. 923001234567." },
      { name: "display", label: "Display text", type: "text", hint: "e.g. 0300-1234567. Defaults to the value." },
      { name: "note", label: "Internal note", type: "textarea", hint: "Not shown publicly." },
    ],
    publishRules: [
      (r) => (r.kind === "whatsapp" || r.kind === "phone" ? (/^\d{10,15}$/.test(r.value) ? "" : "Use digits only in international format, e.g. 923001234567.") : ""),
      (r) => (r.kind === "youtube" || r.kind === "social" ? (/^https:\/\//.test(r.value) ? "" : "Use a full https:// link.") : ""),
    ],
  },

  credentials: {
    label: "Profile details",
    singular: "profile detail",
    titleField: "text",
    help: "Qualifications, teaching associations and experience for the About page. Publish only what Sir MAK has approved.",
    fields: [
      { name: "kind", label: "Kind", type: "select", required: true, options: [["education", "Education"], ["teaching", "Teaching association"], ["experience", "Experience"]] },
      { name: "text", label: "Text", type: "text", required: true },
      { name: "order", label: "Order", type: "number" },
    ],
  },
};

// Singleton settings document (content/settings.json), edited on its own admin page.
const settingsFields = [
  { name: "brand", label: "Brand name", type: "text", required: true },
  { name: "fullName", label: "Teacher's full name", type: "text", required: true },
  { name: "logoUrl", label: "Approved logo image URL", type: "text", hint: "Leave blank to use the typographic wordmark." },
  { name: "portraitUrl", label: "Approved portrait image URL", type: "text", hint: "Leave blank to show the portrait placeholder." },
  { name: "portraitAlt", label: "Portrait alt text", type: "text" },
  { name: "bio", label: "Biography", type: "textarea", hint: "One paragraph per line." },
  { name: "bioApproved", label: "Sir MAK has approved this biography for publication", type: "checkbox" },
  { name: "city", label: "City", type: "text" },
  { name: "copyrightName", label: "Copyright holder", type: "text" },
  { name: "copyrightYear", label: "Copyright year", type: "text", hint: "Leave blank to use the current year." },
  { name: "timetableNote", label: "Timetable note", type: "textarea", hint: "Shown above the class list." },
  { name: "previewBanner", label: "Site-wide notice banner", type: "text", hint: "Leave blank to hide." },
  { name: "homeVideo", label: "Homepage video (YouTube URL or ID)", type: "text", youtube: true, pattern: YOUTUBE_ID, hint: "Shown in the video box on the homepage. Leave blank to show the latest published lesson instead." },
  { name: "homeVideoTitle", label: "Homepage video title", type: "text", hint: "The video's exact title on YouTube." },
  { name: "homeVideoText", label: "Homepage video description", type: "textarea", hint: "A sentence or two beside the video. Optional." },
];

module.exports = { collections, settingsFields, YOUTUBE_ID, RESOURCE_TYPES, AVAILABILITY, byLevelThenNumber };
