/* ตัวรัน Python ในเบราว์เซอร์ผู้ใช้ด้วย Pyodide (WebAssembly) — โหลดจาก CDN ครั้งแรกประมาณ 10 MB แล้วเบราว์เซอร์จะแคชไว้
   หมายเหตุ: input() ยังใช้ไม่ได้ (จะเกิด EOFError) */

const PYODIDE_VERSION = "0.27.7";
const INDEX_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;

importScripts(`${INDEX_URL}pyodide.js`);

let pyodidePromise = null;
let turtleReady = false;

/* ติดตั้งโมดูล turtle (วาดภาพ) ลงใน Pyodide — ถ้าโหลดไม่ได้ก็ข้ามไป โค้ด Python ปกติยังรันได้ตามเดิม
   (import turtle จะขึ้น ModuleNotFoundError แทน) */
async function installTurtle(pyodide) {
  if (turtleReady) return;
  try {
    const response = await fetch("/workers/turtle.py");
    if (!response.ok) return;
    pyodide.globals.set("_turtle_src", await response.text());
    pyodide.runPython(
      "import sys, types\n" +
        "_m = types.ModuleType('turtle')\n" +
        "exec(_turtle_src, _m.__dict__)\n" +
        "sys.modules['turtle'] = _m\n" +
        "del _m, _turtle_src\n",
    );
    turtleReady = true;
  } catch (error) {
    /* ข้าม */
  }
}

/* ดึงภาพที่วาดไว้ (ถ้ามี) ส่งให้หน้าเว็บ */
function sendDrawing(pyodide, id) {
  if (!turtleReady) return;
  try {
    const json = pyodide.runPython("import sys\n_t = sys.modules.get('turtle')\n_t._take() if _t else None");
    if (json) self.postMessage({ id, type: "draw", drawing: JSON.parse(json) });
  } catch (error) {
    /* ภาพวาดเสียก็ไม่กระทบผลลัพธ์ข้อความ */
  }
}

/* ตัวรัน SQL: ใช้ sqlite3 ของ Python (ใน Pyodide ต้องโหลดแพ็กเกจ sqlite3 ก่อน) และโค้ดจาก /workers/sqlrun.py */
let sqlReady = false;
async function installSql(pyodide) {
  if (sqlReady) return;
  await pyodide.loadPackage("sqlite3");
  const response = await fetch("/workers/sqlrun.py");
  if (!response.ok) throw new Error("โหลดตัวรัน SQL ไม่สำเร็จ");
  pyodide.globals.set("_sql_src", await response.text());
  pyodide.runPython(
    "import sys, types\n" +
      "_m = types.ModuleType('sqlrun')\n" +
      "exec(_sql_src, _m.__dict__)\n" +
      "sys.modules['sqlrun'] = _m\n" +
      "del _m, _sql_src\n",
  );
  sqlReady = true;
}

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
  const { id, code, language } = event.data;
  const send = (type, text) => self.postMessage({ id, type, text });

  try {
    const pyodide = await getPyodide();
    pyodide.setStdout({ batched: (line) => send("stdout", line) });
    pyodide.setStderr({ batched: (line) => send("stderr", line) });

    if (language === "sql") {
      await installSql(pyodide);
      self.postMessage({ id, type: "started" });
      pyodide.globals.set("_sql_code", code);
      const failure = pyodide.runPython(
        "import sys\nfrom sqlrun import run_sql\nrun_sql(_sql_code, print)",
      );
      if (failure) send("error", String(failure));
      else self.postMessage({ id, type: "done" });
      return;
    }

    await installTurtle(pyodide);
    if (turtleReady) {
      try {
        pyodide.runPython("import sys\nsys.modules['turtle']._reset_all()");
      } catch (error) {
        /* ข้าม */
      }
    }

    self.postMessage({ id, type: "started" });

    // namespace ใหม่ทุกครั้ง ตัวแปรจากการรันก่อนหน้าจะไม่ค้าง
    const namespace = pyodide.globals.get("dict")();
    try {
      await pyodide.runPythonAsync(code, { globals: namespace });
    } finally {
      namespace.destroy();
    }
    sendDrawing(pyodide, id);
    self.postMessage({ id, type: "done" });
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    try {
      sendDrawing(await getPyodide(), id);
    } catch (ignored) {
      /* ข้าม */
    }
    send("error", cleanTraceback(message));
  }
};
