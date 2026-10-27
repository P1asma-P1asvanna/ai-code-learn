/* ตัวรัน Python ในเบราว์เซอร์ผู้ใช้ด้วย Pyodide (WebAssembly) — โหลดจาก CDN ครั้งแรกประมาณ 10 MB แล้วเบราว์เซอร์จะแคชไว้
   หมายเหตุ: input() ยังใช้ไม่ได้ (จะเกิด EOFError) */

const PYODIDE_VERSION = "0.27.7";
const INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

importScripts(`${INDEX_URL}pyodide.js`);

let pyodidePromise = null;

function getPyodide() {
  if (!pyodidePromise) {
    pyodidePromise = loadPyodide({ indexURL: INDEX_URL }).catch((error) => {
      pyodidePromise = null; // ให้ลองโหลดใหม่ได้ถ้าเน็ตหลุดตอนโหลดครั้งแรก
      throw error;
    });
  }
  return pyodidePromise;
}

/* ตัดบรรทัด traceback ภายในของ Pyodide ออก ให้เหลือเฉพาะส่วนที่เกี่ยวกับโค้ดของผู้เรียน */
function cleanTraceback(message) {
  const lines = String(message).split("\n");
  const kept = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isInternalFrame =
      /^\s*File "(\/lib\/python[^"]*|[^"]*_pyodide[^"]*)"/.test(line) ||
      /^\s*File "[^"]*pyodide[^"]*", line/.test(line);
    if (isInternalFrame) {
      // ข้ามบรรทัดโค้ดที่ตามหลัง frame นั้นด้วย
      while (i + 1 < lines.length && /^\s{4,}/.test(lines[i + 1])) i++;
      continue;
    }
    kept.push(line);
  }
  return kept.join("\n").trim();
}

self.onmessage = async (event) => {
  const { id, code } = event.data;
  const send = (type, text) => self.postMessage({ id, type, text });

  try {
    const pyodide = await getPyodide();
    pyodide.setStdout({ batched: (line) => send("stdout", line) });
    pyodide.setStderr({ batched: (line) => send("stderr", line) });

    self.postMessage({ id, type: "started" });

    // namespace ใหม่ทุกครั้ง ตัวแปรจากการรันก่อนหน้าจะไม่ค้าง
    const namespace = pyodide.globals.get("dict")();
    try {
      await pyodide.runPythonAsync(code, { globals: namespace });
    } finally {
      namespace.destroy();
    }
    self.postMessage({ id, type: "done" });
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    send("error", cleanTraceback(message));
  }
};
