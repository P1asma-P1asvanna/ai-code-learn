"""ตรวจโค้ดตัวอย่างในเนื้อหาบทเรียนว่า "รันได้จริง" — ใช้ทั้งในเทสต์และเรียกจากบรรทัดคำสั่งตอนเขียนบทเรียนใหม่

  python tests/lesson_code_check.py ไฟล์.py     # ไฟล์ที่มี LESSON_TEXTS = {"คอร์ส/บท": "markdown", ...}

กติกา: บล็อก ```python / ```javascript ทุกบล็อกต้องรันจนจบโดยไม่ error
  ยกเว้นบล็อกที่ตั้งใจให้ error เพื่อสอน ให้ใส่คอมเมนต์ "(ตัวอย่างนี้ error)" ไว้ในโค้ด (บล็อกนั้นต้อง error จริง)
บล็อก ```ภาษา demo ต้องรันได้และต้องมีผลลัพธ์ (แสดงข้อความหรือวาดภาพ)
โค้ด Python รันกับ turtle.py ของเว็บ ส่วน JavaScript รันกับ turtle API จาก js-worker.js (ตัวเดียวกับที่เว็บใช้)
"""

from __future__ import annotations

import json
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
SQLRUN_PY = ROOT / "frontend" / "public" / "workers" / "sqlrun.py"
TURTLE_PY = ROOT / "frontend" / "public" / "workers" / "turtle.py"
JS_WORKER = ROOT / "frontend" / "public" / "workers" / "js-worker.js"
ERROR_MARK = "ตัวอย่างนี้ error"
FENCE = re.compile(r"^```\s*([\w+#-]*)(?:[ \t]+(demo))?[ \t]*\n(.*?)^```[ \t]*$", re.S | re.M)

PY_RUNNER = r'''
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("turtle", sys.argv[2])
turtle_mod = importlib.util.module_from_spec(spec)
sys.modules["turtle"] = turtle_mod
spec.loader.exec_module(turtle_mod)
code = open(sys.argv[1], encoding="utf-8").read()
status = 0
try:
    exec(compile(code, "<lesson>", "exec"), {"__name__": "__main__"})
except SystemExit:
    pass
except BaseException as error:
    print("ERROR:", type(error).__name__, error, file=sys.stderr)
    status = 1
sys.stdout.flush()
drawn = turtle_mod._take()
sys.stderr.write("\nDRAWN=" + ("1" if drawn else "0") + "\n")
sys.exit(status)
'''

JS_RUNNER = r'''
const fs = require("fs");
const worker = fs.readFileSync(process.argv[3], "utf8");
const start = worker.indexOf("function createTurtleApi");
const end = worker.indexOf("/* turtle:end */");
const createTurtleApi = new Function(worker.slice(start, end) + "; return createTurtleApi;")();
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const code = fs.readFileSync(process.argv[2], "utf8");
const { api, take } = createTurtleApi();
const out = (...a) => console.log(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
(async () => {
  let status = 0;
  try {
    await new AsyncFunction("console", "turtle", '"use strict";\n' + code)({ log: out, info: out, debug: out, warn: out, error: out }, api);
  } catch (e) {
    console.error("ERROR:", e && e.name, e && e.message);
    status = 1;
  }
  process.stderr.write("\nDRAWN=" + (take() ? "1" : "0") + "\n");
  process.exit(status);
})();
'''


def run_sql_text(code: str, emit):
    """รัน SQL ด้วย sqlrun.py ตัวเดียวกับที่เว็บใช้ (sqlite3 ของ Python ปกติ) คืนข้อความ error หรือ None"""
    import importlib.util

    spec = importlib.util.spec_from_file_location("sqlrun_under_test", SQLRUN_PY)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.run_sql(code, emit)


def blocks(markdown: str):
    for match in FENCE.finditer(markdown):
        yield match.group(1).lower(), match.group(2) == "demo", match.group(3)


def run_block(lang: str, code: str, workdir: pathlib.Path) -> tuple[int, str, str, bool]:
    """คืน (exit code, stdout, stderr, วาดภาพไหม)"""
    source = workdir / ("block.py" if lang == "python" else "block.js")
    source.write_text(code, encoding="utf-8")
    runner = workdir / ("runner.py" if lang == "python" else "runner.js")
    if lang == "python":
        runner.write_text(PY_RUNNER, encoding="utf-8")
        cmd = [sys.executable, "-I", str(runner), str(source), str(TURTLE_PY)]
    else:
        runner.write_text(JS_RUNNER, encoding="utf-8")
        cmd = ["node", str(runner), str(source), str(JS_WORKER)]
    try:
        done = subprocess.run(cmd, capture_output=True, text=True, timeout=20, stdin=subprocess.DEVNULL, cwd=workdir)
    except subprocess.TimeoutExpired:
        return 124, "", "timeout", False
    drawn = "DRAWN=1" in done.stderr
    return done.returncode, done.stdout, done.stderr.replace("\nDRAWN=1\n", "").replace("\nDRAWN=0\n", ""), drawn


def check_text(key: str, markdown: str, *, have_node: bool | None = None) -> list[str]:
    """คืนรายการปัญหา (ว่าง = ผ่าน)"""
    if have_node is None:
        have_node = shutil.which("node") is not None
    problems: list[str] = []
    demos = 0
    with tempfile.TemporaryDirectory() as tmp:
        workdir = pathlib.Path(tmp)
        for index, (lang, demo, code) in enumerate(blocks(markdown), start=1):
            if demo:
                demos += 1
            if lang == "sql":
                label = f"{key} บล็อกที่ {index} (sql{' demo' if demo else ''})"
                out: list[str] = []
                error = run_sql_text(code, out.append)
                if error:
                    problems.append(f"{label}: รันไม่ผ่าน → {error[:300]}")
                elif demo and not out:
                    problems.append(f"{label}: เป็นตัวอย่างสาธิตแต่ไม่มีผลลัพธ์ให้ดูเลย")
                continue
            if lang not in ("python", "javascript"):
                continue
            if lang == "javascript" and not have_node:
                continue
            status, stdout, stderr, drawn = run_block(lang, code, workdir)
            label = f"{key} บล็อกที่ {index} ({lang}{' demo' if demo else ''})"
            expect_error = ERROR_MARK in code
            if expect_error and status == 0:
                problems.append(f"{label}: ใส่เครื่องหมาย error ไว้ แต่โค้ดรันผ่าน")
            elif not expect_error and status != 0:
                problems.append(f"{label}: รันไม่ผ่าน → {stderr.strip()[-300:]}")
            if demo and not expect_error and status == 0 and not stdout.strip() and not drawn:
                problems.append(f"{label}: เป็นตัวอย่างสาธิตแต่ไม่มีผลลัพธ์ให้ดูเลย")
    if demos == 0 and re.search(r"```\s*(python|javascript|sql)", markdown):
        problems.append(f"{key}: ยังไม่มีตัวอย่างสาธิต (```ภาษา demo) เลย")
    return problems


if __name__ == "__main__":
    namespace: dict = {}
    exec(compile(pathlib.Path(sys.argv[1]).read_text(encoding="utf-8"), sys.argv[1], "exec"), namespace)
    texts = namespace["LESSON_TEXTS"]
    all_problems: list[str] = []
    for key, text in texts.items():
        all_problems += check_text(key, text)
    print(json.dumps({"lessons": len(texts), "problems": all_problems}, ensure_ascii=False, indent=2))
    sys.exit(1 if all_problems else 0)
