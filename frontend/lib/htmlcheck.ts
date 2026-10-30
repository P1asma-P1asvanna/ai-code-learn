import type { CaseRun } from "@/lib/grader";

/**
 * ตัวตรวจแบบฝึกหัด HTML/CSS — ทำงานในเบราว์เซอร์ของผู้เรียนเอง
 *
 * หลักความปลอดภัย: โค้ดของผู้เรียนถูกแสดงใน iframe ที่ sandbox ไม่มี allow-scripts
 * (สคริปต์ในหน้าที่ผู้เรียนเขียนจึงไม่ทำงานเลย) และใส่ Content-Security-Policy กันโหลดทรัพยากรแปลก ๆ
 * ส่วนการตรวจเป็นคำสั่งแบบ "ประกาศ" ที่ระบบเขียนไว้ (ไม่มี eval ไม่รันโค้ดจากที่ไหน)
 *
 * คำสั่งตรวจ หนึ่งบรรทัดต่อหนึ่งคำสั่ง คั่นด้วย | (ผลลัพธ์หนึ่งบรรทัดต่อคำสั่ง):
 *   has|ตัวเลือก           → true / false  (มีองค์ประกอบนี้ไหม)
 *   count|ตัวเลือก         → จำนวนที่พบ
 *   text|ตัวเลือก          → ข้อความของตัวแรกที่พบ (ย่อช่องว่างแล้ว) หรือ null ถ้าไม่พบ
 *   attr|ตัวเลือก|ชื่อ     → ค่าแอตทริบิวต์ หรือ null ถ้าไม่มี/ไม่พบ
 *   css|ตัวเลือก|คุณสมบัติ → ค่า CSS ที่คำนวณแล้ว (เช่น rgb(255, 0, 0), 20px) หรือ null ถ้าไม่พบองค์ประกอบ
 */

const PREVIEW_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; font-src data:";
const LOAD_TIMEOUT_MS = 5000;

/** ใส่ meta CSP + base ไว้หน้าโค้ดของผู้เรียน (meta ที่ผู้เรียนใส่ตามมาทีหลังทำได้แค่เข้มขึ้น) */
export function buildPreviewDoc(code: string): string {
  return `<!doctype html><meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}"><base target="_blank">\n${code}`;
}

export const PREVIEW_SANDBOX = ""; // แสดงผลอย่างเดียว ไม่ให้ทำอะไรเลย
const CHECK_SANDBOX = "allow-same-origin"; // ให้หน้าหลักอ่าน DOM ได้ แต่ยังไม่ให้รันสคริปต์

function collapse(text: string | null | undefined): string {
  return (text ?? "").replace(/\s+/g, " ").trim();
}

/** รันสคริปต์คำสั่งตรวจกับเอกสารที่ render แล้ว คืนผลหนึ่งบรรทัดต่อคำสั่ง (โยน Error ถ้าคำสั่ง/ตัวเลือกผิด) */
export function evaluateChecks(doc: Document, view: Window, script: string): string[] {
  const lines: string[] = [];
  for (const raw of script.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const [command, selector = "", argument = ""] = line.split("|");
    const first = () => doc.querySelector(selector);
    switch (command) {
      case "has":
        lines.push(String(first() !== null));
        break;
      case "count":
        lines.push(String(doc.querySelectorAll(selector).length));
        break;
      case "text": {
        const el = first();
        lines.push(el ? collapse(el.textContent) : "null");
        break;
      }
      case "attr": {
        const value = first()?.getAttribute(argument);
        lines.push(value === null || value === undefined ? "null" : collapse(value));
        break;
      }
      case "css": {
        const el = first();
        lines.push(el ? view.getComputedStyle(el).getPropertyValue(argument).trim() || "null" : "null");
        break;
      }
      default:
        throw new Error(`คำสั่งตรวจไม่รู้จัก: ${command}`);
    }
  }
  return lines;
}

/** render โค้ดของผู้เรียนใน iframe ที่ซ่อนไว้แล้วรันชุดตรวจทีละรอบ (รูปแบบผลลัพธ์เหมือน runCases ของโค้ดทั่วไป) */
export async function runWebCases(code: string, cases: { before: string; after: string }[]): Promise<CaseRun[]> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("sandbox", CHECK_SANDBOX);
  iframe.setAttribute("aria-hidden", "true");
  iframe.tabIndex = -1;
  iframe.style.cssText =
    "position:fixed;left:-10000px;top:0;width:800px;height:600px;border:0;visibility:hidden;pointer-events:none";

  try {
    const loaded = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("แสดงหน้าเว็บไม่สำเร็จ (หมดเวลา)")), LOAD_TIMEOUT_MS);
      iframe.addEventListener(
        "load",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
    iframe.srcdoc = buildPreviewDoc(code);
    document.body.appendChild(iframe);
    await loaded;

    const doc = iframe.contentDocument;
    const view = iframe.contentWindow;
    if (!doc || !view) throw new Error("อ่านหน้าเว็บที่แสดงไม่ได้");

    const runs: CaseRun[] = [];
    for (const spec of cases) {
      try {
        runs.push({ output: evaluateChecks(doc, view, spec.after).join("\n"), errorLines: [], status: "ok" });
      } catch (error) {
        runs.push({
          output: "",
          errorLines: [error instanceof Error ? error.message : String(error)],
          status: "error",
        });
        break;
      }
    }
    return runs;
  } catch (error) {
    return [
      {
        output: "",
        errorLines: [error instanceof Error ? error.message : String(error)],
        status: "error",
      },
    ];
  } finally {
    iframe.remove();
  }
}
