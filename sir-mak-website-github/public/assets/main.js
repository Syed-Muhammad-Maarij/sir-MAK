// Sir MAK — progressive enhancements. Every page works without this file: filters fall back to
// a normal GET form, the enquiry form posts normally, and videos link to YouTube.
document.documentElement.classList.replace("no-js", "js");

/* ---------- Mobile navigation ---------- */
(function nav() {
  const toggle = document.querySelector(".nav-toggle");
  const menu = document.getElementById("site-nav");
  if (!toggle || !menu) return;
  const setOpen = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    menu.classList.toggle("is-open", open);
  };
  toggle.addEventListener("click", () => setOpen(toggle.getAttribute("aria-expanded") !== "true"));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && toggle.getAttribute("aria-expanded") === "true") {
      setOpen(false);
      toggle.focus();
    }
  });
})();

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

/* ---------- Header gains a rule once the page scrolls ---------- */
(function header() {
  const el = document.querySelector(".site-header");
  if (!el) return;
  const update = () => el.classList.toggle("is-scrolled", window.scrollY > 8);
  window.addEventListener("scroll", update, { passive: true });
  update();
})();

/* ---------- Theme switch: navy-black by default, light on request (theme.js applies it before paint) ---------- */
(function themeSwitch() {
  const btn = document.querySelector("[data-theme-switch]");
  if (!btn) return;
  const root = document.documentElement;
  const meta = document.querySelector('meta[name="theme-color"]');
  const sync = () => {
    const dark = root.dataset.theme !== "light";
    btn.setAttribute("aria-checked", String(dark));
    if (meta) meta.content = dark ? "#060b14" : "#f7f5ef";
  };
  btn.hidden = false;
  sync();
  btn.addEventListener("click", () => {
    const light = root.dataset.theme !== "light";
    root.dataset.theme = light ? "light" : "dark";
    try { localStorage.setItem("theme", light ? "light" : "dark"); } catch { /* not saved; still switches */ }
    sync();
    document.dispatchEvent(new CustomEvent("themechange"));
  });
})();

/* ---------- Background: drifting CS symbols over a slowly moving network graph ----------
   Decorative only. Pauses when the tab is hidden, and draws a single still frame when the
   device asks for reduced motion. */
(function csBackground() {
  const canvas = document.querySelector("[data-cs-bg]");
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext("2d");
  const GLYPHS = ["01", "10110", "{ }", "</>", "0xFF", "i++", "←", "≠", "AND", "OR", "NOT", "XOR", "FOR", "IF", "[ ]", "SELECT", "TRUE", "0x3A", "//", "&&", "1011", "f(x)", "MOD", "DIV", "NULL"];
  const LINK = 150; // px: nodes closer than this are joined
  let w = 0, h = 0, dpr = 1, inks = [], alpha = 0.2, glyphs = [], nodes = [], pulses = [], frame = 0, last = 0, nextPulse = 0;

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (list) => list[Math.floor(Math.random() * list.length)];
  function readTheme() {
    const cs = getComputedStyle(document.documentElement);
    inks = ["--bg-ink-1", "--bg-ink-2", "--bg-ink-3"].map((v) => cs.getPropertyValue(v).trim() || "124, 155, 255");
    alpha = parseFloat(cs.getPropertyValue("--bg-alpha")) || 0.2;
  }
  const makeGlyph = (y) => ({ x: rand(0, w), y: y ?? rand(0, h), text: pick(GLYPHS), size: rand(11, 19), vy: rand(6, 16), sway: rand(0, Math.PI * 2), ink: Math.floor(rand(0, 3)), a: rand(0.45, 1) });
  const makeNode = () => ({ x: rand(0, w), y: rand(0, h), vx: rand(-9, 9), vy: rand(-9, 9), r: rand(1.6, 3.2), ink: Math.floor(rand(0, 3)) });

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const area = w * h;
    const nGlyphs = Math.max(10, Math.min(38, Math.round(area / 40000)));
    const nNodes = Math.max(8, Math.min(30, Math.round(area / 48000)));
    while (glyphs.length < nGlyphs) glyphs.push(makeGlyph());
    glyphs.length = nGlyphs;
    while (nodes.length < nNodes) nodes.push(makeNode());
    nodes.length = nNodes;
    pulses = [];
  }

  function draw(dt) {
    ctx.clearRect(0, 0, w, h);
    // Edges between nearby nodes
    ctx.lineWidth = 1;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > LINK) continue;
        ctx.strokeStyle = `rgba(${inks[a.ink]}, ${(alpha * 0.9 * (1 - d / LINK)).toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
    }
    for (const n of nodes) {
      ctx.fillStyle = `rgba(${inks[n.ink]}, ${(alpha * 2).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2); ctx.fill();
    }
    // Data packets travelling along edges
    for (const p of pulses) {
      const x = p.a.x + (p.b.x - p.a.x) * p.t, y = p.a.y + (p.b.y - p.a.y) * p.t;
      ctx.fillStyle = `rgba(${inks[1]}, ${Math.min(1, alpha * 4).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(x, y, 2.4, 0, Math.PI * 2); ctx.fill();
    }
    // Symbols
    ctx.textBaseline = "middle";
    for (const g of glyphs) {
      ctx.font = `500 ${g.size}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.fillStyle = `rgba(${inks[g.ink]}, ${(alpha * g.a).toFixed(3)})`;
      ctx.fillText(g.text, g.x + Math.sin(g.sway) * 6, g.y);
    }
    if (!dt) return;
    // Move everything for the next frame
    for (const g of glyphs) {
      g.y -= g.vy * dt;
      g.sway += dt * 0.6;
      if (g.y < -24) Object.assign(g, makeGlyph(h + 24));
    }
    for (const n of nodes) {
      n.x += n.vx * dt; n.y += n.vy * dt;
      if (n.x < -20) n.x = w + 20; else if (n.x > w + 20) n.x = -20;
      if (n.y < -20) n.y = h + 20; else if (n.y > h + 20) n.y = -20;
    }
    pulses = pulses.filter((p) => (p.t += dt * 0.9) < 1 && Math.hypot(p.a.x - p.b.x, p.a.y - p.b.y) < LINK * 1.2);
    nextPulse -= dt;
    if (nextPulse <= 0 && pulses.length < 4) {
      nextPulse = rand(0.6, 1.6);
      const a = pick(nodes);
      const near = nodes.filter((b) => b !== a && Math.hypot(a.x - b.x, a.y - b.y) < LINK * 0.85);
      if (near.length) pulses.push({ a, b: pick(near), t: 0 });
    }
  }

  function loop(now) {
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    draw(dt);
    frame = requestAnimationFrame(loop);
  }
  const start = () => { if (!frame && !reduceMotion.matches && !document.hidden) { last = 0; frame = requestAnimationFrame(loop); } };
  const stop = () => { cancelAnimationFrame(frame); frame = 0; };

  readTheme();
  resize();
  draw(0);
  let resizeTimer = 0;
  window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { resize(); draw(0); }, 150); });
  document.addEventListener("themechange", () => { readTheme(); draw(0); });
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  reduceMotion.addEventListener?.("change", () => (reduceMotion.matches ? (stop(), draw(0)) : start()));
  start();
})();

/* ---------- Scroll reveals ----------
   Only content that starts below the fold is hidden, and only here in JS, so nothing on the
   first screen waits and the page reads normally if this script never runs. Each element
   reveals once. Items inside [data-reveal-group] stagger slightly. */
(function reveals() {
  if (reduceMotion.matches || !("IntersectionObserver" in window)) return;
  const STAGGER = 60;
  const DURATION = 520;
  const targets = [];
  document.querySelectorAll("[data-reveal]").forEach((el) => targets.push([el, 0]));
  document.querySelectorAll("[data-reveal-group]").forEach((group) => [...group.children].forEach((el, i) => targets.push([el, Math.min(i, 5) * STAGGER])));
  const fold = window.innerHeight * 0.92;
  const pending = new Set();
  function reveal(el) {
    if (!pending.delete(el)) return;
    observer.unobserve(el);
    const delay = Number(el.dataset.revealDelay || 0);
    el.style.setProperty("--reveal-delay", `${delay}ms`);
    el.classList.add("reveal-in");
    el.classList.remove("reveal-pending");
    // Hand transitions back to the element's own hover styles once the reveal is done.
    setTimeout(() => { el.classList.remove("reveal-in"); el.style.removeProperty("--reveal-delay"); }, DURATION + delay + 60);
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => entry.isIntersecting && reveal(entry.target));
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  for (const [el, delay] of targets) {
    if (el.getBoundingClientRect().top < fold) continue; // already on screen: never hide it
    el.dataset.revealDelay = String(delay);
    el.classList.add("reveal-pending");
    pending.add(el);
    observer.observe(el);
  }
  // Safety net: if the observer is ever throttled, scrolling still reveals what is on screen.
  let last = 0;
  window.addEventListener("scroll", () => {
    const now = Date.now();
    if (!pending.size || now - last < 200) return;
    last = now;
    pending.forEach((el) => { if (el.getBoundingClientRect().top < window.innerHeight * 0.95) reveal(el); });
  }, { passive: true });
})();

/* ---------- Hero scene: the flowchart runs the algorithm, and tilts slightly with the pointer ---------- */
(function scene() {
  const root = document.querySelector("[data-scene]");
  if (!root) return;
  const rig = root.querySelector("[data-scene-rig]");
  const node = (n) => root.querySelector(`[data-node="${n}"]`);
  const lines = root.querySelectorAll(".scene__code .code span");
  const cells = root.querySelectorAll("[data-cell]");
  const out = { count: root.querySelector('[data-r="count"]'), total: root.querySelector('[data-r="total"]'), out: root.querySelector('[data-r="out"]') };
  const marks = [12, 7, 15, 10];

  // The run through the flowchart, step by step: node, pseudocode line, array cell, values.
  const steps = [{ node: "start", count: "–", total: "–", out: "–" }, { node: "init", line: 1, count: 1, total: 0 }];
  let total = 0;
  for (let count = 1; count <= 4; count++) {
    steps.push({ node: "dec", line: 2, cell: count - 1, count, total });
    total += marks[count - 1];
    steps.push({ node: "add", line: 3, cell: count - 1, count, total });
    steps.push({ node: "inc", line: 4, count: count + 1, total });
  }
  steps.push({ node: "dec", line: 2, count: 5, total }, { node: "out", line: 5, count: 5, total, out: total / 4 }, { node: "stop", count: 5, total, out: total / 4 });

  let i = 0;
  let timer = null;
  function show(s) {
    root.querySelectorAll(".is-active").forEach((el) => el.classList.remove("is-active"));
    node(s.node)?.classList.add("is-active");
    if (s.line) lines[s.line - 1]?.classList.add("is-active");
    if (s.cell !== undefined) cells[s.cell]?.classList.add("is-active");
    out.count.textContent = s.count;
    out.total.textContent = s.total;
    out.out.textContent = s.out ?? "–";
  }
  function tick() {
    show(steps[i]);
    const last = i === steps.length - 1;
    i = last ? 0 : i + 1;
    timer = setTimeout(tick, last ? 2600 : 900);
  }
  const stop = () => { clearTimeout(timer); timer = null; };
  const start = () => { if (!timer && !reduceMotion.matches && !document.hidden) tick(); };

  if (!reduceMotion.matches && "IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { threshold: 0.3 }).observe(root);
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  }

  // Restrained tilt, for mouse and pen only.
  if (!reduceMotion.matches && window.matchMedia("(pointer: fine)").matches) {
    let frame = 0;
    root.addEventListener("pointermove", (e) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = root.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        rig.style.setProperty("--ry", `${(-22 + x * 10).toFixed(2)}deg`);
        rig.style.setProperty("--rx", `${(16 - y * 8).toFixed(2)}deg`);
      });
    });
    root.addEventListener("pointerleave", () => {
      cancelAnimationFrame(frame);
      rig.style.removeProperty("--ry");
      rig.style.removeProperty("--rx");
    });
  }
})();

/* ---------- Programming sheets: tabs bring a sheet to the front of the stack ---------- */
(function stack() {
  const root = document.querySelector("[data-stack]");
  if (!root) return;
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const sheets = tabs.map((t) => document.getElementById(t.getAttribute("aria-controls")));
  const focusables = "a, button, input, select, textarea, [tabindex]";

  function select(index, focus) {
    tabs.forEach((tab, i) => {
      const on = i === index;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
      const depth = (i - index + tabs.length) % tabs.length;
      const sheet = sheets[i];
      sheet.dataset.depth = String(depth);
      sheet.setAttribute("aria-hidden", String(!on));
      sheet.querySelectorAll(focusables).forEach((el) => {
        if (on) { if (el.dataset.tabindex !== undefined) { el.tabIndex = Number(el.dataset.tabindex); delete el.dataset.tabindex; } }
        else if (el.dataset.tabindex === undefined) { el.dataset.tabindex = String(el.tabIndex); el.tabIndex = -1; }
      });
    });
    if (focus) tabs[index].focus();
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", () => select(i));
    tab.addEventListener("keydown", (e) => {
      const move = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (move) { e.preventDefault(); select((i + move + tabs.length) % tabs.length, true); }
      if (e.key === "Home") { e.preventDefault(); select(0, true); }
      if (e.key === "End") { e.preventDefault(); select(tabs.length - 1, true); }
    });
  });
  // Clicking the visible edge of a sheet behind brings it forward.
  sheets.forEach((sheet, i) => {
    sheet.addEventListener("click", (e) => {
      if (sheet.dataset.depth !== "0") { e.preventDefault(); e.stopPropagation(); select(i); }
    }, true);
  });
  select(0);
})();

/* ---------- Trace-table walkthrough (homepage) ---------- */
(function trace() {
  const root = document.querySelector("[data-trace]");
  if (!root) return;
  const lines = root.querySelectorAll(".code span");
  const cells = [...root.querySelectorAll(".trace tbody tr")].map((tr) => tr.querySelectorAll("td"));
  const status = root.querySelector(".sheet__status");
  const nextBtn = root.querySelector("[data-trace-next]");
  const backBtn = root.querySelector("[data-trace-back]");
  const resetBtn = root.querySelector("[data-trace-reset]");

  // line is 1-based; row/col locate the trace-table cell that changes on this step.
  const steps = [
    { line: 1, row: 0, col: 1, value: "0", msg: "Line 1: Total starts at 0." },
    { line: 2, row: 1, col: 0, value: "1", msg: "Line 2: the loop begins with Count = 1." },
    { line: 3, row: 1, col: 1, value: "12", msg: "Line 3: Total = 0 + Marks[1] = 0 + 12." },
    { line: 4, msg: "Line 4: NEXT Count sends us back to the FOR line." },
    { line: 2, row: 2, col: 0, value: "2", msg: "Line 2: Count = 2." },
    { line: 3, row: 2, col: 1, value: "19", msg: "Line 3: Total = 12 + Marks[2] = 12 + 7." },
    { line: 4, msg: "Line 4: back to the FOR line." },
    { line: 2, row: 3, col: 0, value: "3", msg: "Line 2: Count = 3." },
    { line: 3, row: 3, col: 1, value: "34", msg: "Line 3: Total = 19 + Marks[3] = 19 + 15." },
    { line: 4, msg: "Line 4: back to the FOR line." },
    { line: 2, row: 4, col: 0, value: "4", msg: "Line 2: Count = 4, the last pass." },
    { line: 3, row: 4, col: 1, value: "44", msg: "Line 3: Total = 34 + Marks[4] = 34 + 10." },
    { line: 4, msg: "Line 4: Count has reached 4, so the loop ends." },
    { line: 5, row: 5, col: 2, value: "11", msg: "Line 5: 44 / 4 = 11 is output. That completes the table." },
  ];
  let pos = 0; // number of steps applied

  function render() {
    cells.forEach((row) => row.forEach((td) => { td.textContent = ""; td.classList.remove("is-new"); }));
    lines.forEach((l) => l.classList.remove("is-active"));
    for (let i = 0; i < pos; i++) {
      const s = steps[i];
      if (s.row !== undefined) {
        const td = cells[s.row][s.col];
        td.textContent = s.value;
        if (i === pos - 1) td.classList.add("is-new");
      }
    }
    const current = steps[pos - 1];
    if (current) lines[current.line - 1].classList.add("is-active");
    status.textContent = current ? `Step ${pos} of ${steps.length}. ${current.msg}` : "Press Next step to run the algorithm one line at a time.";
    nextBtn.disabled = pos === steps.length;
    backBtn.disabled = pos === 0;
  }

  nextBtn.addEventListener("click", () => { if (pos < steps.length) { pos++; render(); } });
  backBtn.addEventListener("click", () => { if (pos > 0) { pos--; render(); } });
  resetBtn.addEventListener("click", () => { pos = 0; render(); nextBtn.focus(); });
  root.querySelector(".sheet__controls").hidden = false;
  render();
})();

/* ---------- Library filters (topic library and video library) ----------
   The server already applies the filters from the URL; this makes them live as you type. */
(function filters() {
  const form = document.querySelector("[data-filters]");
  if (!form) return;
  const items = [...document.querySelectorAll("[data-item]")];
  const count = document.querySelector("[data-results-count]");
  const empty = document.querySelector("[data-empty]");
  const noun = form.dataset.filters === "video" ? "lessons" : "topics";
  const fields = [...form.elements].filter((el) => el.name);

  function apply() {
    const values = Object.fromEntries(fields.map((el) => [el.name, el.value.trim()]));
    const words = (values.q || "").toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const item of items) {
      const d = item.dataset;
      const match =
        (!values.level || d.level === values.level) &&
        (!values.paper || d.paper === values.paper) &&
        (!values.topic || d.topic === values.topic) &&
        (!values.type || (d.types || "").split("|").includes(values.type)) &&
        words.every((w) => d.search.includes(w));
      item.hidden = !match;
      if (match) shown++;
    }
    count.textContent = `${shown} of ${items.length} ${noun} shown`;
    empty.hidden = shown !== 0;
    const qs = new URLSearchParams(Object.entries(values).filter(([, v]) => v)).toString();
    history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
  }

  form.addEventListener("input", apply);
  form.addEventListener("submit", (e) => { e.preventDefault(); apply(); });
  document.querySelectorAll("[data-clear-filters]").forEach((el) =>
    el.addEventListener("click", (e) => {
      e.preventDefault();
      fields.forEach((f) => { f.value = ""; });
      apply();
      fields[0].focus();
    })
  );
})();

/* ---------- Video player: loads YouTube only when asked ---------- */
(function player() {
  // A removed or private video's thumbnail comes back as YouTube's 120px-wide placeholder.
  const markUnavailable = (img) => {
    const card = img.closest(".video-card, .player");
    if (!card) return;
    if (card.classList.contains("player")) {
      card.hidden = true;
      document.querySelector("[data-unavailable]")?.removeAttribute("hidden");
    } else {
      const label = document.createElement("span");
      label.className = "video-card__nothumb";
      label.textContent = "Video unavailable";
      img.replaceWith(label);
    }
  };
  document.querySelectorAll("[data-yt-thumb]").forEach((img) => {
    const check = () => { if (img.naturalWidth && img.naturalWidth <= 120) markUnavailable(img); };
    if (img.complete) check(); else img.addEventListener("load", check);
    img.addEventListener("error", () => markUnavailable(img));
  });

  document.querySelectorAll("[data-player]").forEach((box) => {
    box.querySelector("[data-play]").addEventListener("click", () => {
      const iframe = document.createElement("iframe");
      iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(box.dataset.videoId)}?autoplay=1&rel=0&cc_load_policy=1`;
      iframe.title = `Video lesson: ${box.dataset.videoTitle}`;
      iframe.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture";
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = "strict-origin-when-cross-origin";
      box.classList.add("is-playing");
      box.appendChild(iframe);
      iframe.focus();
    });
  });
})();

/* ---------- Enquiry form ---------- */
(function enquiry() {
  const form = document.querySelector("[data-enquiry]");
  if (!form) return;
  const result = document.querySelector("[data-form-result]");
  const submit = form.querySelector("[data-submit]");
  const idField = form.querySelector("[data-submission-id]");
  const typeSelect = form.elements.type;
  const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  idField.value = newId();

  // Show only the fields that apply to the chosen enquiry type.
  function showFields() {
    const type = typeSelect.value;
    form.querySelectorAll("[data-show-for]").forEach((el) => {
      el.hidden = Boolean(type) && !el.dataset.showFor.split(" ").includes(type);
    });
    form.querySelectorAll("[data-optional-for]").forEach((el) => {
      el.hidden = !el.dataset.optionalFor.split(" ").includes(type);
    });
  }
  typeSelect.addEventListener("change", showFields);
  showFields();

  // Same rules as the server (lib/enquiry.js); the server re-checks everything.
  const rules = {
    type: (v) => (v ? "" : "Choose what your enquiry is about."),
    name: (v, t) => (t === "correction" || (v.trim().length >= 2 && v.length <= 80) ? "" : "Enter the student's name."),
    role: (v, t) => (t === "correction" || v ? "" : "Tell us whether you are a student or a parent."),
    level: (v, t) => ((t === "class" || t === "workshop") && !v ? "Choose a level." : ""),
    phone: (v, t) => {
      if (v && !/^\+?\d{10,15}$/.test(v.replace(/[\s()-]/g, ""))) return "Enter a phone number such as 0300-1234567.";
      if (!v && !form.elements.email.value.trim() && t && t !== "correction") return "Give a phone number or an email address so we can reply.";
      return "";
    },
    email: (v) => (!v || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? "" : "Check the email address."),
    message: (v, t) => ((t === "general" || t === "correction") && v.trim().length < 5 ? (t === "correction" ? "Tell us what looks wrong." : "Write your question.") : ""),
    consent: (_, __, el) => (el.checked ? "" : "Please agree so we can reply to you."),
  };

  const elementsOf = (name) => {
    const el = form.elements[name];
    if (!el) return [];
    return el instanceof RadioNodeList ? [...el] : [el];
  };
  function check(name) {
    const els = elementsOf(name);
    if (!els.length) return "";
    const value = form.elements[name].value ?? "";
    const message = rules[name](String(value), typeSelect.value, els[0]);
    const err = document.getElementById(`${name}-error`);
    if (err) err.textContent = message;
    els.forEach((t) => t.setAttribute("aria-invalid", message ? "true" : "false"));
    return message;
  }
  Object.keys(rules).forEach((name) => elementsOf(name).forEach((el) => el.addEventListener("change", () => check(name))));

  function show(kind, html) {
    result.className = `form-result form-result--${kind}`;
    result.innerHTML = html;
    result.hidden = false;
    result.focus();
  }

  const messages = {
    setup_required: "<p><strong>Online enquiries are not open yet, so nothing was sent.</strong> Please use the other contact details on this page.</p>",
    rate_limited: "<p><strong>Too many enquiries from this connection.</strong> Please wait a few minutes and try again.</p>",
    delivery_failed: "<p><strong>Your enquiry could not be delivered.</strong> Nothing was sent. Please try again in a few minutes.</p>",
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (submit.disabled) return; // a request is already in flight
    const failed = Object.keys(rules).filter((n) => {
      const el = elementsOf(n)[0];
      return el && !el.closest("[hidden]") ? check(n) : false;
    });
    if (failed.length) {
      elementsOf(failed[0])[0].focus();
      return;
    }
    submit.disabled = true;
    submit.classList.add("is-loading");
    submit.textContent = "Sending…";
    result.hidden = true;
    try {
      const data = Object.fromEntries(new FormData(form));
      const res = await fetch(form.action, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        form.reset();
        idField.value = newId();
        showFields();
        show("ok", `<p><strong>Thank you, your enquiry has been received.</strong> Reference ${body.reference}. You will be contacted using the details you gave.</p>`);
      } else if (body.errors) {
        Object.keys(body.errors).forEach((name) => {
          const err = document.getElementById(`${name}-error`);
          if (err) err.textContent = body.errors[name];
          elementsOf(name).forEach((el) => el.setAttribute("aria-invalid", "true"));
        });
        show("error", "<p><strong>Please check the highlighted fields.</strong> Your enquiry has not been sent yet.</p>");
      } else if (body.error === "token") {
        show("error", `<p><strong>${body.message}</strong></p>`);
      } else {
        show("error", messages[body.error] || messages.delivery_failed);
      }
    } catch {
      show("error", "<p><strong>Your enquiry could not be sent</strong> because the connection failed. Check your internet connection and try again.</p>");
    } finally {
      submit.disabled = false;
      submit.classList.remove("is-loading");
      submit.textContent = "Send enquiry";
    }
  });
})();
