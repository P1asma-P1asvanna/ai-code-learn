const WORKER_URL = {
    python: "/workers/python-worker.js",
    javascript: "/workers/js-worker.js",
};
const RUN_TIMEOUT_MS = 10_000;
const LOAD_TIMEOUT_MS = 90_000;
const MAX_OUTPUT_LINES = 1000;
/**
 * รันโค้ดผู้เรียนใน Web Worker (ในเบราว์เซอร์ของผู้เรียนเอง — ไม่ผ่าน server)
 * - JavaScript: สร้าง worker ใหม่ทุกครั้ง
 * - Python: ใช้ worker เดิมซ้ำเพราะโหลด Pyodide ช้า (ถ้าถูกหยุดกลางคันจะโหลดใหม่ในครั้งถัดไป)
 */
export class CodeRunner {
    pythonWorker = null;
    pythonReady = false;
    active = null;
    nextId = 1;
    stop() {
        this.active?.stop(false);
    }
    dispose() {
        this.stop();
        this.pythonWorker?.terminate();
        this.pythonWorker = null;
        this.pythonReady = false;
    }
    run(language, code, onLine, onStatus) {
        this.active?.stop(true); // หยุดงานก่อนหน้าแบบเงียบ ๆ (ไม่พิมพ์ข้อความลงผลลัพธ์ใหม่)
        const id = this.nextId++;
        const isPython = language === "python";
        if (isPython && !this.pythonWorker) {
            this.pythonWorker = new Worker(WORKER_URL.python);
            this.pythonReady = false;
        }
        const worker = isPython ? this.pythonWorker : new Worker(WORKER_URL[language]);
        if (isPython && !this.pythonReady) {
            onStatus("กำลังโหลด Python ครั้งแรก อาจใช้เวลาสักครู่…");
        }
        return new Promise((resolve) => {
            let finished = false;
            let lineCount = 0;
            let startedAt = performance.now();
            let timer;
            const finish = (status, errorText, killWorker) => {
                if (finished)
                    return;
                finished = true;
                if (timer)
                    clearTimeout(timer);
                worker.removeEventListener("message", onMessage);
                worker.removeEventListener("error", onError);
                if (killWorker || !isPython) {
                    worker.terminate();
                    if (isPython) {
                        this.pythonWorker = null;
                        this.pythonReady = false;
                    }
                }
                if (this.active === handle)
                    this.active = null;
                resolve({
                    status,
                    durationMs: Math.round(performance.now() - startedAt),
                    errorText,
                });
            };
            const handle = {
                stop: (silent) => {
                    if (!silent)
                        onLine({ kind: "info", text: "หยุดการทำงานแล้ว" });
                    finish("stopped", null, true);
                },
            };
            this.active = handle;
            const onMessage = (event) => {
                const message = event.data;
                if (message.id !== id)
                    return;
                switch (message.type) {
                    case "started":
                        if (isPython)
                            this.pythonReady = true;
                        onStatus("");
                        startedAt = performance.now();
                        if (timer)
                            clearTimeout(timer);
                        timer = setTimeout(() => {
                            onLine({
                                kind: "info",
                                text: `หยุดอัตโนมัติ: โค้ดทำงานนานเกิน ${RUN_TIMEOUT_MS / 1000} วินาที (อาจมี loop ที่ไม่มีวันจบ)`,
                            });
                            finish("timeout", null, true);
                        }, RUN_TIMEOUT_MS);
                        break;
                    case "stdout":
                    case "stderr":
                        if (lineCount >= MAX_OUTPUT_LINES) {
                            onLine({ kind: "info", text: "ผลลัพธ์ยาวเกินไป จึงหยุดการทำงาน" });
                            finish("truncated", null, true);
                            return;
                        }
                        lineCount += 1;
                        onLine({ kind: message.type, text: message.text ?? "" });
                        break;
                    case "done":
                        finish("ok", null, false);
                        break;
                    case "error": {
                        const text = message.text || "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
                        onLine({ kind: "stderr", text });
                        finish("error", text, false);
                        break;
                    }
                }
            };
            const onError = () => {
                const text = isPython
                    ? "โหลดตัวรัน Python ไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่"
                    : "ตัวรันโค้ดทำงานผิดพลาด";
                onLine({ kind: "stderr", text });
                finish("error", text, true);
            };
            worker.addEventListener("message", onMessage);
            worker.addEventListener("error", onError);
            // ระหว่างรอโหลด Pyodide ยังไม่เริ่มนับเวลารันโค้ด แต่มีเพดานการรอ
            timer = setTimeout(() => {
                onLine({ kind: "stderr", text: "รอตัวรันโค้ดนานเกินไป ลองใหม่อีกครั้ง" });
                finish("timeout", null, true);
            }, LOAD_TIMEOUT_MS);
            worker.postMessage({ id, code });
        });
    }
}
