// Code pad worker: runs a student's Python with Pyodide, away from the page so a stuck loop
// can always be stopped. Messages in: { type: "run", code, io, irq, lines }.
// Messages out: status, start, out, input, done, error, fatal.
//
// When the page is cross-origin isolated, `io` and `irq` are SharedArrayBuffers:
//   io  = [Int32 flag, Int32 length, ...UTF-8 bytes]. input() posts "input" and waits on the flag
//         until the page writes the typed line (length -1 means end of input).
//   irq = Pyodide's interrupt buffer; the page writes 2 to raise KeyboardInterrupt.
// Without isolation, input() reads from `lines`, typed in advance.

const PYODIDE = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
importScripts(`${PYODIDE}pyodide.js`);

let py = null;
let io = null;
let lines = [];
let pending = "";
let lastFlush = 0;
const decoders = { out: new TextDecoder(), err: new TextDecoder() };

function flush() {
  if (pending) postMessage({ type: "out", stream: "out", text: pending });
  pending = "";
  lastFlush = performance.now();
}
// Output is sent in small batches so a fast loop cannot flood the page with messages.
function write(stream, bytes) {
  const text = decoders[stream].decode(bytes, { stream: true });
  if (stream === "err") { flush(); postMessage({ type: "out", stream: "err", text }); return bytes.length; }
  pending += text;
  if (pending.length > 4096 || performance.now() - lastFlush > 40) flush();
  return bytes.length;
}

function readLine() {
  flush();
  if (io) {
    const ctl = new Int32Array(io, 0, 2);
    postMessage({ type: "input" });
    Atomics.wait(ctl, 0, 0);
    const len = ctl[1];
    const text = len < 0 ? null : new TextDecoder().decode(new Uint8Array(io, 8, len).slice());
    Atomics.store(ctl, 0, 0);
    return text === null ? null : `${text}\n`;
  }
  if (!lines.length) return null;
  const line = lines.shift();
  postMessage({ type: "out", stream: "echo", text: `${line}\n` });
  return `${line}\n`;
}

// Keep only the part of a traceback that points at the student's own code.
function tidy(message) {
  const all = String(message).replace(/<exec>/g, "main.py").split("\n");
  const start = all.findIndex((l) => l.includes('File "main.py"'));
  if (start === -1) return all.filter((l) => l.trim()).pop() || String(message); // just the error line
  return ["Traceback (most recent call last):", ...all.slice(start)].join("\n").trim();
}

async function load() {
  postMessage({ type: "status", text: "loading" });
  py = await loadPyodide({ indexURL: PYODIDE });
  py.setStdout({ write: (b) => write("out", b) });
  py.setStderr({ write: (b) => write("err", b) });
  py.setStdin({ stdin: readLine });
}

self.onmessage = async ({ data }) => {
  if (data.type !== "run") return;
  try {
    if (!py) await load();
  } catch (err) {
    postMessage({ type: "fatal", text: "Python could not be downloaded. Check your internet connection and try again." });
    return;
  }
  io = data.io || null;
  lines = (data.lines || []).slice();
  if (data.irq) py.setInterruptBuffer(new Int32Array(data.irq));
  postMessage({ type: "start" });
  const started = performance.now();
  const ns = py.globals.get("dict")();
  ns.set("__name__", "__main__");
  try {
    py.runPython(data.code, { globals: ns, filename: "main.py" });
    flush();
    postMessage({ type: "done", ms: performance.now() - started });
  } catch (err) {
    flush();
    const text = tidy(err.message);
    postMessage({ type: "error", text, interrupted: /KeyboardInterrupt/.test(text), eof: /EOFError/.test(text) });
  } finally {
    ns.destroy();
  }
};
