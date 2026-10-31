import type { CodeRunner, RunnerLanguage, RunResult } from "@/lib/coderunner";

/** หนึ่งรอบการรันของแบบฝึกหัดเขียนโค้ด: ระบบใส่โค้ดก่อน/หลังโค้ดของผู้เรียน (ดู course_content.py ฝั่ง backend) */
export type CaseSpec = { before: string; after: string };

export type CaseRun = {
  /** ข้อความที่โปรแกรมแสดงออกหน้าจอ (stdout) ต่อกันด้วย \n */
  output: string;
  /** ข้อความ error ที่ขึ้น (stderr) ใช้แสดงให้ผู้เรียนดู */
  errorLines: string[];
  status: RunResult["status"];
};

export function buildSource(code: string, spec: CaseSpec): string {
  return [spec.before, code, spec.after].filter((part) => part.trim() !== "").join("\n");
}

/**
 * รันโค้ดผู้เรียนกับ test case ทีละข้อตามลำดับ (ในเบราว์เซอร์ผู้เรียนเอง)
 * หยุดทันทีที่มีรอบไหนรันไม่สำเร็จ (error / หมดเวลา / ถูกหยุด) — ผู้เรียกใช้ดูที่ status ของรอบสุดท้าย
 */
export async function runCases(
  runner: CodeRunner,
  language: RunnerLanguage,
  code: string,
  cases: CaseSpec[],
  onStatus: (text: string) => void,
): Promise<CaseRun[]> {
  const runs: CaseRun[] = [];
  for (const spec of cases) {
    const stdout: string[] = [];
    const errorLines: string[] = [];
    const result = await runner.run(
      language,
      buildSource(code, spec),
      (line) => {
        if (line.kind === "stdout") stdout.push(line.text);
        else errorLines.push(line.text);
      },
      onStatus,
    );
    runs.push({ output: stdout.join("\n"), errorLines, status: result.status });
    if (result.status !== "ok") break;
  }
  return runs;
}
