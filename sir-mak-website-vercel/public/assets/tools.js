// Sir MAK — calculators and the Binary Blitz game on /tools.
// Every result is built from validated numbers only, and each one shows the method.

const fmt = (n, dp = 2) => n.toLocaleString("en-GB", { maximumFractionDigits: dp });
const nibbles = (bin) => bin.replace(/(?=(?:[01]{4})+$)/g, " ").trim();
const padBin = (n, min = 8) => {
  const b = n.toString(2);
  return b.padStart(Math.max(min, Math.ceil(b.length / 4) * 4), "0");
};
const show = (out, html) => { out.innerHTML = html; };
const error = (out, text) => show(out, `<p class="tool__error">${text}</p>`);
const table = (head, rows) =>
  `<table class="tool__table"><thead><tr>${head.map((h) => `<th scope="col">${h}</th>`).join("")}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("")}</tbody></table>`;
const bitRow = (bits, places) =>
  `<div class="bits">${bits
    .split("")
    .map((b, i) => `<span><b class="${b === "1" ? "is-on" : ""}">${b}</b><small>${places[i]}</small></span>`)
    .join("")}</div>`;

/* ---------- Denary, binary and hexadecimal ---------- */
(function convert() {
  const form = document.querySelector('[data-tool="convert"]');
  if (!form) return;
  const out = form.parentElement.querySelector("[data-out]");
  const inputs = { 10: form.querySelector('[data-base="10"]'), 2: form.querySelector('[data-base="2"]'), 16: form.querySelector('[data-base="16"]') };
  const MAX = 4294967295;
  const rules = {
    10: [/^\d+$/, "Denary uses the digits 0 to 9 only."],
    2: [/^[01]+$/, "Binary uses the digits 0 and 1 only."],
    16: [/^[0-9a-f]+$/i, "Hexadecimal uses 0 to 9 and A to F only."],
  };

  function hexSteps(bin) {
    const groups = nibbles(bin).split(" ");
    return `<li>Split the binary into groups of four from the right: <code>${groups.join(" ")}</code>.</li>
      <li>Convert each group: ${groups.map((g) => `<code>${g}</code> = ${parseInt(g, 2).toString(16).toUpperCase()}`).join(", ")}.</li>`;
  }

  function steps(base, n) {
    const bin = padBin(n);
    const hex = n.toString(16).toUpperCase();
    if (base === 10) {
      const rows = [];
      let q = n;
      if (q === 0) rows.push(["0 ÷ 2", "0", "0"]);
      while (q > 0) { rows.push([`${q} ÷ 2`, String(Math.floor(q / 2)), String(q % 2)]); q = Math.floor(q / 2); }
      return `<ol class="tool__steps">
        <li>Divide by 2 repeatedly, writing down each remainder:</li></ol>
        ${table(["Division", "Quotient", "Remainder"], rows)}
        <ol class="tool__steps" start="2"><li>Read the remainders from the bottom up: <code>${n.toString(2)}</code>${bin !== n.toString(2) ? `, written as <code>${nibbles(bin)}</code>` : ""}.</li>
        ${hexSteps(bin).replace("<li>", '<li value="3">')}</ol>`;
    }
    if (base === 2) {
      const raw = n.toString(2);
      const used = raw.split("").map((b, i) => [b, 2 ** (raw.length - 1 - i)]).filter(([b]) => b === "1").map(([, v]) => v);
      return `<ol class="tool__steps">
        <li>Write the place value above each bit (1, 2, 4, 8 … from the right).</li>
        <li>Add the place values where the bit is 1: ${used.length ? `${used.join(" + ")} = <strong>${n}</strong>` : "no bits are 1, so the value is 0"}.</li>
        ${hexSteps(bin)}</ol>`;
    }
    const digits = hex.split("");
    return `<ol class="tool__steps">
      <li>Replace each hex digit with its 4-bit group: ${digits.map((d) => `${d} = <code>${parseInt(d, 16).toString(2).padStart(4, "0")}</code>`).join(", ")}.</li>
      <li>Join the groups: <code>${nibbles(bin)}</code>.</li>
      <li>For denary, multiply each digit by its place value (1, 16, 256 …): ${digits.map((d, i) => `${parseInt(d, 16)} × ${16 ** (digits.length - 1 - i)}`).join(" + ")} = <strong>${n}</strong>.</li></ol>`;
  }

  function update(base) {
    const raw = inputs[base].value.replace(/\s+/g, "");
    if (!raw) {
      for (const b of [10, 2, 16]) if (Number(b) !== base) inputs[b].value = "";
      return show(out, "");
    }
    const [re, msg] = rules[base];
    if (!re.test(raw)) { inputs[base].setAttribute("aria-invalid", "true"); return error(out, msg); }
    const n = parseInt(raw, base);
    if (n > MAX) { inputs[base].setAttribute("aria-invalid", "true"); return error(out, "That number is too large for this calculator (the limit is 4,294,967,295, or 32 bits)."); }
    inputs[base].removeAttribute("aria-invalid");
    const bin = padBin(n);
    const hex = n.toString(16).toUpperCase();
    if (base !== 10) inputs[10].value = String(n);
    if (base !== 2) inputs[2].value = bin;
    if (base !== 16) inputs[16].value = hex.padStart(2, "0");
    show(out, `<p class="tool__answer">${n}<sub>10</sub> = ${nibbles(bin)}<sub>2</sub> = ${hex.padStart(2, "0")}<sub>16</sub></p>${steps(base, n)}`);
  }
  for (const b of [10, 2, 16]) inputs[b].addEventListener("input", () => update(b));
  form.addEventListener("submit", (e) => e.preventDefault());
})();

/* ---------- Two's complement (8-bit) ---------- */
(function twos() {
  const form = document.querySelector('[data-tool="twos"]');
  if (!form) return;
  const out = form.parentElement.querySelector("[data-out]");
  const den = form.elements["twos-den"];
  const bin = form.elements["twos-bin"];
  const PLACES = [-128, 64, 32, 16, 8, 4, 2, 1];
  const flip = (b) => b.replace(/[01]/g, (c) => (c === "0" ? "1" : "0"));
  const minus = (n) => String(n).replace("-", "−");

  function fromDenary() {
    const raw = den.value.trim().replace("−", "-");
    if (!raw) { bin.value = ""; return show(out, ""); }
    if (!/^-?\d+$/.test(raw)) { den.setAttribute("aria-invalid", "true"); return error(out, "Enter a whole number, such as -45 or 72."); }
    const n = Number(raw);
    if (n < -128 || n > 127) { den.setAttribute("aria-invalid", "true"); return error(out, "8-bit two's complement holds −128 to 127 only."); }
    den.removeAttribute("aria-invalid");
    const pattern = ((n + 256) % 256).toString(2).padStart(8, "0");
    bin.value = pattern;
    let method;
    if (n >= 0) {
      method = `<ol class="tool__steps"><li>The number is positive, so write it in ordinary 8-bit binary: <code>${pattern}</code>.</li><li>The left-most bit is 0, which marks it as positive.</li></ol>`;
    } else {
      const pos = Math.abs(n).toString(2).padStart(8, "0");
      const flipped = flip(pos);
      method = `<ol class="tool__steps">
        <li>Write the positive value, ${Math.abs(n)}, in 8-bit binary: <code>${pos}</code>.</li>
        <li>Flip every bit: <code>${flipped}</code>.</li>
        <li>Add 1: <code>${flipped}</code> + 1 = <code>${pattern}</code>.</li>
        <li>Check: −128 + ${n + 128} = ${minus(n)}.</li></ol>`;
    }
    show(out, `<p class="tool__answer">${minus(n)} = ${pattern}</p>${bitRow(pattern, PLACES)}${method}`);
  }

  function fromBinary() {
    const raw = bin.value.replace(/\s+/g, "");
    if (!raw) { den.value = ""; return show(out, ""); }
    if (!/^[01]{1,8}$/.test(raw)) { bin.setAttribute("aria-invalid", "true"); return error(out, "Enter up to 8 bits, using 0 and 1 only."); }
    if (raw.length < 8) { bin.removeAttribute("aria-invalid"); return show(out, `<p class="muted">Keep going: ${8 - raw.length} more bit${raw.length === 7 ? "" : "s"} to make 8.</p>`); }
    bin.removeAttribute("aria-invalid");
    const parts = raw.split("").map((b, i) => (b === "1" ? PLACES[i] : 0)).filter(Boolean);
    const n = parts.reduce((a, b) => a + b, 0);
    den.value = String(n);
    show(out, `<p class="tool__answer">${raw} = ${minus(n)}</p>${bitRow(raw, PLACES)}
      <ol class="tool__steps"><li>In two's complement the left-most bit is worth −128.</li>
      <li>Add the place values where the bit is 1: ${parts.length ? `${minus(parts.join(" + ").replace(/\+ -/g, "− "))} = <strong>${minus(n)}</strong>` : "no bits are 1, so the value is 0"}.</li></ol>`);
  }
  den.addEventListener("input", fromDenary);
  bin.addEventListener("input", fromBinary);
  form.addEventListener("submit", (e) => e.preventDefault());
})();

/* ---------- DIV and MOD ---------- */
(function divmod() {
  const form = document.querySelector('[data-tool="divmod"]');
  if (!form) return;
  const out = form.parentElement.querySelector("[data-out]");
  const a = form.elements["dm-a"];
  const b = form.elements["dm-b"];
  function update() {
    if (!a.value.trim() || !b.value.trim()) return show(out, "");
    if (!/^\d+$/.test(a.value.trim()) || !/^\d+$/.test(b.value.trim())) return error(out, "Use whole numbers of 0 or more.");
    const x = Number(a.value), y = Number(b.value);
    if (y === 0) return error(out, "You cannot divide by 0.");
    const q = Math.floor(x / y), r = x % y;
    show(out, `<p class="tool__answer">DIV(${x}, ${y}) = ${q}<br>MOD(${x}, ${y}) = ${r}</p>
      <ol class="tool__steps"><li>${y} goes into ${x} a whole ${q} time${q === 1 ? "" : "s"}: that is DIV.</li>
      <li>What is left over is the remainder: ${x} − ${q} × ${y} = ${r}. That is MOD.</li>
      <li>Check: ${q} × ${y} + ${r} = ${x}.</li></ol>`);
  }
  form.addEventListener("input", update);
  form.addEventListener("submit", (e) => e.preventDefault());
})();

/* ---------- File sizes ---------- */
function sizeReport(bits, formula) {
  const bytes = bits / 8;
  return `<p class="tool__answer">${fmt(bytes, 0)} bytes</p>
    <ol class="tool__steps"><li>${formula} = ${fmt(bits, 0)} bits.</li>
    <li>Divide by 8 for bytes: ${fmt(bits, 0)} ÷ 8 = ${fmt(bytes, 2)} bytes.</li>
    <li>Divide by 1024 for kibibytes: ${fmt(bytes / 1024)} KiB, and again for mebibytes: ${fmt(bytes / 1024 ** 2)} MiB.</li>
    <li>If the question uses powers of 10 instead: ${fmt(bytes / 1000)} kB, or ${fmt(bytes / 1e6)} MB.</li></ol>`;
}

(function imageSize() {
  const form = document.querySelector('[data-tool="image"]');
  if (!form) return;
  const out = form.parentElement.querySelector("[data-out]");
  form.addEventListener("input", () => {
    const vals = ["img-w", "img-h", "img-d"].map((n) => form.elements[n].value.trim());
    if (vals.some((v) => !v)) return show(out, "");
    if (vals.some((v) => !/^\d+$/.test(v) || Number(v) === 0)) return error(out, "Use whole numbers greater than 0.");
    const [w, h, d] = vals.map(Number);
    show(out, sizeReport(w * h * d, `${fmt(w, 0)} × ${fmt(h, 0)} × ${d}`) + `<p class="small muted">${d}-bit colour gives 2<sup>${d}</sup> = ${d <= 32 ? fmt(2 ** d, 0) : "a very large number of"} possible colours.</p>`);
  });
  form.addEventListener("submit", (e) => e.preventDefault());
})();

(function soundSize() {
  const form = document.querySelector('[data-tool="sound"]');
  if (!form) return;
  const out = form.parentElement.querySelector("[data-out]");
  form.addEventListener("input", () => {
    const rate = form.elements["snd-rate"].value.trim();
    const res = form.elements["snd-res"].value.trim();
    const len = form.elements["snd-len"].value.trim();
    const ch = Number(form.elements["snd-ch"].value);
    if (!rate || !res || !len) return show(out, "");
    if (!/^\d+$/.test(rate) || !/^\d+$/.test(res) || !/^\d+(\.\d+)?$/.test(len) || !Number(rate) || !Number(res) || !Number(len)) return error(out, "Use numbers greater than 0. The length can have a decimal point.");
    show(out, sizeReport(Number(rate) * Number(res) * Number(len) * ch, `${fmt(Number(rate), 0)} × ${res} × ${len} × ${ch}`));
  });
  form.addEventListener("submit", (e) => e.preventDefault());
})();

/* ---------- Binary Blitz ---------- */
(function blitz() {
  const root = document.querySelector("[data-blitz]");
  if (!root) return;
  const $ = (s) => root.querySelector(s);
  const bits = [...root.querySelectorAll("[data-bit]")];
  const el = { time: $("[data-blitz-time]"), score: $("[data-blitz-score]"), best: $("[data-blitz-best]"), target: $("[data-blitz-target]"), sum: $("[data-blitz-sum]"), msg: $("[data-blitz-msg]"), start: $("[data-blitz-start]"), skip: $("[data-blitz-skip]") };
  const LENGTH = 60;
  let target = 0, score = 0, endsAt = 0, timer = 0, locked = false;
  let best = 0;
  try { best = Number(localStorage.getItem("blitz-best")) || 0; } catch { /* no storage: best stays 0 */ }
  el.best.textContent = best;

  const value = () => bits.reduce((sum, b) => sum + (b.getAttribute("aria-pressed") === "true" ? Number(b.dataset.bit) : 0), 0);
  const asBinary = (n) => n.toString(2).padStart(8, "0");
  function setBit(b, on) {
    b.setAttribute("aria-pressed", String(on));
    b.querySelector("[data-bit-label]").textContent = on ? "1" : "0";
  }
  function newTarget() {
    let n;
    do { n = 1 + Math.floor(Math.random() * 255); } while (n === target);
    target = n;
    el.target.textContent = n;
    bits.forEach((b) => setBit(b, false));
    el.sum.textContent = "Your bits add up to 0";
    root.classList.remove("is-hit");
    locked = false;
  }
  function tick() {
    const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
    el.time.textContent = left;
    if (left === 0) finish();
  }
  function start() {
    score = 0;
    el.score.textContent = 0;
    el.msg.textContent = "";
    endsAt = Date.now() + LENGTH * 1000;
    bits.forEach((b) => { b.disabled = false; });
    el.skip.disabled = false;
    el.start.textContent = "Restart";
    newTarget();
    clearInterval(timer);
    timer = setInterval(tick, 250);
    tick();
    bits[0].focus();
  }
  function finish() {
    clearInterval(timer);
    bits.forEach((b) => { b.disabled = true; });
    el.skip.disabled = true;
    el.start.textContent = "Play again";
    let msg = `Time's up. You scored ${score}.`;
    if (score > best) {
      best = score;
      el.best.textContent = best;
      msg += " That's a new best on this device.";
      try { localStorage.setItem("blitz-best", String(best)); } catch { /* not saved */ }
    }
    el.msg.textContent = msg;
    el.start.focus();
  }
  bits.forEach((b) =>
    b.addEventListener("click", () => {
      if (locked) return;
      setBit(b, b.getAttribute("aria-pressed") !== "true");
      const v = value();
      el.sum.textContent = `Your bits add up to ${v}`;
      if (v === target) {
        locked = true;
        score++;
        el.score.textContent = score;
        el.msg.textContent = `Correct: ${target} = ${asBinary(target)}.`;
        root.classList.add("is-hit");
        setTimeout(() => { if (Date.now() < endsAt) newTarget(); }, 650);
      }
    })
  );
  el.start.addEventListener("click", start);
  el.skip.addEventListener("click", () => {
    el.msg.textContent = `Skipped: ${target} = ${asBinary(target)}.`;
    newTarget();
  });
})();
