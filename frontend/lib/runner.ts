import { sanitizeDrawing, type Drawing } from "@/lib/turtle";

export type Language = "python" | "javascript";

export type OutputLine = { kind: "stdout" | "stderr" | "info"; text: string };

export type RunResult = {
  status: "ok" | "error" | "timeout" | "stopped" | "truncated";
  durationMs: number;
  /** ข้อความ error (ถ้ามี) — ใช้ส่งให้ AI ช่วยอธิบาย */
  errorText: string | null;
};

type WorkerMessage = {
  id: number;
  type: "started" | "stdout" | "stderr" | "done" | "error" | "draw";
  text?: string;
  drawing?: unknown;
};

const WORKER_URL: Record<Language, string> = {
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
  private pythonWorker: Worker | null = null;
  private pythonReady = false;
  private active: { stop: (silent?: boolean) => void } | null = null;
  private nextId = 1;

  stop(): void {
    this.active?.stop(false);
  }

  dispose(): void {
    this.stop();
    this.pythonWorker?.terminate();
    this.pythonWorker = null;
    this.pythonReady = false;
  }

  run(
    language: Language,
    code: string,
    onLine: (line: OutputLine) => void,
    onStatus: (text: string) => void,
    onDraw?: (drawing: Drawing) => void,
  ): Promise<RunResult> {
    this.active?.stop(true); // หยุดงานก่อนหน้าแบบเงียบ ๆ (ไม่พิมพ์ข้อความลงผลลัพธ์ใหม่)

    const id = this.nextId++;
    const isPython = language === "python";

    if (isPython && !this.pythonWorker) {
      this.pythonWorker = new Worker(WORKER_URL.python);
      this.pythonReady = false;
    }
    const worker = isPython ? (this.pythonWorker as Worker) : new Worker(WORKER_URL[language]);

    if (isPython && !this.pythonReady) {
      onStatus("กำลังโหลด Python ครั้งแรก อาจใช้เวลาสักครู่…");
    }

    return new Promise<RunResult>((resolve) => {
      let finished = false;
      let lineCount = 0;
      let startedAt = performance.now();
      let timer: ReturnType<typeof setTimeout> | undefined;

      const finish = (
        status: RunResult["status"],
        errorText: string | null,
        killWorker: boolean,
      ) => {
        if (finished) return;
        finished = true;
        if (timer) clearTimeout(timer);
        worker.removeEventListener("message", onMessage);
        worker.removeEventListener("error", onError);
        if (killWorker || !isPython) {
          worker.terminate();
          if (isPython) {
            this.pythonWorker = null;
            this.pythonReady = false;
          }
        }
        if (this.active === handle) this.active = null;
        resolve({
          status,
          durationMs: Math.round(performance.now() - startedAt),
          errorText,
        });
      };

      const handle = {
        stop: (silent?: boolean) => {
          if (!silent) onLine({ kind: "info", text: "หยุดการทำงานแล้ว" });
          finish("stopped", null, true);
        },
      };
      this.active = handle;

      const onMessage = (event: MessageEvent<WorkerMessage>) => {
        const message = event.data;
        if (message.id !== id) return;

        switch (message.type) {
          case "started":
            if (isPython) this.pythonReady = true;
            onStatus("");
            startedAt = performance.now();
            if (timer) clearTimeout(timer);
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
          case "draw": {
            const drawing = sanitizeDrawing(message.drawing);
            if (drawing) onDraw?.(drawing);
            break;
          }
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
