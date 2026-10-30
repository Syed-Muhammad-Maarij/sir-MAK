// Public pages. Each function takes the request context and returns { status, html }.
const config = require("./config");
const enquiry = require("./enquiry");
const { RESOURCE_TYPES } = require("./schema");
const {
  esc, formatDate, query, enquiryOpen, contactRoute, draftTag, availabilityTag, adminNote, pageHead, faqBlock,
  videoCard, ytThumb, layout,
} = require("./html");

const ok = (html) => ({ status: 200, html });
const courseLabel = (c) => (c ? c.short || c.title : "");
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const paperList = (c) => (c.papers || []).map((line) => {
  const [name, title = ""] = line.split("|").map((s) => s.trim());
  return { name, title };
});

// Programming topics featured on the homepage, each tied to a topic record.
const PROGRAMMING = [
  ["Algorithms and flowcharts", "igcse-7-algorithm-design-and-problem-solving"],
  ["Trace tables", "igcse-7-algorithm-design-and-problem-solving"],
  ["Pseudocode, arrays and loops", "igcse-8-programming"],
  ["Procedures and functions", "igcse-8-programming"],
  ["SQL", "igcse-9-databases"],
  ["Logic gates and truth tables", "igcse-10-boolean-logic"],
  ["Stacks, queues and linked lists", "as-10-data-types-and-structures"],
  ["Program design and testing", "as-12-software-development"],
  ["Searching, sorting and recursion", "a2-19-computational-thinking-and-problem-solving"],
  ["Object-oriented programming", "a2-20-further-programming"],
];

const LEVEL_MOD = { "o-level-igcse": "ol", "as-level": "as", "a2-level": "a2", "full-a-level": "full" };

/* ---------- Small isometric diagrams that tell the four routes apart ---------- */
function isoBlock(cx, cy, s, h, hi = false) {
  const pts = (a) => a.map((p) => p.map((n) => +n.toFixed(2)).join(",")).join(" ");
  const top = pts([[cx, cy - s / 2], [cx + s, cy], [cx, cy + s / 2], [cx - s, cy]]);
  const left = pts([[cx - s, cy], [cx, cy + s / 2], [cx, cy + s / 2 + h], [cx - s, cy + h]]);
  const right = pts([[cx, cy + s / 2], [cx + s, cy], [cx + s, cy + h], [cx, cy + s / 2 + h]]);
  return `<polygon points="${left}" fill="currentColor" fill-opacity="${hi ? 0.7 : 0.32}"/><polygon points="${right}" fill="currentColor" fill-opacity="${hi ? 0.85 : 0.5}"/><polygon points="${top}" fill="currentColor" fill-opacity="${hi ? 1 : 0.12}"/>`;
}
function isoDisc(cx, cy, rx, h, hi = false) {
  const ry = rx / 2;
  return `<path d="M${cx - rx} ${cy}v${h}a${rx} ${ry} 0 0 0 ${2 * rx} 0v${-h}z" fill="currentColor" fill-opacity="${hi ? 0.8 : 0.45}"/><ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="currentColor" fill-opacity="${hi ? 1 : 0.14}" stroke="currentColor" stroke-width="1"/>`;
}
function levelGlyph(slug) {
  let art = "";
  if (slug === "o-level-igcse") {
    // A 1D array, with the element being inspected raised
    art = [0, 1, 2, 3].map((i) => isoBlock(16 + i * 11.25, 20 + i * 5.6, 9, i === 2 ? 13 : 8, i === 2)).join("");
  } else if (slug === "as-level") {
    // A stack, with the top item just pushed
    art = isoBlock(38, 44, 15, 7) + isoBlock(38, 34, 15, 7) + isoBlock(38, 22, 15, 7, true) +
      `<path d="M38 2v9m-3.5-3.5L38 11l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else if (slug === "a2-level") {
    // A weighted graph, with a shortest path picked out
    art = `<g fill="none" stroke="currentColor" stroke-linecap="round"><path d="M14 40 38 24M38 24 62 40M14 40 38 52M38 52 62 40" stroke-opacity=".35" stroke-width="1.4"/><path d="M14 40 38 24 62 40" stroke-width="2.4"/></g>` +
      isoDisc(38, 50, 7, 4) + isoDisc(14, 38, 7, 4, true) + isoDisc(38, 22, 7, 4, true) + isoDisc(62, 38, 7, 4, true);
  } else {
    // Two layers: AS underneath, A2 built on top
    art = `<g class="g-as">${isoBlock(38, 40, 26, 5)}</g><g class="g-a2">${isoBlock(38, 24, 26, 5, true)}</g>`;
  }
  return `<svg viewBox="0 0 76 62" role="presentation" focusable="false">${art}</svg>`;
}

/* ---------- Hero: one algorithm shown three ways, in depth ---------- */
function heroScene() {
  const kw = (w) => `<b class="kw">${w}</b>`;
  return `<figure class="scene" data-scene aria-labelledby="scene-cap">
  <div class="scene__rig" data-scene-rig>
    <div class="scene__layer scene__code paper" aria-hidden="true">
      <p class="scene__code-head">Pseudocode</p>
      <pre class="code"><code><span>Total ← 0</span><span>${kw("FOR")} Count ← 1 ${kw("TO")} 4</span><span>  Total ← Total + Marks[Count]</span><span>${kw("NEXT")} Count</span><span>${kw("OUTPUT")} Total / 4</span></code></pre>
    </div>
    <div class="scene__layer fc paper" aria-hidden="true">
      <p class="fc__head">Flowchart</p>
      <svg class="fc__lines" viewBox="0 0 100 120" focusable="false">
        <defs><marker id="fc-ah" viewBox="0 0 6 6" refX="5.4" refY="3" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0 6 3 0 6z" fill="#9aa6b6"/></marker></defs>
        <g marker-end="url(#fc-ah)">
          <path d="M38 14.7V21.3"/><path d="M38 32.7V39.5"/><path d="M38 60.5V68.3"/><path d="M38 79.7V90.3"/>
          <path d="M19 96H7V50H27.5"/><path d="M48.5 50H64"/><path d="M80 55.7V68.3"/>
        </g>
        <text x="40" y="65.5">Yes</text><text x="52" y="47.8">No</text>
      </svg>
      <div class="fc__node fc__start" data-node="start"><span>START</span></div>
      <div class="fc__node fc__init" data-node="init"><span>Total ← 0, Count ← 1</span></div>
      <div class="fc__node fc__dec" data-node="dec"><span>Count ≤ 4?</span></div>
      <div class="fc__node fc__add" data-node="add"><span>Total ← Total + Marks[Count]</span></div>
      <div class="fc__node fc__inc" data-node="inc"><span>Count ← Count + 1</span></div>
      <div class="fc__node fc__out" data-node="out"><span>OUTPUT Total / 4</span></div>
      <div class="fc__node fc__stop" data-node="stop"><span>STOP</span></div>
    </div>
    <div class="scene__layer scene__array paper" aria-hidden="true">
      <span class="scene__array-name">Marks</span>
      ${[12, 7, 15, 10].map((n, i) => `<span class="cell" data-cell="${i}"><b>${n}</b><small>[${i + 1}]</small></span>`).join("")}
    </div>
    <div class="scene__layer scene__readout" aria-hidden="true">
      <div>Count <span data-r="count">5</span></div>
      <div>Total <span data-r="total">44</span></div>
      <div>Output <span data-r="out">11</span></div>
    </div>
  </div>
  <figcaption id="scene-cap" class="visually-hidden">An algorithm that adds the four marks in the array Marks (12, 7, 15 and 10) and outputs their average, 11, shown as pseudocode, as a flowchart and as the array it reads.</figcaption>
</figure>`;
}

/* ---------- Homepage video box ----------
   Uses the video chosen in Site settings, else the newest published lesson with a YouTube ID.
   With neither, it shows a clear "coming soon" screen rather than an empty frame. */
function watchBlock(ctx, q) {
  const s = q.settings;
  const lesson = q.videos.slice().reverse().find((v) => v.youtubeId);
  const pick = s.homeVideo
    ? { id: s.homeVideo, title: s.homeVideoTitle || "A lesson from Sir MAK", text: s.homeVideoText, page: "" }
    : lesson ? { id: lesson.youtubeId, title: lesson.title, text: lesson.description, page: `/videos/${lesson.id}` } : null;
  const channel = q.contact("youtube");
  const screen = pick
    ? `<div class="player" data-player data-video-id="${esc(pick.id)}" data-video-title="${esc(pick.title)}">
        <img src="${ytThumb(pick.id)}" alt="" width="480" height="360" data-yt-thumb>
        <button class="player__play" type="button" data-play><span class="player__icon" aria-hidden="true"></span><span>Play video<span class="visually-hidden">: ${esc(pick.title)}</span></span></button>
        <p class="player__note">Plays from YouTube (privacy-enhanced mode). YouTube may set cookies once you press play.</p>
      </div>
      <div class="callout callout--bad" data-unavailable hidden><p><strong>This video seems to be unavailable.</strong> Browse the <a href="/videos">video library</a> instead.</p></div>`
    : `<div class="player player--empty">
        <span class="player__icon" aria-hidden="true"></span>
        <strong>The welcome video is on its way</strong>
        <p>Sir MAK's lessons will play right here, starting with an introduction to how the course works.</p>
        ${adminNote(ctx, `no video is chosen yet. Paste a YouTube link into <a href="/admin/settings">Site settings → Homepage video</a>, or publish a lesson with a YouTube ID.`)}
      </div>`;
  const intro = pick && pick.text ? esc(pick.text.split("\n")[0]) : "Short, focused lessons on the topics students find hardest: binary and logic, pseudocode and trace tables, SQL, and exam technique for every paper.";
  return `<section class="section section--tight" aria-labelledby="watch-title">
  <div class="wrap watch" data-reveal>
    <div class="watch__screen"><div class="watch__frame">${screen}</div></div>
    <div class="watch__side">
      <h2 id="watch-title">${pick ? esc(pick.title) : "Watch Sir MAK teach"}</h2>
      <p>${intro}</p>
      <div class="watch__links">
        ${pick && pick.page ? `<a class="btn btn--arrow" href="${esc(pick.page)}">Open the lesson</a>` : `<a class="btn btn--arrow" href="/videos">Browse the video library</a>`}
        ${channel ? `<a class="arrow-link" href="${esc(channel.value)}" rel="noopener">${esc(channel.label)}</a>` : ""}
      </div>
    </div>
  </div>
</section>`;
}

function enquireHref(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return `/contact${qs ? `?${qs}` : ""}#enquire`;
}

/* ==========================================================================
   Home
   ========================================================================== */
function home(ctx) {
  const q = query(ctx);
  const s = q.settings;
  const ann = q.announcement();
  const watch = watchBlock(ctx, q);

  const levelRows = q.courses.map((c) => {
    const topics = q.topicsFor(c.slug);
    const levels = c.combines && c.combines.length ? c.combines : [c.slug];
    const vids = q.videos.filter((v) => levels.includes(v.level)).length;
    const res = q.resources.filter((r) => levels.includes(r.level)).length;
    const papers = c.combines && c.combines.length
      ? "All four papers, planned as a theory track and a programming track"
      : paperList(c).map((p) => `${p.name}: ${p.title}`).join(" · ");
    const contents = [plural(topics.length, "syllabus topic"), vids && plural(vids, "video lesson"), res && plural(res, "resource")].filter(Boolean).join(" · ");
    return `<li><a class="level level--${LEVEL_MOD[c.slug] || "ol"}" href="/learn/${esc(c.slug)}">
      <span class="level__glyph" aria-hidden="true">${levelGlyph(c.slug)}</span>
      <span>
        <span class="level__code">${esc(c.codes || "")}</span>
        <span class="level__title">${esc(c.title)}${draftTag(c)}</span>
        <span class="level__papers">${esc(papers)}</span>
        <span class="level__count">${esc(contents)}</span>
      </span>
      <span class="level__go" aria-hidden="true">Open route</span>
    </a></li>`;
  }).join("");

  const notes = q.resources.filter((r) => r.type === "Notes" || r.type === "Diagram" || r.type === "Slides").length;
  const practice = q.resources.filter((r) => r.type === "Practice questions" || r.type === "Worksheet").length;
  const code = q.resources.filter((r) => r.type === "Code sample").length;
  const pill = (n, word, fallback) => (n ? `<span class="status status--open">${plural(n, word)}</span>` : `<span class="status status--soon">${fallback}</span>`);

  const featured = (q.videos.some((v) => v.featured) ? q.videos.filter((v) => v.featured) : q.videos.slice().reverse()).slice(0, 4);
  const featuredBlock = featured.length
    ? `<div class="video-grid">${featured.map((v) => videoCard(v, q)).join("")}</div>`
    : `<div class="empty"><p><strong>MAKCS video lessons are being added.</strong></p><p class="muted">Lessons will appear here, sorted by level and topic, once each one has been checked and linked. In the meantime, the <a href="/learn/topics">topic library</a> lists every syllabus topic.</p>${adminNote(ctx, `no videos are published. <a href="/admin/videos">Add or publish lessons</a>; 20 draft lesson entries are waiting for their YouTube IDs.`)}</div>`;

  const programming = PROGRAMMING.map(([label, id]) => {
    const t = q.topic(id);
    return t ? `<li><a href="/learn/topics/${esc(id)}">${esc(label)}</a></li>` : "";
  }).join("");
  const kw = (w) => `<b class="kw">${w}</b>`;

  const offerings = [...q.classes.map((c) => ({ ...c, kind: "Class" })), ...q.workshops.map((w) => ({ ...w, kind: "Workshop" }))];
  const lastConfirmed = offerings.map((o) => o.lastConfirmed).filter(Boolean).sort().pop();
  const classesBlock = offerings.length
    ? `<ul class="offer-list">${offerings.slice(0, 4).map((o) => `<li>
        <h3>${esc(o.title)}${draftTag(o)}</h3>
        <p class="small muted">${esc(o.kind)} · ${esc(courseLabel(q.course(o.level)))}${o.mode ? ` · ${esc(o.mode)}` : ""}${o.startDate ? ` · starts ${esc(formatDate(o.startDate))}` : o.days ? ` · ${esc(o.days)}${o.time ? `, ${esc(o.time)}` : ""}` : ""}</p>
        <p>${availabilityTag(o.availability)}</p>
      </li>`).join("")}</ul>
      <p class="small muted">Last confirmed ${esc(formatDate(lastConfirmed))}.</p>
      <p><a class="btn" href="/classes-workshops">See classes and workshops</a></p>`
    : `<div class="callout">
        <p><strong>The current timetable is being confirmed.</strong> ${contactRoute(q) ? `Contact us for the current timetable, fees and availability.` : `Class times, fees and workshop dates will be published here once they are confirmed.`}</p>
        ${contactRoute(q) ? `<p><a class="btn" href="${enquireHref({ type: "class" })}">Enquire about classes</a></p>` : ""}
        ${adminNote(ctx, `no classes or workshops are published${contactRoute(q) ? "" : " and no contact route is configured, so visitors have no way to ask. See the <a href=\"/admin\">setup checklist</a>"}. <a href="/admin/classes">Manage classes</a>.`)}
      </div>`;

  const bioParas = s.bioApproved && s.bio ? s.bio.split("\n").filter(Boolean) : [];
  const testimonials = q.testimonials;
  const faqs = q.faqs("general");

  const body = `
${ann ? `<div class="announcement"><div class="wrap"><p>${esc(ann.text)}${ann.link ? ` <a href="${esc(ann.link)}">${esc(ann.linkLabel || "Find out more")}</a>` : ""}${draftTag(ann)}</p></div></div>` : ""}
<section class="hero" aria-labelledby="hero-title">
  <div class="wrap">
    <div>
      <p class="hero__kicker">Computer Science · O Level to A Level</p>
      <h1 id="hero-title"><span>Understand the <em>logic.</em></span> <span>Master the subject.</span></h1>
      <p class="lede">Explore lessons, programming concepts and exam-focused resources for O Level, IGCSE, AS and A Level Computer Science with Sir MAK.</p>
      <div class="hero__actions">
        <a class="btn btn--arrow" href="/learn">Explore learning resources</a>
        <a class="arrow-link" href="/videos">Watch MAKCS lessons</a>
      </div>
      <p class="hero__jump"><span>Go straight to</span>${q.courses.map((c) => `<a href="/learn/${esc(c.slug)}">${esc(c.short || c.title)}</a>`).join("")}</p>
    </div>
    ${heroScene()}
  </div>
</section>

${watch}

<section class="section" id="levels" aria-labelledby="levels-title">
  <div class="wrap">
    <div class="section-head section-head--split" data-reveal>
      <h2 id="levels-title">Choose your level</h2>
      <p class="lede">Each level page sets out its papers and syllabus topics, with the lessons, notes and practice linked to each topic as they are published.</p>
    </div>
    <ol class="levels" data-reveal-group>${levelRows}</ol>
  </div>
</section>

<section class="section section--white" aria-labelledby="resources-title">
  <div class="wrap">
    <div class="section-head section-head--split" data-reveal>
      <h2 id="resources-title">Understand, practise, program</h2>
      <p>Three ways to study a topic. Each shows what is available today; anything still being prepared is labelled.</p>
    </div>
    <div class="ways" data-reveal-group>
      <article class="way">
        <h3>Understand<span>.</span></h3>
        <p>Concept explanations, video lessons, diagrams and teacher-approved notes, organised by syllabus topic.</p>
        <div class="way__side"><p>${pill(q.videos.length, "video lesson", "Video lessons being added")} ${pill(notes, "set of notes", "Notes planned")}</p><a class="arrow-link" href="/learn/topics">Browse the topic library</a></div>
      </article>
      <article class="way">
        <h3>Practise<span>.</span></h3>
        <p>Topical questions and exam-style practice, so you can check your understanding the way the papers test it.</p>
        <div class="way__side"><p>${pill(practice, "practice resource", "Practice sets planned")} <span class="status status--soon">Quizzes planned</span></p><a class="arrow-link" href="/learn/topics?type=Practice+questions">Find practice by topic</a></div>
      </article>
      <article class="way">
        <h3>Program<span>.</span></h3>
        <p>Algorithms, pseudocode, trace tables, SQL, flowcharts, arrays, searching and sorting: the skills behind Paper 2 and Paper 4.</p>
        <div class="way__side"><p>${pill(code, "code sample", "Code samples planned")}</p><a class="arrow-link" href="#programming-title">See programming topics</a></div>
      </article>
    </div>
  </div>
</section>

<section class="section" aria-labelledby="featured-title">
  <div class="wrap">
    <div class="section-head section-head--split" data-reveal>
      <h2 id="featured-title">Featured lessons</h2>
      <p>Lessons from the MAKCS video library. <a href="/videos">Browse all lessons</a> by level, topic and paper.</p>
    </div>
    <div data-reveal>${featuredBlock}</div>
  </div>
</section>

<section class="section band" aria-labelledby="programming-title">
  <div class="wrap prog">
    <div data-reveal>
      <h2 id="programming-title">Programming is learned one line at a time.</h2>
      <p>The problem-solving papers reward method: reading the question carefully, tracing an algorithm step by step and writing code an examiner can follow. Try the trace table on the right, then open the topic it comes from.</p>
      <h3 class="visually-hidden">Programming topics</h3>
      <ul class="prog__topics">${programming}</ul>
      <a class="btn btn--arrow" href="/classes-workshops#workshops">Programming workshops</a>
    </div>
    <div class="stack" data-stack data-reveal>
      <div class="stack__tabs" role="tablist" aria-label="Study sheets">
        <button type="button" role="tab" id="tab-trace" aria-controls="sheet-trace" aria-selected="true">Trace table</button>
        <button type="button" role="tab" id="tab-search" aria-controls="sheet-search" aria-selected="false" tabindex="-1">Linear search</button>
        <button type="button" role="tab" id="tab-sql" aria-controls="sheet-sql" aria-selected="false" tabindex="-1">SQL</button>
      </div>
      <div class="stack__sheets">
        <section class="stack__sheet" id="sheet-trace" role="tabpanel" aria-labelledby="tab-trace" data-depth="0" data-trace>
          <div class="sheet__head"><p>Complete the trace table</p><span>arrays · loops</span></div>
          <div class="sheet__body">
            <p class="sheet__q">The array <code>Marks[1:4]</code> holds <code>12, 7, 15, 10</code>. What does this algorithm output?</p>
            <pre class="code" aria-label="Pseudocode"><code><span>Total ← 0</span><span>${kw("FOR")} Count ← 1 ${kw("TO")} 4</span><span>   Total ← Total + Marks[Count]</span><span>${kw("NEXT")} Count</span><span>${kw("OUTPUT")} Total / 4</span></code></pre>
            <table class="trace">
              <caption class="visually-hidden">Trace table</caption>
              <thead><tr><th scope="col">Count</th><th scope="col">Total</th><th scope="col">OUTPUT</th></tr></thead>
              <tbody>${Array.from({ length: 6 }, () => "<tr><td></td><td></td><td></td></tr>").join("")}</tbody>
            </table>
            <div class="sheet__controls" hidden>
              <button class="btn btn--small" type="button" data-trace-next>Next step</button>
              <button class="btn btn--ghost btn--small" type="button" data-trace-back>Back</button>
              <button class="btn btn--ghost btn--small" type="button" data-trace-reset>Reset</button>
              <p class="sheet__status" aria-live="polite"></p>
            </div>
            <noscript><p class="small">Answer: Total ends at 44, so the output is 11.</p></noscript>
          </div>
        </section>
        <section class="stack__sheet" id="sheet-search" role="tabpanel" aria-labelledby="tab-search" data-depth="1">
          <div class="sheet__head"><p>Linear search</p><span>pseudocode</span></div>
          <div class="sheet__body">
            <p class="sheet__q">Checks each element of <code>Names[1:10]</code> in turn until it finds <code>SearchName</code> or reaches the end.</p>
            <pre class="code" aria-label="Linear search pseudocode"><code><span>${kw("DECLARE")} Index : ${kw("INTEGER")}</span><span>${kw("DECLARE")} Found : ${kw("BOOLEAN")}</span><span>Found ← ${kw("FALSE")}</span><span>Index ← 1</span><span>${kw("WHILE")} Index &lt;= 10 ${kw("AND")} Found = ${kw("FALSE")} ${kw("DO")}</span><span>   ${kw("IF")} Names[Index] = SearchName</span><span>      ${kw("THEN")} Found ← ${kw("TRUE")}</span><span>      ${kw("ELSE")} Index ← Index + 1</span><span>   ${kw("ENDIF")}</span><span>${kw("ENDWHILE")}</span></code></pre>
          </div>
        </section>
        <section class="stack__sheet" id="sheet-sql" role="tabpanel" aria-labelledby="tab-sql" data-depth="2">
          <div class="sheet__head"><p>Querying a single table</p><span>SQL</span></div>
          <div class="sheet__body">
            <p class="sheet__q">Lists every student in the <code>Students</code> table with a mark of 70 or more, highest first.</p>
            <pre class="code" aria-label="SQL query"><code><span>${kw("SELECT")} Name, Mark</span><span>${kw("FROM")} Students</span><span>${kw("WHERE")} Mark &gt;= 70</span><span>${kw("ORDER BY")} Mark ${kw("DESC")};</span></code></pre>
            <table class="trace result">
              <caption>Result, using example data</caption>
              <thead><tr><th scope="col">Name</th><th scope="col">Mark</th></tr></thead>
              <tbody><tr><td>Hira</td><td>91</td></tr><tr><td>Bilal</td><td>84</td></tr><tr><td>Sana</td><td>72</td></tr></tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  </div>
</section>

<section class="section section--soft" aria-labelledby="classes-title">
  <div class="wrap">
    <div class="section-head section-head--split" data-reveal>
      <h2 id="classes-title">Classes and workshops</h2>
      <p>Classes, online lessons, revision sessions and Paper 2 programming workshops. Only confirmed details are published.</p>
    </div>
    <div data-reveal>${classesBlock}</div>
  </div>
</section>

<section class="section" aria-labelledby="about-title">
  <div class="wrap profile" data-reveal>
    ${portrait(s)}
    <div>
      <h2 id="about-title">${esc(s.fullName)}</h2>
      ${bioParas.length ? `<p class="lede">${esc(bioParas[0])}</p>` : `<p class="lede">Sir MAK teaches Computer Science at O Level, IGCSE, AS and A Level. Lessons start from what the syllabus asks you to understand, then move to the questions that test it.</p>`}
      ${bioParas.length ? "" : adminNote(ctx, `the approved biography is not published yet. <a href="/admin/settings">Edit the biography</a>.`)}
      <p><a class="arrow-link" href="/about">About Sir MAK</a></p>
    </div>
  </div>
</section>

${testimonials.length ? `<section class="section" aria-labelledby="t-title"><div class="wrap">
  <div class="section-head"><h2 id="t-title">From students</h2></div>
  <div class="quotes">${testimonials.map((t) => `<figure class="quote"><blockquote><p>${esc(t.quote)}</p></blockquote><figcaption>${esc(t.attribution)}${draftTag(t)}</figcaption></figure>`).join("")}</div>
</div></section>` : ""}

${faqs.length ? `<section class="section section--white" id="faq" aria-labelledby="faq-title">
  <div class="wrap">
    <div class="section-head" data-reveal><h2 id="faq-title">Frequently asked questions</h2></div>
    ${faqBlock(faqs)}
  </div>
</section>` : ""}`;

  return ok(layout(ctx, {
    title: "",
    description: "Computer Science lessons, programming concepts, exam-focused resources and revision for O Level, IGCSE, AS and A Level with Sir MAK.",
    path: "/",
    active: "home",
    body,
    jsonLd: { "@context": "https://schema.org", "@type": "EducationalOrganization", name: `${s.brand} Computer Science`, url: config.siteUrl, founder: { "@type": "Person", name: s.fullName } },
  }));
}

function portrait(s) {
  return s.portraitUrl
    ? `<img class="portrait-img" src="${esc(s.portraitUrl)}" alt="${esc(s.portraitAlt || `Portrait of ${s.fullName}`)}" width="480" height="600" loading="lazy">`
    : `<div class="portrait" aria-hidden="true"><span class="portrait__mono">MAK</span></div>`;
}

/* ==========================================================================
   Learn
   ========================================================================== */
function learnIndex(ctx) {
  const q = query(ctx);
  const cards = q.courses.map((c) => {
    const topics = q.topicsFor(c.slug);
    return `<article class="route route--${LEVEL_MOD[c.slug] || "ol"}">
      <p class="level__code">${esc(c.codes || "")}</p>
      <h2><a href="/learn/${esc(c.slug)}">${esc(c.title)}</a>${draftTag(c)}</h2>
      <p>${esc(c.summary)}</p>
      <p class="small muted">${esc(c.audience || "")}</p>
      <p class="small"><strong>${plural(topics.length, "topic")}</strong>${(c.papers || []).length ? ` across ${plural(c.papers.length, "paper")}` : ""}</p>
    </article>`;
  }).join("");
  const body = `
${pageHead({ trail: [["Home", "/"], ["Learn"]], title: "Learn Computer Science", lede: "Choose your level, find the topic, study the lesson, then practise it. Every level follows its Cambridge syllabus topic by topic." })}
<section class="section"><div class="wrap">
  <div class="routes">${cards}</div>
</div></section>
<section class="section"><div class="wrap split">
  <div><h2>Looking for one topic?</h2></div>
  <div><p class="lede">The topic library lists every topic across all levels. Search it, or filter by level, paper and resource type.</p>
  <p><a class="btn" href="/learn/topics">Open the topic library</a></p></div>
</div></section>`;
  return ok(layout(ctx, {
    title: "Learn",
    description: "Computer Science learning routes for O Level / IGCSE, AS Level, A2 Level and full A Level, organised by syllabus paper and topic.",
    path: "/learn",
    active: "learn",
    body,
  }));
}

function topicRow(t, q, { showLevel = true } = {}) {
  const vids = q.videos.filter((v) => v.topic === t.id).length;
  const res = q.resources.filter((r) => r.topic === t.id).length;
  const c = q.course(t.level);
  const counts = [vids && plural(vids, "video"), res && plural(res, "resource")].filter(Boolean).join(" · ");
  return `<li><span class="topics__n">${esc(t.number ?? "")}</span><div>
    <a href="/learn/topics/${esc(t.id)}">${esc(t.title)}</a>${draftTag(t)}
    ${showLevel ? ` <span class="muted small">· ${esc(courseLabel(c))}</span>` : ""}
    ${counts ? ` <span class="status status--open">${esc(counts)}</span>` : ""}
    <small>${esc(t.keywords || "")}</small>
  </div></li>`;
}

function levelPage(ctx, slug) {
  const q = query(ctx);
  const c = q.course(slug);
  if (!c) return null;
  const combined = c.combines && c.combines.length;
  const topics = q.topicsFor(slug);
  const levels = combined ? c.combines : [slug];
  const vids = q.videos.filter((v) => levels.includes(v.level));
  const res = q.resources.filter((r) => levels.includes(r.level));

  const facts = `<dl class="facts">
    ${c.codes ? `<div><dt>Syllabus code</dt><dd>${esc(c.codes)}</dd></div>` : ""}
    ${c.edition ? `<div><dt>Edition</dt><dd>${esc(c.edition)}</dd></div>` : ""}
    <div><dt>Papers</dt><dd>${combined ? "1, 2, 3 and 4" : esc(paperList(c).map((p) => p.name.replace("Paper ", "")).join(" and ") || "—")}</dd></div>
    <div><dt>Topics</dt><dd>${topics.length}</dd></div>
  </dl>
  ${c.edition ? "" : adminNote(ctx, `the syllabus edition / exam years are not confirmed, so that row is hidden. <a href="/admin/courses/${esc(c.slug)}">Edit this course</a>.`)}`;

  let papersBlock;
  if (combined) {
    const parts = c.combines.map((s) => q.course(s)).filter(Boolean);
    papersBlock = `
<section class="section" aria-labelledby="tracks-title"><div class="wrap">
  <div class="section-head section-head--split"><h2 id="tracks-title">Two tracks, four papers</h2><p>The A2 papers build on the AS papers. Plan them as pairs so each A2 topic sits on the AS topic it extends.</p></div>
  <div class="tracks">
    <div class="track"><h3>Theory</h3><ol>${parts.map((p) => paperList(p).filter((x) => /1|3/.test(x.name)).map((x) => `<li><a href="/learn/${esc(p.slug)}">${esc(x.name)}: ${esc(x.title)}</a></li>`).join("")).join("")}</ol></div>
    <div class="track"><h3>Problem-solving &amp; programming</h3><ol>${parts.map((p) => paperList(p).filter((x) => /2|4/.test(x.name)).map((x) => `<li><a href="/learn/${esc(p.slug)}">${esc(x.name)}: ${esc(x.title)}</a></li>`).join("")).join("")}</ol></div>
  </div>
</div></section>
<section class="section" aria-labelledby="topics-title"><div class="wrap">
  <div class="section-head section-head--split"><h2 id="topics-title">Topic index</h2><p>All ${topics.length} topics from both years.</p></div>
  <div class="papers">${parts.map((p) => `<article class="paper-col"><p class="paper__name">${esc(p.title)}</p><ol class="topics">${q.topicsFor(p.slug).map((t) => topicRow(t, q, { showLevel: false })).join("")}</ol></article>`).join("")}</div>
</div></section>`;
  } else {
    const papers = paperList(c);
    const grouped = papers.map((p) => ({ ...p, topics: topics.filter((t) => t.paper === p.name) }));
    const loose = topics.filter((t) => !papers.some((p) => p.name === t.paper));
    if (loose.length) grouped.push({ name: "Other", title: "Other topics", topics: loose });
    papersBlock = `
<section class="section" aria-labelledby="topics-title"><div class="wrap">
  <div class="section-head section-head--split"><h2 id="topics-title">Papers and topic index</h2><p>Topics follow the syllabus order. Each topic page collects its lessons, notes and practice.</p></div>
  <div class="papers">${grouped.map((p) => `<article class="paper-col"><p class="paper__name">${esc(p.name)}</p><h3>${esc(p.title)}</h3><ol class="topics">${p.topics.map((t) => topicRow(t, q, { showLevel: false })).join("") || `<li><span></span><div class="muted small">No topics published yet.</div></li>`}</ol></article>`).join("")}</div>
</div></section>`;
  }

  const lessons = vids.length
    ? `<div class="video-grid">${vids.map((v) => videoCard(v, q)).join("")}</div>`
    : `<p class="muted">Video lessons for ${esc(courseLabel(c))} are being added. <a href="/learn/topics?level=${esc(levels[0])}">Browse the ${esc(courseLabel(c))} topics</a> in the meantime.</p>`;
  const resources = res.length
    ? `<ul class="resource-list">${res.map((r) => resourceItem(r, q)).join("")}</ul>`
    : `<p class="muted">Notes, worksheets and practice for this level will be listed here as they are approved.</p>`;
  const faqs = q.faqs("learning");

  const body = `
${pageHead({
    trail: [["Home", "/"], ["Learn", "/learn"], [c.title]],
    mod: LEVEL_MOD[slug],
    eyebrow: esc(c.audience || ""),
    title: `${esc(c.title)} Computer Science${draftTag(c)}`,
    lede: esc(c.summary),
    extra: facts,
  })}
${papersBlock}
<section class="section" aria-labelledby="lessons-title"><div class="wrap">
  <div class="section-head section-head--split"><h2 id="lessons-title">Lessons</h2><p>${vids.length ? `${plural(vids.length, "lesson")}. <a href="/videos?level=${esc(levels[0])}">Filter them in the video library</a>.` : ""}</p></div>
  ${lessons}
</div></section>
<section class="section" aria-labelledby="res-title"><div class="wrap">
  <div class="section-head section-head--split"><h2 id="res-title">Notes and practice</h2><p></p></div>
  ${resources}
</div></section>
${faqs.length ? `<section class="section" aria-labelledby="lfaq-title"><div class="wrap"><div class="section-head"><h2 id="lfaq-title">Questions about ${esc(courseLabel(c))}</h2></div>${faqBlock(faqs)}</div></section>` : ""}
<section class="section" aria-labelledby="next-title"><div class="wrap split">
  <h2 id="next-title">Want to study ${esc(courseLabel(c))} in class?</h2>
  <div><p class="lede">Ask about current ${esc(courseLabel(c))} classes and workshops.</p>
  <p><a class="btn" href="${enquireHref({ type: "class", level: slug })}">Enquire about ${esc(courseLabel(c))}</a></p></div>
</div></section>`;

  return {
    status: 200,
    html: layout(ctx, {
      title: `${c.title} Computer Science${c.codes ? ` (${c.codes})` : ""}`,
      description: `${c.title} Computer Science${c.codes ? ` ${c.codes}` : ""} with Sir MAK: papers, syllabus topics, lessons and notes. ${c.summary}`.slice(0, 300),
      path: `/learn/${slug}`,
      active: "learn",
      body,
      jsonLd: {
        "@context": "https://schema.org", "@type": "Course", name: `${c.title} Computer Science`, description: c.summary,
        provider: { "@type": "Organization", name: `${q.settings.brand} Computer Science`, url: config.siteUrl },
      },
    }),
  };
}

function resourceItem(r, q) {
  const t = r.topic ? q.topic(r.topic) : null;
  const external = /^https?:/.test(r.url);
  return `<li class="resource">
    <div><p class="eyebrow">${esc(r.type)} · ${esc(courseLabel(q.course(r.level)))}${r.paper ? ` · ${esc(r.paper)}` : ""}${draftTag(r)}</p>
    <h3 class="resource__title">${esc(r.title)}</h3>
    ${r.description ? `<p class="small">${esc(r.description)}</p>` : ""}
    ${t ? `<p class="small muted">Topic: <a href="/learn/topics/${esc(t.id)}">${esc(t.title)}</a></p>` : ""}</div>
    <a class="btn btn--ghost btn--small" href="${esc(r.url)}"${external ? ' rel="noopener" target="_blank"' : ""}>Open<span class="visually-hidden">: ${esc(r.title)}${external ? " (opens in a new tab)" : ""}</span></a>
  </li>`;
}

/* ---------- Topic library ---------- */
function topicsLibrary(ctx) {
  const q = query(ctx);
  const p = ctx.url.searchParams;
  const f = { q: (p.get("q") || "").trim(), level: p.get("level") || "", paper: p.get("paper") || "", type: p.get("type") || "" };
  const levels = q.courses.filter((c) => !(c.combines && c.combines.length));
  const papers = [...new Set(q.topics.map((t) => t.paper).filter(Boolean))].sort();
  const types = ["Video lesson", ...RESOURCE_TYPES];

  const items = q.topics.map((t) => {
    const c = q.course(t.level);
    const tTypes = [
      ...(q.videos.some((v) => v.topic === t.id) ? ["Video lesson"] : []),
      ...new Set(q.resources.filter((r) => r.topic === t.id).map((r) => r.type)),
    ];
    const search = `${t.title} ${t.keywords || ""} ${t.description || ""} ${c ? c.title : ""} ${t.paper || ""}`.toLowerCase();
    const match =
      (!f.level || t.level === f.level) && (!f.paper || t.paper === f.paper) && (!f.type || tTypes.includes(f.type)) &&
      (!f.q || f.q.toLowerCase().split(/\s+/).every((w) => search.includes(w)));
    return { t, c, tTypes, search, match };
  });
  const shown = items.filter((i) => i.match).length;
  const opt = (v, label, cur) => `<option value="${esc(v)}"${v === cur ? " selected" : ""}>${esc(label)}</option>`;

  const body = `
${pageHead({ trail: [["Home", "/"], ["Learn", "/learn"], ["Topic library"]], title: "Topic library", lede: "Every syllabus topic across O Level / IGCSE, AS and A2. Each topic page brings together its lessons, notes and practice as they are published." })}
<section class="section--tight"><div class="wrap">
  <form class="filters" data-filters="topic" role="search" aria-label="Filter topics" method="get" action="/learn/topics">
    <div class="field"><label for="f-q">Search</label><input id="f-q" name="q" type="search" value="${esc(f.q)}" placeholder="e.g. arrays, SQL, recursion"></div>
    <div class="field"><label for="f-level">Level</label><select id="f-level" name="level">${opt("", "All levels", f.level)}${levels.map((c) => opt(c.slug, c.title, f.level)).join("")}</select></div>
    <div class="field"><label for="f-paper">Paper</label><select id="f-paper" name="paper">${opt("", "All papers", f.paper)}${papers.map((x) => opt(x, x, f.paper)).join("")}</select></div>
    <div class="field"><label for="f-type">Resource type</label><select id="f-type" name="type">${opt("", "Any", f.type)}${types.map((x) => opt(x, x, f.type)).join("")}</select></div>
    <div class="field field--actions"><button class="btn btn--small" type="submit" data-js-hide>Apply</button><a class="btn btn--ghost btn--small" href="/learn/topics" data-clear-filters>Clear filters</a></div>
  </form>
  <p class="results-count" data-results-count aria-live="polite">${shown} of ${items.length} topics shown</p>
  <ol class="topics topics--library">${items.map(({ t, c, tTypes, search, match }) => `<li data-item data-level="${esc(t.level)}" data-paper="${esc(t.paper || "")}" data-types="${esc(tTypes.join("|"))}" data-search="${esc(search)}"${match ? "" : " hidden"}>
      <span class="topics__n">${esc(t.number ?? "")}</span>
      <div><a href="/learn/topics/${esc(t.id)}">${esc(t.title)}</a>${draftTag(t)} <span class="muted small">· ${esc(courseLabel(c))}${t.paper ? ` · ${esc(t.paper)}` : ""}</span>
      ${tTypes.length ? ` ${tTypes.map((x) => `<span class="status status--open">${esc(x)}</span>`).join(" ")}` : ""}
      <small>${esc(t.description || "")}</small></div>
    </li>`).join("")}</ol>
  <div class="empty" data-empty${shown ? " hidden" : ""}>
    <p><strong>No topics match those filters.</strong></p>
    <p class="muted">${f.type && f.type !== "" ? `No topic has a published “${esc(f.type)}” resource yet. ` : ""}Try a broader search or clear the filters.</p>
    <a class="btn btn--small" href="/learn/topics" data-clear-filters>Clear filters</a>
  </div>
</div></section>`;
  return ok(layout(ctx, {
    title: "Topic library",
    description: "Search and filter every Computer Science syllabus topic for O Level, IGCSE, AS and A2 Level, with linked lessons and resources.",
    path: "/learn/topics",
    active: "learn",
    body,
  }));
}

function topicPage(ctx, id) {
  const q = query(ctx);
  const t = q.topic(id);
  if (!t) return null;
  const c = q.course(t.level);
  const vids = q.videos.filter((v) => v.topic === t.id);
  const res = q.resources.filter((r) => r.topic === t.id);
  const siblings = q.topics.filter((x) => x.level === t.level && x.paper === t.paper && x.id !== t.id);
  const keywords = (t.keywords || "").split(",").map((k) => k.trim()).filter(Boolean);

  const body = `
${pageHead({
    trail: [["Home", "/"], ["Learn", "/learn"], [courseLabel(c), `/learn/${t.level}`], [t.title]],
    mod: LEVEL_MOD[t.level],
    eyebrow: `${esc(c ? c.title : "")}${t.paper ? ` · ${esc(t.paper)}` : ""}${t.number ? ` · Topic ${esc(t.number)}` : ""}`,
    title: `${esc(t.title)}${draftTag(t)}`,
    lede: esc(t.description),
    extra: `<dl class="facts">
      ${c && c.codes ? `<div><dt>Syllabus</dt><dd>${esc(c.codes)}${t.section ? `, section ${esc(t.section)}` : ""}</dd></div>` : ""}
      ${t.lastReviewed ? `<div><dt>Last reviewed</dt><dd>${esc(formatDate(t.lastReviewed))}</dd></div>` : ""}
    </dl>`,
  })}
<section class="section"><div class="wrap split">
  <div>
    <h2>What this topic covers</h2>
    ${keywords.length ? `<ul class="topic-tags">${keywords.map((k) => `<li>${esc(k)}</li>`).join("")}</ul>` : ""}
  </div>
  <div>
    <h2>Lessons</h2>
    ${vids.length ? `<div class="video-grid video-grid--2">${vids.map((v) => videoCard(v, q)).join("")}</div>` : `<p class="muted">A video lesson for this topic has not been published yet.</p>`}
    <h2 class="mt-7">Notes and practice</h2>
    ${res.length ? `<ul class="resource-list">${res.map((r) => resourceItem(r, q)).join("")}</ul>` : `<p class="muted">Notes and practice for this topic will be listed here once approved.</p>`}
    ${!vids.length && !res.length ? adminNote(ctx, `nothing is linked to this topic yet. Tag a <a href="/admin/videos">video</a> or <a href="/admin/resources">resource</a> with it.`) : ""}
  </div>
</div></section>
${siblings.length ? `<section class="section"><div class="wrap">
  <div class="section-head"><h2>More from ${esc(t.paper || courseLabel(c))}</h2></div>
  <ol class="topics topics--library">${siblings.map((x) => topicRow(x, q, { showLevel: false })).join("")}</ol>
</div></section>` : ""}
<section class="section"><div class="wrap split">
  <h2>Need help with ${esc(t.title.toLowerCase())}?</h2>
  <div><p class="lede">Ask about classes or a revision workshop for ${esc(courseLabel(c))}.</p>
  <p><a class="btn" href="${enquireHref({ type: "class", level: t.level })}">Enquire about classes</a> <a class="arrow-link" href="${enquireHref({ type: "correction", page: `/learn/topics/${t.id}` })}">Report a mistake on this page</a></p></div>
</div></section>`;

  return {
    status: 200,
    html: layout(ctx, {
      title: `${t.title} (${courseLabel(c)} Computer Science)`,
      description: `${t.title} for ${c ? c.title : ""} Computer Science${t.paper ? `, ${t.paper}` : ""}: ${t.description}`.slice(0, 300),
      path: `/learn/topics/${t.id}`,
      active: "learn",
      body,
      jsonLd: { "@context": "https://schema.org", "@type": "LearningResource", name: t.title, description: t.description, educationalLevel: c ? c.title : undefined, keywords: t.keywords },
    }),
  };
}

/* ==========================================================================
   Videos
   ========================================================================== */
function videosPage(ctx) {
  const q = query(ctx);
  const p = ctx.url.searchParams;
  const f = { q: (p.get("q") || "").trim(), level: p.get("level") || "", paper: p.get("paper") || "", topic: p.get("topic") || "" };
  const channel = q.contact("youtube");
  const opt = (v, label, cur) => `<option value="${esc(v)}"${v === cur ? " selected" : ""}>${esc(label)}</option>`;
  const levels = q.courses.filter((c) => !(c.combines && c.combines.length));
  const papers = [...new Set(q.videos.map((v) => v.paper).filter(Boolean))].sort();
  const topics = q.topics.filter((t) => q.videos.some((v) => v.topic === t.id));

  const items = q.videos.map((v) => {
    const t = v.topic ? q.topic(v.topic) : null;
    const c = q.course(v.level);
    const search = `${v.title} ${v.description || ""} ${t ? t.title + " " + (t.keywords || "") : ""} ${c ? c.title : ""} ${v.paper || ""}`.toLowerCase();
    const match = (!f.level || v.level === f.level) && (!f.paper || v.paper === f.paper) && (!f.topic || v.topic === f.topic) &&
      (!f.q || f.q.toLowerCase().split(/\s+/).every((w) => search.includes(w)));
    return { v, search, match };
  });
  const shown = items.filter((i) => i.match).length;

  const library = q.videos.length
    ? `<form class="filters" data-filters="video" role="search" aria-label="Filter videos" method="get" action="/videos">
    <div class="field"><label for="v-q">Search</label><input id="v-q" name="q" type="search" value="${esc(f.q)}" placeholder="e.g. arrays, SQL, recursion"></div>
    <div class="field"><label for="v-level">Level</label><select id="v-level" name="level">${opt("", "All levels", f.level)}${levels.map((c) => opt(c.slug, c.title, f.level)).join("")}</select></div>
    <div class="field"><label for="v-topic">Topic</label><select id="v-topic" name="topic">${opt("", "All topics", f.topic)}${topics.map((t) => opt(t.id, `${courseLabel(q.course(t.level))} · ${t.title}`, f.topic)).join("")}</select></div>
    <div class="field"><label for="v-paper">Paper</label><select id="v-paper" name="paper">${opt("", "All papers", f.paper)}${papers.map((x) => opt(x, x, f.paper)).join("")}</select></div>
    <div class="field field--actions"><button class="btn btn--small" type="submit" data-js-hide>Apply</button><a class="btn btn--ghost btn--small" href="/videos" data-clear-filters>Clear filters</a></div>
  </form>
  <p class="results-count" data-results-count aria-live="polite">${shown} of ${items.length} lessons shown</p>
  <div class="video-grid">${items.map(({ v, search, match }) => `<div data-item data-level="${esc(v.level)}" data-paper="${esc(v.paper || "")}" data-topic="${esc(v.topic || "")}" data-search="${esc(search)}"${match ? "" : " hidden"}>${videoCard(v, q, { headingLevel: 2 })}</div>`).join("")}</div>
  <div class="empty" data-empty${shown ? " hidden" : ""}>
    <p><strong>No lessons match those filters.</strong></p>
    <p class="muted">Try a broader search, or clear the filters.</p>
    <a class="btn btn--small" href="/videos" data-clear-filters>Clear filters</a>
  </div>`
    : `<div class="empty">
    <p><strong>The MAKCS video library is being prepared.</strong></p>
    <p class="muted">Each lesson is checked and matched to its syllabus topic before it is listed here. Meanwhile, the <a href="/learn/topics">topic library</a> shows every topic by level.</p>
    ${channel ? `<p><a class="btn btn--small" href="${esc(channel.value)}" rel="noopener">${esc(channel.label)}</a></p>` : ""}
    ${adminNote(ctx, `no videos are published. Open <a href="/admin/videos">Videos</a>, add each lesson's YouTube ID and publish it.${channel ? "" : " The channel link is hidden until a YouTube contact record is published in <a href=\"/admin/contacts\">Contacts &amp; social</a>."}`)}
  </div>`;

  const body = `
${pageHead({ trail: [["Home", "/"], ["Videos"]], title: "MAKCS video library", lede: "Computer Science video lessons by Sir MAK, sorted by level, syllabus topic and paper." })}
<section class="section--tight"><div class="wrap">
  ${library}
  ${channel && q.videos.length ? `<p class="small muted mt-5">More lessons on <a href="${esc(channel.value)}" rel="noopener">${esc(channel.label)}</a>.</p>` : ""}
</div></section>`;
  return ok(layout(ctx, {
    title: "MAKCS video library",
    description: "MAKCS Computer Science video lessons by Sir MAK for O Level, IGCSE, AS and A2 Level, filterable by level, topic and paper.",
    path: "/videos",
    active: "videos",
    body,
  }));
}

function videoPage(ctx, id) {
  const q = query(ctx);
  const v = q.videos.find((x) => x.id === id);
  if (!v) return null;
  const c = q.course(v.level);
  const t = v.topic ? q.topic(v.topic) : null;
  const related = q.videos.filter((x) => x.id !== v.id && (x.topic === v.topic || x.level === v.level)).slice(0, 3);
  const watchUrl = v.youtubeId ? `https://www.youtube.com/watch?v=${encodeURIComponent(v.youtubeId)}` : "";

  const player = v.youtubeId
    ? `<div class="player" data-player data-video-id="${esc(v.youtubeId)}" data-video-title="${esc(v.title)}">
        <img src="${ytThumb(v.youtubeId)}" alt="" width="480" height="360" data-yt-thumb>
        <button class="player__play" type="button" data-play><span class="player__icon" aria-hidden="true"></span><span>Play lesson<span class="visually-hidden">: ${esc(v.title)}</span></span></button>
        <p class="player__note">Plays from YouTube (privacy-enhanced mode). YouTube may set cookies once you press play.</p>
      </div>
      <div class="callout callout--bad" data-unavailable hidden><p><strong>This video seems to be unavailable.</strong> It may have been removed or made private. <a href="${enquireHref({ type: "correction", page: `/videos/${v.id}` })}">Let us know</a> and we will fix the link.</p></div>
      <p class="small"><a href="${esc(watchUrl)}" rel="noopener" target="_blank">Watch on YouTube<span class="visually-hidden"> (opens in a new tab)</span></a>${v.captions ? " · Captions available on YouTube" : ""}</p>`
    : `<div class="callout"><p><strong>This lesson has no video linked yet.</strong></p></div>`;

  const body = `
${pageHead({
    trail: [["Home", "/"], ["Videos", "/videos"], [v.title]],
    eyebrow: `${esc(c ? c.title : "")}${v.paper ? ` · ${esc(v.paper)}` : ""}${v.duration ? ` · ${esc(v.duration)}` : ""}`,
    title: `${esc(v.title)}${draftTag(v)}`,
  })}
<section class="section--tight"><div class="wrap split split--video">
  <div>${player}</div>
  <div class="prose">
    ${v.description ? v.description.split("\n").filter(Boolean).map((para) => `<p>${esc(para)}</p>`).join("") : ""}
    <dl class="facts facts--stack">
      <div><dt>Level</dt><dd><a href="/learn/${esc(v.level)}">${esc(c ? c.title : v.level)}</a></dd></div>
      ${t ? `<div><dt>Topic</dt><dd><a href="/learn/topics/${esc(t.id)}">${esc(t.title)}</a></dd></div>` : ""}
      ${v.paper ? `<div><dt>Paper</dt><dd>${esc(v.paper)}</dd></div>` : ""}
      ${v.duration ? `<div><dt>Duration</dt><dd>${esc(v.duration)}</dd></div>` : ""}
      ${v.language ? `<div><dt>Language</dt><dd>${esc(v.language)}</dd></div>` : ""}
      ${v.publishedOn ? `<div><dt>Published</dt><dd>${esc(formatDate(v.publishedOn))}</dd></div>` : ""}
    </dl>
  </div>
</div></section>
${related.length ? `<section class="section"><div class="wrap"><div class="section-head"><h2>Related lessons</h2></div><div class="video-grid">${related.map((x) => videoCard(x, q)).join("")}</div></div></section>` : ""}`;

  return {
    status: 200,
    html: layout(ctx, {
      title: v.title,
      description: (v.description || `${v.title}: a ${c ? c.title : ""} Computer Science video lesson by Sir MAK.`).slice(0, 300),
      path: `/videos/${v.id}`,
      active: "videos",
      body,
      jsonLd: v.youtubeId && v.publishedOn ? {
        "@context": "https://schema.org", "@type": "VideoObject", name: v.title, description: v.description || v.title,
        thumbnailUrl: ytThumb(v.youtubeId), uploadDate: v.publishedOn, embedUrl: `https://www.youtube-nocookie.com/embed/${v.youtubeId}`,
      } : null,
    }),
  };
}

/* ==========================================================================
   Classes & workshops
   ========================================================================== */
function offeringDetails(o, q, kind) {
  const c = q.course(o.level);
  const rows = [
    ["Level", c ? c.title : o.level],
    ["Delivery", o.mode],
    kind === "class" ? ["Days", o.days] : ["Start date", formatDate(o.startDate)],
    ["Times", kind === "class" ? o.time : o.sessionTimes],
    ["Dates", o.dateRange],
    ["Venue / joining", o.venue],
    ["Fee", o.fee],
    ["Capacity", o.capacity ? `${o.capacity} students` : ""],
  ].filter(([, v]) => v);
  const action = o.availability === "cancelled" || o.availability === "closed"
    ? ""
    : o.registrationUrl
      ? `<a class="btn btn--small" href="${esc(o.registrationUrl)}" rel="noopener">Register<span class="visually-hidden"> for ${esc(o.title)}</span></a>`
      : `<a class="btn btn--small" href="${enquireHref({ type: kind === "workshop" ? "workshop" : "class", level: o.level, ...(kind === "workshop" ? { workshop: o.id } : {}) })}">Enquire<span class="visually-hidden"> about ${esc(o.title)}</span></a>`;
  return `<article class="offer">
    <p class="paper__name">${esc(kind === "class" ? "Class" : "Workshop")} · ${esc(courseLabel(c))}${draftTag(o)}</p>
    <h3>${esc(o.title)}</h3>
    <p>${availabilityTag(o.availability)}</p>
    <dl class="facts facts--stack">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
    ${o.topics && o.topics.length ? `<p class="small"><strong>Topics</strong></p><ul class="topic-tags">${o.topics.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    ${o.conditions ? `<p class="small muted mt-4">${esc(o.conditions)}</p>` : ""}
    <p class="small muted">Details last confirmed ${esc(formatDate(o.lastConfirmed))}.</p>
    ${action}
  </article>`;
}

function classesPage(ctx) {
  const q = query(ctx);
  const s = q.settings;
  const route = contactRoute(q);
  const none = (what) => `<div class="callout"><p><strong>No ${what} are listed right now.</strong> ${route ? "Contact us for the current timetable." : "Confirmed details will be published here."}</p>
    ${route ? `<p><a class="btn btn--small" href="${enquireHref({ type: what === "workshops" ? "workshop" : "class" })}">Ask about ${what}</a></p>` : ""}</div>`;

  const body = `
${pageHead({ trail: [["Home", "/"], ["Classes & Workshops"]], title: "Classes &amp; workshops", lede: "Regular classes, online lessons, revision sessions and Paper 2 programming workshops. Times are Pakistan Standard Time." })}
<section class="section" aria-labelledby="weekly-title"><div class="wrap">
  <div class="section-head section-head--split"><h2 id="weekly-title">Classes</h2><p>${esc(s.timetableNote || "Only confirmed classes are listed. Each shows when its details were last checked.")}</p></div>
  ${q.classes.length ? `<div class="offers">${q.classes.map((c) => offeringDetails(c, q, "class")).join("")}</div>` : none("classes")}
  ${!q.classes.length ? adminNote(ctx, `3 draft class entries are waiting for confirmation in <a href="/admin/classes">Classes</a>. Publishing requires a “last confirmed” date.${route ? "" : " No contact route is configured either: see the <a href=\"/admin\">setup checklist</a>."}`) : ""}
</div></section>
<section class="section" id="workshops" aria-labelledby="ws-title"><div class="wrap">
  <div class="section-head section-head--split"><h2 id="ws-title">Workshops</h2><p>Short, focused sessions such as Paper 2 programming practice, built around exam-style questions.</p></div>
  ${q.workshops.length ? `<div class="offers">${q.workshops.map((w) => offeringDetails(w, q, "workshop")).join("")}</div>` : none("workshops")}
</div></section>
<section class="section" aria-labelledby="how-title"><div class="wrap split">
  <h2 id="how-title">How to enquire or register</h2>
  <div>
    <ol class="steps">
      <li>Choose the class or workshop for your level.</li>
      <li>Send an enquiry${q.classes.some((c) => c.registrationUrl) ? " or use its registration link" : ""}. Tell us the level and how you would like to attend.</li>
      <li>You will receive the current times, fee and joining details before anything is confirmed.</li>
    </ol>
    ${route ? `<p><a class="btn" href="${enquireHref({ type: "class" })}">Send an enquiry</a></p>` : ""}
  </div>
</div></section>
${q.faqs("classes").length ? `<section class="section" aria-labelledby="cfaq-title"><div class="wrap"><div class="section-head"><h2 id="cfaq-title">Questions about classes</h2></div>${faqBlock(q.faqs("classes"))}</div></section>` : ""}`;

  return ok(layout(ctx, {
    title: "Classes & workshops",
    description: "Sir MAK Computer Science classes and Paper 2 programming workshops for O Level, IGCSE, AS and A Level: confirmed times, delivery and how to enquire.",
    path: "/classes-workshops",
    active: "classes",
    body,
  }));
}

/* ==========================================================================
   About
   ========================================================================== */
function aboutPage(ctx) {
  const q = query(ctx);
  const s = q.settings;
  const bio = s.bioApproved && s.bio ? s.bio.split("\n").filter(Boolean) : [];
  const groups = [["education", "Education"], ["teaching", "Teaching"], ["experience", "Experience"]]
    .map(([k, label]) => [label, q.credentials.filter((c) => c.kind === k)])
    .filter(([, list]) => list.length);

  const body = `
${pageHead({ trail: [["Home", "/"], ["About"]], title: esc(s.fullName), lede: `Computer Science teacher for O Level, IGCSE, AS and A Level${s.city ? `, ${esc(s.city)}` : ""}.` })}
<section class="section"><div class="wrap profile">
  ${portrait(s)}
  <div class="prose">
    ${bio.length ? bio.map((p) => `<p>${esc(p)}</p>`).join("") : `<p>Sir Muhammad Ali Khan, known to students as Sir MAK, teaches Computer Science at O Level, IGCSE, AS and A Level.</p>`}
    ${bio.length ? "" : adminNote(ctx, `the full biography is waiting for approval. <a href="/admin/settings">Edit it and tick “approved”</a> to publish it here.`)}
    <h2>Teaching approach</h2>
    <ul class="approach">
      <li><strong>Concept first.</strong> Each topic starts from what the syllabus asks you to understand, explained plainly.</li>
      <li><strong>Then the question.</strong> Exam-style questions show how the concept is tested and how marks are earned.</li>
      <li><strong>Programming by hand and on screen.</strong> Pseudocode, trace tables and flowcharts are practised the way the problem-solving papers test them.</li>
    </ul>
    ${groups.map(([label, list]) => `<h2>${esc(label)}</h2><ul>${list.map((c) => `<li>${esc(c.text)}${draftTag(c)}</li>`).join("")}</ul>`).join("")}
    ${groups.length ? "" : adminNote(ctx, `qualifications and teaching associations are saved as drafts in <a href="/admin/credentials">Profile details</a>. Publish each one once Sir MAK approves it.`)}
    <h2>Course focus</h2>
    <p>${q.courses.map((c) => `<a href="/learn/${esc(c.slug)}">${esc(c.title)}</a>`).join(", ")}, with particular attention to programming and problem-solving.</p>
    ${q.socials.length ? `<h2>Find Sir MAK online</h2><ul>${q.socials.map((c) => `<li><a href="${esc(c.value)}" rel="noopener">${esc(c.label)}</a></li>`).join("")}</ul>` : ""}
    <p class="mt-6"><a class="btn" href="${enquireHref({ type: "class" })}">Enquire about classes</a></p>
  </div>
</div></section>`;
  return ok(layout(ctx, {
    title: "About Sir MAK",
    description: `About ${s.fullName} (Sir MAK), Computer Science teacher for O Level, IGCSE, AS and A Level.`,
    path: "/about",
    active: "about",
    body,
    jsonLd: { "@context": "https://schema.org", "@type": "Person", name: s.fullName, alternateName: "Sir MAK", jobTitle: "Computer Science teacher", url: `${config.siteUrl}/about` },
  }));
}

/* ==========================================================================
   Contact & enquiry form
   ========================================================================== */
function enquiryForm(ctx, q, prefill = {}, errors = {}) {
  const open = enquiryOpen();
  const levels = q.courses.map((c) => [c.slug, c.title]);
  const workshops = q.workshops.filter((w) => !["cancelled", "closed"].includes(w.availability));
  const sel = (name, value) => (prefill[name] === value ? " selected" : "");
  const chk = (name, value) => (prefill[name] === value ? " checked" : "");
  const err = (name) => `<p class="field__error" id="${name}-error">${esc(errors[name] || "")}</p>`;
  const inv = (name) => (errors[name] ? ' aria-invalid="true"' : "");
  const type = prefill.type || "";

  const closedNotice = open ? "" : `<div class="callout" role="note"><p><strong>Online enquiries are not open yet.</strong> ${
    q.contacts.some((c) => ["whatsapp", "phone", "email"].includes(c.kind)) ? "Please use the contact details on this page instead." : "Contact details will be published here soon."
  }</p>${adminNote(ctx, `no enquiry destination is configured, so this form is disabled. Set <code>ENQUIRY_STORE=file</code>, <code>ENQUIRY_WEBHOOK_URL</code>, or the Resend email variables, then restart the server. See README.md.`)}</div>`;

  return `${closedNotice}
<form class="enquiry" data-enquiry method="post" action="/api/enquiry" novalidate>
  <fieldset class="form-grid"${open ? "" : " disabled"}>
    <legend class="visually-hidden">Enquiry details</legend>
    <div class="field span-2"><label for="type">What is your enquiry about?</label>
      <select id="type" name="type" required aria-describedby="type-error"${inv("type")}>
        <option value="">Choose…</option>
        ${Object.entries(enquiry.TYPES).map(([k, label]) => `<option value="${k}"${sel("type", k)}>${esc(label)}</option>`).join("")}
      </select>${err("type")}</div>
    <div class="field" data-show-for="class workshop general"><label for="name">Student's name</label><input id="name" name="name" autocomplete="name" maxlength="80" value="${esc(prefill.name || "")}" aria-describedby="name-error"${inv("name")}>${err("name")}</div>
    <fieldset class="field" data-show-for="class workshop general"><legend>I am</legend>
      <div class="radio-row">${Object.entries(enquiry.ROLES).map(([k, label]) => `<label><input type="radio" name="role" value="${k}"${chk("role", k)} aria-describedby="role-error"> ${esc(label)}</label>`).join("")}</div>
      ${err("role")}
    </fieldset>
    <div class="field" data-show-for="class workshop general"><label for="level">Level <span class="muted" data-optional-for="general">(optional)</span></label><select id="level" name="level" aria-describedby="level-error"${inv("level")}><option value="">Choose…</option>${levels.map(([v, l]) => `<option value="${esc(v)}"${sel("level", v)}>${esc(l)}</option>`).join("")}</select>${err("level")}</div>
    <div class="field" data-show-for="class"><label for="mode">How would you like to attend? <span class="muted">(optional)</span></label><select id="mode" name="mode" aria-describedby="mode-error"><option value="">No preference</option>${Object.entries(enquiry.MODES).map(([k, l]) => `<option value="${k}"${sel("mode", k)}>${esc(l)}</option>`).join("")}</select>${err("mode")}</div>
    ${workshops.length ? `<div class="field" data-show-for="workshop"><label for="workshop">Which workshop? <span class="muted">(optional)</span></label><select id="workshop" name="workshop" aria-describedby="workshop-error"><option value="">Not sure yet</option>${workshops.map((w) => `<option value="${esc(w.id)}"${sel("workshop", w.id)}>${esc(w.title)}</option>`).join("")}</select>${err("workshop")}</div>` : ""}
    <div class="field" data-show-for="class workshop general correction"><label for="phone">Phone or WhatsApp <span class="muted" data-optional-for="correction">(optional)</span></label><input id="phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" maxlength="20" value="${esc(prefill.phone || "")}" aria-describedby="phone-hint phone-error"${inv("phone")}><span class="field__hint" id="phone-hint">e.g. 0300-1234567. Give a phone number, an email, or both.</span>${err("phone")}</div>
    <div class="field" data-show-for="class workshop general correction"><label for="email">Email <span class="muted">(optional)</span></label><input id="email" name="email" type="email" autocomplete="email" maxlength="120" value="${esc(prefill.email || "")}" aria-describedby="email-error"${inv("email")}>${err("email")}</div>
    <div class="field span-2" data-show-for="correction"><label for="page">Which page? <span class="muted">(optional)</span></label><input id="page" name="page" maxlength="200" value="${esc(prefill.page || "")}" aria-describedby="page-error">${err("page")}</div>
    <div class="field span-2"><label for="message">Message <span class="muted" data-optional-for="class workshop">(optional)</span></label><textarea id="message" name="message" maxlength="1000" aria-describedby="message-hint message-error"${inv("message")}>${esc(prefill.message || "")}</textarea><span class="field__hint" id="message-hint">Please don't include passwords, payment details or exam results.</span>${err("message")}</div>
    <div class="field span-2"><label class="choice"><input type="checkbox" name="consent" aria-describedby="consent-error"${prefill.consent ? " checked" : ""}> <span>I agree to be contacted about this enquiry. If the student is under 18, a parent or guardian knows about it. See the <a href="/privacy">privacy notice</a>.</span></label>${err("consent")}</div>
    <div class="hp" aria-hidden="true"><label for="website">Leave this empty</label><input id="website" name="website" tabindex="-1" autocomplete="off"></div>
    <input type="hidden" name="formToken" value="${esc(enquiry.formToken())}">
    <input type="hidden" name="submissionId" value="" data-submission-id>
    <div class="span-2"><button class="btn" type="submit" data-submit>Send enquiry</button></div>
  </fieldset>
</form>
<div class="form-result" data-form-result tabindex="-1" role="status" hidden></div>`;
}

function contactPage(ctx, { prefill, errors } = {}) {
  const q = query(ctx);
  const p = ctx.url.searchParams;
  const pre = prefill || { type: p.get("type") || "", level: p.get("level") || "", workshop: p.get("workshop") || "", page: p.get("page") || "" };
  const direct = q.contacts.filter((c) => ["whatsapp", "phone", "email", "address"].includes(c.kind));
  const hrefFor = (c) => ({
    whatsapp: `https://wa.me/${c.value}?text=${encodeURIComponent("Assalam o Alaikum, I have a question about Computer Science classes.")}`,
    phone: `tel:+${c.value}`,
    email: `mailto:${c.value}`,
  })[c.kind];

  const body = `
${pageHead({ trail: [["Home", "/"], ["Contact"]], title: "Contact and enquiries", lede: "Ask about classes and workshops, send a question, or tell us about a mistake on the site." })}
${errors ? `<div class="wrap"><div class="callout callout--bad mt-5" role="alert" tabindex="-1"><p><strong>Please check the highlighted fields.</strong> Your enquiry has not been sent yet.</p></div></div>` : ""}
<section class="section" id="enquire" aria-labelledby="enq-title"><div class="wrap split">
  <div>
    <h2 id="enq-title">Send an enquiry</h2>
    <p>Tell us the level and what you are interested in. You will get a reply with the current times, fees and availability.</p>
    <p class="small muted">We ask only for what we need to reply. Details are used for this enquiry and nothing else. See the <a href="/privacy">privacy notice</a>.</p>
    ${direct.length ? `<h3 class="mt-6">Other ways to reach us</h3><ul class="contact-list">${direct.map((c) => `<li><h4>${esc(c.label)}${draftTag(c)}</h4><p>${hrefFor(c) ? `<a href="${esc(hrefFor(c))}"${c.kind === "whatsapp" ? ' rel="noopener" target="_blank"' : ""}>${esc(c.display || c.value)}</a>` : esc(c.display || c.value).replace(/\n/g, "<br>")}</p></li>`).join("")}</ul>` : ""}
    ${direct.length ? "" : adminNote(ctx, `no phone, WhatsApp or email is published. The numbers in the planning material conflict, so they are saved as drafts in <a href="/admin/contacts">Contacts &amp; social</a> until Sir MAK confirms which to use.`)}
  </div>
  <div class="form-panel">${enquiryForm(ctx, q, pre, errors || {})}</div>
</div></section>
<section class="section" id="correction" aria-labelledby="corr-title"><div class="wrap split">
  <h2 id="corr-title">Report a mistake</h2>
  <div><p>If a lesson, link or timetable entry looks wrong, choose “Reporting a mistake on the site” in the form above and tell us which page. Corrections are checked by Sir MAK before the site is updated.</p>
  <p><a class="btn btn--ghost" href="${enquireHref({ type: "correction" })}">Report a mistake</a></p></div>
</div></section>`;
  return { status: errors ? 422 : 200, html: layout(ctx, {
    title: "Contact",
    description: "Contact Sir MAK about Computer Science classes and workshops, ask a question, or report a correction to the website.",
    path: "/contact",
    active: "contact",
    body,
  }) };
}

// Shown after a form post without JavaScript.
function enquirySent(ctx, reference) {
  const body = `
${pageHead({ trail: [["Home", "/"], ["Contact", "/contact"], ["Enquiry sent"]], title: "Thank you, your enquiry has been received.", lede: `Reference ${esc(reference)}. You will be contacted using the details you gave.` })}
<section class="section"><div class="wrap"><p><a class="btn" href="/learn">Back to learning</a></p></div></section>`;
  return ok(layout(ctx, { title: "Enquiry sent", description: "Your enquiry has been received.", path: "/contact", active: "contact", body, noindex: true }));
}

function enquiryProblem(ctx, status, heading, message) {
  const body = `
${pageHead({ trail: [["Home", "/"], ["Contact", "/contact"], ["Enquiry not sent"]], title: esc(heading), lede: esc(message) })}
<section class="section"><div class="wrap"><p><a class="btn" href="/contact#enquire">Back to the form</a></p></div></section>`;
  return { status, html: layout(ctx, { title: "Enquiry not sent", description: heading, path: "/contact", active: "contact", body, noindex: true }) };
}

/* ==========================================================================
   Policies
   ========================================================================== */
function policyPage(ctx, { path, title, description, lede, content }) {
  const body = `
${pageHead({ trail: [["Home", "/"], [title]], title: esc(title), lede })}
<section class="section"><div class="wrap prose">${content}</div></section>`;
  return ok(layout(ctx, { title, description, path, active: "", body }));
}

function privacyPage(ctx) {
  const q = query(ctx);
  const s = q.settings;
  return policyPage(ctx, {
    path: "/privacy",
    title: "Privacy",
    description: "How the Sir MAK Computer Science website collects, uses and protects enquiry data.",
    lede: `How this website handles personal information. Last updated ${esc(formatDate(s.policiesUpdated || "2026-10-30"))}.`,
    content: `
${adminNote(ctx, "these policies are a careful starting point. Have Sir MAK review them (with legal advice if needed) before launch, and update the date in <code>content/settings.json</code> (<code>policiesUpdated</code>).")}
<h2>Who we are</h2>
<p>This website is run by ${esc(s.fullName)} (“Sir MAK”) to share Computer Science lessons and information about classes and workshops.</p>
<h2>What we collect</h2>
<p>The enquiry form asks only for what is needed to reply: the type of enquiry, the student's name, whether you are a student or parent, the level, a phone number and/or email address, and an optional message. Correction reports need no name.</p>
<p>We do not ask for dates of birth, school names, addresses, exam results or payment details on this website. Please do not include them in a message.</p>
<h2>How we use it</h2>
<p>Enquiry details are used only to reply to that enquiry and arrange any class or workshop you ask about. They are not sold, shared for marketing, or added to mailing lists.</p>
<h2>Students under 18</h2>
<p>Many students are under 18. We collect the minimum information, ask that a parent or guardian knows about any enquiry, and do not publish student names, photographs, results or feedback without consent from the student and, for under-18s, a parent or guardian. There are no public student profiles.</p>
<h2>How long we keep it</h2>
<p>Enquiries are kept only as long as needed to respond and arrange classes, and are deleted on request.</p>
<h2>Third-party services</h2>
<ul>
  <li><strong>YouTube</strong>: lesson videos use YouTube's privacy-enhanced mode and load only when you press play. Once a video plays, YouTube's own privacy policy applies. Thumbnails are loaded from YouTube's image servers.</li>
  <li><strong>jsDelivr</strong>: the Python code pad downloads Python (Pyodide) from the jsDelivr network the first time you press Run. Your code runs in your browser and is never sent anywhere; it is saved only on your own device.</li>
  <li><strong>Google Fonts</strong>: typefaces are loaded from Google's servers, which receive your IP address.</li>
  <li><strong>Enquiry delivery</strong>: enquiries may be delivered by an email or form-processing service acting on our behalf.</li>
</ul>
<p>This site uses no analytics, advertising or tracking cookies. Signed-in editors receive a single security cookie for the admin area.</p>
<h2>Your choices</h2>
<p>You can ask to see, correct or delete the details you sent us using the <a href="/contact">contact page</a>.</p>`,
  });
}

function termsPage(ctx) {
  const s = query(ctx).settings;
  return policyPage(ctx, {
    path: "/terms",
    title: "Terms",
    description: "Terms of use for the Sir MAK Computer Science website, lessons and resources.",
    lede: "The terms for using this website and its learning materials.",
    content: `
<h2>Using the lessons and resources</h2>
<p>Lessons, notes and resources on this site are provided for personal study. Unless a resource says otherwise, please do not republish, sell or redistribute it. Copyright in original teaching material belongs to ${esc(s.copyrightName || s.fullName)}.</p>
<h2>Accuracy</h2>
<p>Materials are prepared carefully and reviewed, but mistakes can happen and syllabuses change. Always check your current syllabus and your school's guidance. If you find an error, please <a href="/contact#correction">report it</a>.</p>
<h2>Not affiliated with Cambridge</h2>
<p>Sir MAK is an independent teacher. Lessons follow the published Cambridge syllabuses but are not produced, approved or endorsed by Cambridge International. Syllabus names and codes are used only to identify which course a lesson supports.</p>
<h2>Classes and workshops</h2>
<p>Information about classes and workshops shows the date it was last confirmed. Fees, schedules, cancellation and refund arrangements for each class or workshop are confirmed in writing before you register, and those arrangements apply to it.</p>
<h2>External links</h2>
<p>Videos are hosted on YouTube and some links lead to other websites. We are not responsible for the content or policies of other sites.</p>
<h2>Changes</h2>
<p>These terms may be updated. The current version is always on this page.</p>`,
  });
}

function accessibilityPage(ctx) {
  return policyPage(ctx, {
    path: "/accessibility",
    title: "Accessibility",
    description: "Accessibility of the Sir MAK Computer Science website and how to report a problem.",
    lede: "This website aims to meet the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA.",
    content: `
<h2>What we have done</h2>
<ul>
  <li>Every page and form can be used with a keyboard alone, with a visible focus indicator and a “skip to content” link.</li>
  <li>Pages use headings, landmarks and labelled form fields so screen readers can navigate them.</li>
  <li>Text and controls meet AA contrast ratios, and pages reflow at narrow widths and up to 400% zoom without sideways scrolling.</li>
  <li>Animation is minimal and switched off when your device asks for reduced motion.</li>
  <li>Status labels use text as well as colour.</li>
  <li>Videos load only when you choose to play them. Where captions exist, they are available in the YouTube player.</li>
</ul>
<h2>Known limitations</h2>
<ul>
  <li>Captions for video lessons depend on YouTube; not every lesson has reviewed captions yet.</li>
  <li>Some downloadable resources may be PDFs that are not fully accessible. Ask us for an alternative format.</li>
</ul>
<h2>Report a problem</h2>
<p>If something is hard to use, please tell us through the <a href="/contact#correction">contact page</a>, saying which page and what happened. We will try to fix it or give you the information another way.</p>`,
  });
}

function notFound(ctx) {
  const body = `
<section class="section"><div class="wrap prose">
  <p class="eyebrow">Error 404</p>
  <h1>That page isn't here.</h1>
  <pre class="code" aria-hidden="true"><code><span><b class="kw">IF</b> PageExists(URL) = FALSE</span><span>   <b class="kw">THEN</b> OUTPUT "Try one of these"</span><span><b class="kw">ENDIF</b></span></code></pre>
  <p class="mt-5">The address may be mistyped, or the page may have moved. Try:</p>
  <ul>
    <li><a href="/">Home</a></li>
    <li><a href="/learn">Learn: choose your level</a></li>
    <li><a href="/learn/topics">Topic library</a></li>
    <li><a href="/videos">MAKCS video library</a></li>
    <li><a href="/classes-workshops">Classes &amp; workshops</a></li>
    <li><a href="/contact">Contact</a></li>
  </ul>
</div></section>`;
  return { status: 404, html: layout(ctx, { title: "Page not found", description: "Page not found.", path: ctx.url.pathname, active: "", body, noindex: true }) };
}

/* ==========================================================================
   Sitemap & robots
   ========================================================================== */
/* ==========================================================================
   Tools: calculators for data representation, and the Binary Blitz game
   ========================================================================== */
function toolsPage(ctx) {
  const field = (id, label, attrs = "", hint = "") => `<div class="field"><label for="${id}">${label}</label><input id="${id}" name="${id}" autocomplete="off" spellcheck="false" ${attrs}>${hint ? `<span class="field__hint">${hint}</span>` : ""}</div>`;
  const num = 'inputmode="numeric"';
  const body = `
${pageHead({
    trail: [["Home", "/"], ["Tools"]],
    title: "Calculators and games",
    lede: "Check your working on number bases, two's complement, DIV and MOD, and file sizes. Every answer shows the method, so you can follow it in the exam without a calculator.",
  })}
<section class="section--tight"><div class="wrap">
  <ul class="tool-index">
    <li><a href="#convert">Denary, binary, hex</a></li>
    <li><a href="#twos">Two's complement</a></li>
    <li><a href="#divmod">DIV and MOD</a></li>
    <li><a href="#image">Image file size</a></li>
    <li><a href="#sound">Sound file size</a></li>
    <li><a href="#blitz">Binary Blitz game</a></li>
  </ul>
  <noscript><div class="callout mb-5"><p>These calculators run in your browser and need JavaScript switched on.</p></div></noscript>
  <div class="tools">
    <section class="tool tool--wide" id="convert" aria-labelledby="convert-title">
      <h2 id="convert-title">Denary, binary and hexadecimal</h2>
      <p>Type in any box. The other two update, with the working for the box you typed in. Whole numbers from 0 to 4,294,967,295.</p>
      <form class="tool__row" data-tool="convert" novalidate>
        ${field("conv-den", "Denary (base 10)", `${num} placeholder="e.g. 202" data-base="10"`)}
        ${field("conv-bin", "Binary (base 2)", `${num} placeholder="e.g. 11001010" data-base="2"`)}
        ${field("conv-hex", "Hexadecimal (base 16)", 'placeholder="e.g. CA" data-base="16" autocapitalize="characters"')}
      </form>
      <div class="tool__out" data-out aria-live="polite"></div>
    </section>

    <section class="tool tool--teal" id="twos" aria-labelledby="twos-title">
      <h2 id="twos-title">Two's complement (8-bit)</h2>
      <p>Signed integers from −128 to 127. Enter a denary value or an 8-bit pattern.</p>
      <form class="tool__row" data-tool="twos" novalidate>
        ${field("twos-den", "Denary", 'inputmode="text" placeholder="e.g. -45"')}
        ${field("twos-bin", "8-bit pattern", `${num} placeholder="e.g. 11010011" maxlength="8"`)}
      </form>
      <div class="tool__out" data-out aria-live="polite"></div>
    </section>

    <section class="tool tool--indigo" id="divmod" aria-labelledby="divmod-title">
      <h2 id="divmod-title">DIV and MOD</h2>
      <p>Integer division and remainder, as written in Cambridge pseudocode.</p>
      <form class="tool__row" data-tool="divmod" novalidate>
        ${field("dm-a", "Number", `${num} placeholder="e.g. 17"`)}
        ${field("dm-b", "Divide by", `${num} placeholder="e.g. 5"`)}
      </form>
      <div class="tool__out" data-out aria-live="polite"></div>
    </section>

    <section class="tool" id="image" aria-labelledby="image-title">
      <h2 id="image-title">Image file size</h2>
      <p>Uncompressed bitmap: width × height × colour depth.</p>
      <form class="tool__row" data-tool="image" novalidate>
        ${field("img-w", "Width (pixels)", `${num} placeholder="e.g. 1920"`)}
        ${field("img-h", "Height (pixels)", `${num} placeholder="e.g. 1080"`)}
        ${field("img-d", "Colour depth (bits)", `${num} placeholder="e.g. 24"`)}
      </form>
      <div class="tool__out" data-out aria-live="polite"></div>
    </section>

    <section class="tool tool--teal" id="sound" aria-labelledby="sound-title">
      <h2 id="sound-title">Sound file size</h2>
      <p>Uncompressed audio: sample rate × resolution × length × channels.</p>
      <form class="tool__row" data-tool="sound" novalidate>
        ${field("snd-rate", "Sample rate (Hz)", `${num} placeholder="e.g. 44100"`)}
        ${field("snd-res", "Sample resolution (bits)", `${num} placeholder="e.g. 16"`)}
        ${field("snd-len", "Length (seconds)", 'inputmode="decimal" placeholder="e.g. 30"')}
        <div class="field"><label for="snd-ch">Channels</label><select id="snd-ch" name="snd-ch"><option value="1">Mono (1)</option><option value="2">Stereo (2)</option></select></div>
      </form>
      <div class="tool__out" data-out aria-live="polite"></div>
    </section>

    <section class="tool tool--wide tool--indigo blitz" id="blitz" aria-labelledby="blitz-title" data-blitz>
      <h2 id="blitz-title">Binary Blitz</h2>
      <p>Switch bits on and off to make the denary number. You have 60 seconds; each correct answer scores a point and brings a new number.</p>
      <div class="blitz__bar">
        <p class="blitz__stat">Time<b data-blitz-time>60</b></p>
        <p class="blitz__stat">Score<b data-blitz-score>0</b></p>
        <p class="blitz__stat">Best on this device<b data-blitz-best>0</b></p>
      </div>
      <p class="blitz__target"><small>Make this number</small><b data-blitz-target>–</b></p>
      <div class="blitz__bits" role="group" aria-label="Bits, from 128 down to 1">
        ${[128, 64, 32, 16, 8, 4, 2, 1].map((v) => `<button type="button" aria-pressed="false" data-bit="${v}" disabled><span data-bit-label>0</span><small>${v}</small><span class="visually-hidden"> place</span></button>`).join("")}
      </div>
      <p class="blitz__sum" data-blitz-sum>Your bits add up to 0</p>
      <div class="blitz__controls">
        <button class="btn" type="button" data-blitz-start>Start</button>
        <button class="btn btn--ghost" type="button" data-blitz-skip disabled>Skip number</button>
      </div>
      <p class="blitz__msg" data-blitz-msg aria-live="polite"></p>
    </section>
  </div>
</div></section>`;
  return ok(layout(ctx, {
    title: "Calculators and games",
    description: "Free Computer Science calculators with working: denary, binary and hexadecimal conversion, two's complement, DIV and MOD, image and sound file sizes, plus the Binary Blitz game.",
    path: "/tools",
    active: "tools",
    body,
    scripts: ["/assets/tools.js"],
  }));
}

/* ==========================================================================
   Code pad: write and run Python in the browser (Pyodide, in a worker)
   ========================================================================== */
const CODE_EXAMPLES = [
  ["hello", "Input and output", `# Input and output
name = input("What is your name? ")
age = int(input("How old are you? "))
print("Hello,", name)
print("Next year you will be", age + 1)
`],
  ["average", "Totals and averages", `# Total and average of the marks in a list
marks = [12, 7, 15, 10]
total = 0
for mark in marks:
    total = total + mark
average = total / len(marks)
print("Total:", total)
print("Average:", average)
`],
  ["search", "Linear search", `# Linear search: check each item until it is found
names = ["Hira", "Bilal", "Sana", "Omar", "Ayesha"]
search_name = input("Name to find: ")
found = False
index = 0
while index < len(names) and not found:
    if names[index] == search_name:
        found = True
    else:
        index = index + 1
if found:
    print(search_name, "found at position", index + 1)
else:
    print(search_name, "is not in the list")
`],
  ["bubble", "Bubble sort", `# Bubble sort: swap neighbours until no swaps are needed
numbers = [29, 4, 17, 8, 23, 1]
swapped = True
passes = 0
while swapped:
    swapped = False
    for i in range(len(numbers) - 1 - passes):
        if numbers[i] > numbers[i + 1]:
            numbers[i], numbers[i + 1] = numbers[i + 1], numbers[i]
            swapped = True
    passes = passes + 1
    print("After pass", passes, ":", numbers)
`],
  ["binary", "Denary to binary", `# Denary to binary by repeated division by 2
number = int(input("Enter a whole number: "))
binary = ""
if number == 0:
    binary = "0"
while number > 0:
    remainder = number % 2
    binary = str(remainder) + binary
    number = number // 2
print("Binary:", binary)
`],
  ["validate", "Range check", `# Validation: keep asking until the mark is between 0 and 100
mark = int(input("Enter a mark (0-100): "))
while mark < 0 or mark > 100:
    print("That mark is out of range.")
    mark = int(input("Enter a mark (0-100): "))
print("Mark accepted:", mark)
`],
  ["function", "Functions", `# A function that returns a value
def grade(mark):
    if mark >= 80:
        return "A"
    elif mark >= 65:
        return "B"
    elif mark >= 50:
        return "C"
    else:
        return "U"

for mark in [91, 70, 52, 38]:
    print(mark, "->", grade(mark))
`],
];

function codePadPage(ctx) {
  const [first] = CODE_EXAMPLES;
  const body = `
${pageHead({
    trail: [["Home", "/"], ["Code pad"]],
    title: "Python code pad",
    lede: "Write a program, run it and see the output, all in your browser. Start from one of the examples or type your own. Your code stays on this device.",
  })}
<section class="section--tight"><div class="wrap">
  <noscript><div class="callout mb-5"><p>The code pad runs Python in your browser and needs JavaScript switched on.</p></div></noscript>
  <div class="pad" data-pad>
    <div class="pad__editor">
      <div class="pad__bar">
        <span class="pad__file" aria-hidden="true">main.py</span>
        <label class="visually-hidden" for="pad-example">Example program</label>
        <select id="pad-example" class="pad__select" data-pad-example>
          <option value="">Examples…</option>
          ${CODE_EXAMPLES.map(([id, label]) => `<option value="${id}">${esc(label)}</option>`).join("")}
        </select>
        <span class="pad__spacer"></span>
        <button class="btn btn--ghost btn--small" type="button" data-pad-download>Download</button>
        <button class="btn btn--small pad__run" type="button" data-pad-run disabled>Run<span class="pad__kbd" aria-hidden="true">Ctrl ↵</span></button>
      </div>
      <div class="pad__code" data-pad-code>
        <div class="pad__gutter" aria-hidden="true" data-pad-gutter></div>
        <div class="pad__area">
          <pre class="pad__hl" aria-hidden="true"><code data-pad-hl></code></pre>
          <textarea class="pad__input" data-pad-input aria-label="Python code" aria-describedby="pad-help" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off">${esc(first[2])}</textarea>
        </div>
      </div>
      <p class="pad__help" id="pad-help">Tab indents and Shift+Tab removes indentation. To leave the editor with the keyboard, press Esc and then Tab. Ctrl+Enter (⌘+Enter on Mac) runs the program.</p>
    </div>

    <div class="pad__side">
      <div class="term" data-term>
        <div class="term__bar">
          <span class="term__title">Terminal</span>
          <span class="term__status" data-term-status aria-live="polite">Ready</span>
          <span class="pad__spacer"></span>
          <button class="term__btn" type="button" data-pad-stop disabled>Stop</button>
          <button class="term__btn" type="button" data-term-clear>Clear</button>
        </div>
        <div class="term__out" data-term-out role="log" aria-label="Program output" tabindex="0"><span class="term__hint">Press Run to start Python. The first run downloads it (about 10 MB), so it takes a few seconds; after that it is quick.</span></div>
      </div>
      <div class="field pad__stdin" data-pad-stdin hidden>
        <label for="pad-stdin">Program input</label>
        <textarea id="pad-stdin" rows="3" spellcheck="false" placeholder="One answer per line"></textarea>
        <span class="field__hint">This browser cannot pause a program to wait for typing, so write the answers to <code>input()</code> here first, one per line.</span>
      </div>
    </div>
  </div>
  <p class="small muted mt-5">Python runs entirely in your browser using <a href="https://pyodide.org" rel="noopener">Pyodide</a>, downloaded from the jsDelivr network the first time you press Run. Nothing you type is sent to this website. Modules that need the internet or files on your computer are not available.</p>
</div></section>
<script type="application/json" id="pad-examples">${JSON.stringify(Object.fromEntries(CODE_EXAMPLES.map(([id, , code]) => [id, code]))).replace(/</g, "\\u003c")}</script>`;
  return ok(layout(ctx, {
    title: "Python code pad",
    description: "Write and run Python in your browser: a code pad with a terminal, input() support and exam-style example programs for O Level, IGCSE and A Level Computer Science.",
    path: "/code-pad",
    active: "code",
    body,
    scripts: ["/assets/codepad.js"],
  }));
}

function sitemap() {
  const ctx = { preview: false };
  const q = query(ctx);
  const urls = [
    "/", "/learn", ...q.courses.map((c) => `/learn/${c.slug}`), "/learn/topics", ...q.topics.map((t) => `/learn/topics/${t.id}`),
    "/videos", ...q.videos.map((v) => `/videos/${v.id}`), "/tools", "/code-pad", "/classes-workshops", "/about", "/contact", "/privacy", "/terms", "/accessibility",
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(config.siteUrl + u)}</loc></url>`).join("\n")}
</urlset>
`;
}

const robots = () => `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: ${config.siteUrl}/sitemap.xml\n`;

module.exports = {
  home, toolsPage, codePadPage, learnIndex, levelPage, topicsLibrary, topicPage, videosPage, videoPage, classesPage, aboutPage, contactPage,
  enquirySent, enquiryProblem, privacyPage, termsPage, accessibilityPage, notFound, sitemap, robots,
};
