// Sir MAK — Python code pad on /code-pad.
// The editor is a plain textarea (so typing, undo and screen readers behave normally) laid over a
// highlighted copy of the same text. Programs run in codepad-worker.js.

(function codePad() {
  const root = document.querySelector("[data-pad]");
  if (!root) return;
  const $ = (s) => root.querySelector(s);
  const input = $("[data-pad-input]");
  const hl = $("[data-pad-hl]");
  const gutter = $("[data-pad-gutter]");
  const runBtn = $("[data-pad-run]");
  const stopBtn = $("[data-pad-stop]");
  const out = $("[data-term-out]");
  const status = $("[data-term-status]");
  const stdinBox = $("[data-pad-stdin]");
  const examples = JSON.parse(document.getElementById("pad-examples").textContent);
  const STORE_KEY = "codepad-code";
  const OUTPUT_LIMIT = 200000;
  const INDENT = "    ";

  /* ---------- Highlighting ---------- */
  const KEYWORDS = "and|as|assert|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield|True|False|None";
  const BUILTINS = "print|input|int|float|str|len|range|list|dict|set|tuple|bool|abs|round|min|max|sum|sorted|enumerate|zip|open|type|ord|chr|bin|hex|oct|divmod|pow|isinstance|map|filter|any|all|reversed";
  const TOKENS = new RegExp(
    [
      "(#.*)",
      "(\"\"\"[\\s\\S]*?(?:\"\"\"|$)|'''[\\s\\S]*?(?:'''|$)|[rbfRBF]{0,2}\"(?:\\\\.|[^\"\\\\\\n])*\"?|[rbfRBF]{0,2}'(?:\\\\.|[^'\\\\\\n])*'?)",
      "(\\b(?:def|class)\\b)(\\s+)([A-Za-z_]\\w*)",
      `\\b(${KEYWORDS})\\b`,
      `\\b(${BUILTINS})\\b(?=\\s*\\()`,
      "\\b(\\d+(?:\\.\\d+)?)\\b",
    ].join("|"),
    "g"
  );
  const escHtml = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
  function highlight(code) {
    let html = "";
    let last = 0;
    code.replace(TOKENS, (m, cm, str, defKw, defSp, defName, kw, bi, num, offset) => {
      html += escHtml(code.slice(last, offset));
      if (cm) html += `<span class="tk-cm">${escHtml(cm)}</span>`;
      else if (str) html += `<span class="tk-str">${escHtml(str)}</span>`;
      else if (defKw) html += `<span class="tk-kw">${defKw}</span>${defSp}<span class="tk-def">${defName}</span>`;
      else if (kw) html += `<span class="tk-kw">${kw}</span>`;
      else if (bi) html += `<span class="tk-bi">${bi}</span>`;
      else if (num) html += `<span class="tk-num">${num}</span>`;
      last = offset + m.length;
      return m;
    });
    return html + escHtml(code.slice(last));
  }

  /* ---------- Editor ---------- */
  const gutterInner = document.createElement("div");
  gutter.appendChild(gutterInner);
  let lineCount = 0;

  function render() {
    const code = input.value;
    hl.innerHTML = highlight(code) + (code.endsWith("\n") || !code ? " " : "");
    const n = code.split("\n").length;
    if (n !== lineCount) {
      lineCount = n;
      gutterInner.textContent = Array.from({ length: n }, (_, i) => i + 1).join("\n");
    }
    syncScroll();
  }
  function syncScroll() {
    hl.style.transform = `translate(${-input.scrollLeft}px, ${-input.scrollTop}px)`;
    gutterInner.style.transform = `translateY(${-input.scrollTop}px)`;
  }

  // Insert through execCommand where possible so Ctrl+Z still undoes it.
  function insert(text) {
    input.focus();
    // An empty insertText misplaces the caret in Chromium, so deletions use "delete".
    const done = text ? document.execCommand("insertText", false, text) : input.selectionStart === input.selectionEnd || document.execCommand("delete");
    if (!done) {
      input.setRangeText(text, input.selectionStart, input.selectionEnd, "end");
      input.dispatchEvent(new Event("input"));
    }
  }
  function changeLines(fn) {
    const v = input.value;
    const start = v.lastIndexOf("\n", input.selectionStart - 1) + 1;
    let endPos = input.selectionEnd;
    if (endPos > input.selectionStart && v[endPos - 1] === "\n") endPos--;
    const nl = v.indexOf("\n", endPos);
    const end = nl === -1 ? v.length : nl;
    const block = v.slice(start, end);
    const next = block.split("\n").map(fn).join("\n");
    if (next === block) return;
    input.setSelectionRange(start, end);
    insert(next);
    input.setSelectionRange(start, start + next.length);
  }
  const dedent = (l) => l.replace(new RegExp(`^ {1,${INDENT.length}}`), "");

  let escaped = false;
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { escaped = true; return; }
    if (e.key === "Tab" && escaped) { escaped = false; return; } // let focus leave the editor
    escaped = false;
    const { selectionStart: s, selectionEnd: end, value: v } = input;
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); run(); return; }
    if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) changeLines(dedent);
      else if (v.slice(s, end).includes("\n")) changeLines((l) => (l ? INDENT + l : l));
      else insert(INDENT.slice((s - v.lastIndexOf("\n", s - 1) - 1) % INDENT.length));
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      const line = v.slice(v.lastIndexOf("\n", s - 1) + 1, s);
      let indent = line.match(/^ */)[0];
      if (/:\s*(#.*)?$/.test(line)) indent += INDENT;
      insert(`\n${indent}`);
      return;
    }
    if (e.key === "Backspace" && s === end && s > 0) {
      const line = v.slice(v.lastIndexOf("\n", s - 1) + 1, s);
      if (line.length && /^ +$/.test(line)) {
        e.preventDefault();
        input.setSelectionRange(s - (((line.length - 1) % INDENT.length) + 1), s);
        insert("");
      }
    }
  });

  let saveTimer = 0;
  input.addEventListener("input", () => {
    render();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { localStorage.setItem(STORE_KEY, input.value); } catch { /* not saved */ } }, 400);
  });
  input.addEventListener("scroll", syncScroll, { passive: true });

  try {
    const saved = localStorage.getItem(STORE_KEY);
    if (saved) input.value = saved;
  } catch { /* storage blocked: start from the first example */ }
  render();

  $("[data-pad-example]").addEventListener("change", (e) => {
    const code = examples[e.target.value];
    e.target.value = "";
    if (!code) return;
    const edited = input.value.trim() && !Object.values(examples).includes(input.value);
    if (edited && !window.confirm("Replace your code with this example? Download it first if you want to keep it.")) return;
    input.focus();
    input.select();
    insert(code);
    input.setSelectionRange(0, 0);
    input.scrollTop = 0;
    syncScroll();
  });

  $("[data-pad-download]").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([input.value], { type: "text/x-python" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "main.py" });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  /* ---------- Terminal ---------- */
  let printed = 0;
  let inputEl = null;
  const nearBottom = () => out.scrollHeight - out.scrollTop - out.clientHeight < 40;
  function print(text, cls) {
    if (cls === "term__sys") text = text.trim(); // these are block-level notes; no extra blank lines
    const stick = nearBottom();
    const node = cls ? Object.assign(document.createElement("span"), { className: cls, textContent: text }) : document.createTextNode(text);
    out.insertBefore(node, inputEl);
    printed += text.length;
    if (stick) out.scrollTop = out.scrollHeight;
  }
  function setStatus(text, kind = "") {
    status.textContent = text;
    status.className = `term__status${kind ? ` is-${kind}` : ""}`;
  }
  $("[data-term-clear]").addEventListener("click", () => {
    [...out.childNodes].forEach((n) => { if (n !== inputEl) n.remove(); });
    printed = 0;
    if (inputEl) inputEl.focus();
  });

  /* ---------- Running ---------- */
  const isolated = window.crossOriginIsolated === true && typeof SharedArrayBuffer === "function";
  if (!isolated) stdinBox.hidden = false;
  const io = isolated ? new SharedArrayBuffer(8 + 65536) : null;
  const irq = isolated ? new SharedArrayBuffer(4) : null;
  let worker = null;
  let state = "idle"; // idle | loading | running
  let stopping = false;
  let killTimer = 0;

  function sendLine(text) {
    const ctl = new Int32Array(io, 0, 2);
    if (text === null) ctl[1] = -1;
    else {
      const bytes = new TextEncoder().encode(text).slice(0, 65536);
      new Uint8Array(io, 8, bytes.length).set(bytes);
      ctl[1] = bytes.length;
    }
    Atomics.store(ctl, 0, 1);
    Atomics.notify(ctl, 0);
  }
  function askForInput() {
    setStatus("Waiting for input", "busy");
    inputEl = Object.assign(document.createElement("input"), { className: "term__in", type: "text", autocomplete: "off", spellcheck: false });
    inputEl.setAttribute("aria-label", "Type your answer and press Enter");
    out.appendChild(inputEl);
    out.scrollTop = out.scrollHeight;
    inputEl.focus();
    inputEl.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const value = inputEl.value;
      inputEl.remove();
      inputEl = null;
      print(`${value}\n`, "term__echo");
      setStatus("Running…", "busy");
      sendLine(value);
    });
  }
  function finish() {
    state = "idle";
    stopping = false;
    clearTimeout(killTimer);
    if (inputEl) { inputEl.remove(); inputEl = null; }
    runBtn.disabled = false;
    runBtn.classList.remove("is-loading");
    stopBtn.disabled = true;
  }
  function kill(message) {
    if (worker) worker.terminate();
    worker = null;
    print(`\n${message}\n`, "term__sys");
    setStatus("Stopped", "bad");
    finish();
  }

  function onMessage({ data }) {
    switch (data.type) {
      case "status":
        setStatus("Downloading Python…", "busy");
        print("Downloading Python. This happens once and takes a few seconds.\n", "term__sys");
        break;
      case "start":
        state = "running";
        runBtn.classList.remove("is-loading");
        setStatus("Running…", "busy");
        break;
      case "out":
        print(data.text, data.stream === "err" ? "term__err" : data.stream === "echo" ? "term__echo" : "");
        if (printed > OUTPUT_LIMIT) kill("Output limit reached, so the program was stopped. Is there a loop that never ends?");
        break;
      case "input":
        askForInput();
        break;
      case "done":
        print("Program finished.", "term__sys");
        setStatus("Finished", "ok");
        finish();
        break;
      case "error":
        if (stopping || data.interrupted) {
          print("\nProgram stopped.\n", "term__sys");
          setStatus("Stopped", "bad");
        } else {
          print(`${data.text}\n`, "term__err");
          if (data.eof && !isolated) print("The program asked for more input than you gave it. Add answers in the Program input box, one per line.\n", "term__sys");
          setStatus("Error", "bad");
        }
        finish();
        break;
      case "fatal":
        print(`${data.text}\n`, "term__err");
        setStatus("Could not start", "bad");
        if (worker) worker.terminate();
        worker = null;
        finish();
        break;
    }
  }

  function run() {
    if (state !== "idle") return;
    if (!worker) {
      worker = new Worker("/assets/codepad-worker.js");
      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", () => onMessage({ data: { type: "fatal", text: "Python could not be started in this browser." } }));
    }
    out.textContent = "";
    printed = 0;
    state = "loading";
    runBtn.disabled = true;
    runBtn.classList.add("is-loading");
    stopBtn.disabled = false;
    setStatus("Starting…", "busy");
    if (isolated) { new Int32Array(irq)[0] = 0; Atomics.store(new Int32Array(io, 0, 2), 0, 0); }
    const lines = isolated ? [] : document.getElementById("pad-stdin").value.split(/\r?\n/);
    if (lines.length && lines[lines.length - 1] === "") lines.pop();
    worker.postMessage({ type: "run", code: input.value, io, irq, lines });
  }

  function stop() {
    if (state === "idle") return;
    if (state === "loading" || !isolated) { kill("Program stopped."); return; }
    stopping = true;
    new Int32Array(irq)[0] = 2; // KeyboardInterrupt at the next line of Python
    if (inputEl) sendLine(null); // release a program that is waiting for input
    killTimer = setTimeout(() => kill("Program stopped."), 1500); // in case Python is stuck outside our reach
  }

  runBtn.addEventListener("click", run);
  stopBtn.addEventListener("click", stop);
  runBtn.disabled = false;
})();
