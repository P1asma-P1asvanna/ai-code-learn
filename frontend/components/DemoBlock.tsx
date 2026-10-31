"use client";

import { useEffect, useRef, useState } from "react";

import HtmlPreview from "@/components/HtmlPreview";
import TurtleCanvas from "@/components/TurtleCanvas";
import type { OutputLine } from "@/lib/coderunner";
import type { Drawing } from "@/lib/turtle";

export type DemoResult = { lines: OutputLine[]; drawing: Drawing | null };

type Props = {
  code: string;
  lang: string;
  /** ภาษาที่หน้านี้รันได้ (python / javascript / html) */
  runnableLang?: string;
  /** รันโค้ดสาธิต (ผู้เรียกใช้ตัวรันของหน้า) */
  onRun?: (code: string) => Promise<DemoResult>;
  onTry?: (code: string) => void;
};

/** “ตัวอย่างสาธิต” ในบทเรียน: ดูโค้ด กดปุ่มแล้วเห็นผลลัพธ์ (ข้อความหรือภาพที่วาด) ใต้โค้ดทันที */
export default function DemoBlock({ code, lang, runnableLang, onRun, onTry }: Props) {
  const [result, setResult] = useState<DemoResult | null>(null);
  const [running, setRunning] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const isWeb = lang === "html" && runnableLang === "html";
  const canRun = !isWeb && Boolean(onRun) && lang === runnableLang;

  const run = async () => {
    if (!onRun || running) return;
    setRunning(true);
    try {
      const next = await onRun(code);
      if (alive.current) setResult(next);
    } finally {
      if (alive.current) setRunning(false);
    }
  };

  return (
    <div className="md-code demo-block">
      <div className="demo-label small">🎬 ตัวอย่างสาธิต</div>
      <pre>
        <code>{code}</code>
      </pre>

      {isWeb ? (
        <>
          <div className="small muted">ผลลัพธ์ที่ได้:</div>
          <HtmlPreview code={code} />
        </>
      ) : null}

      <div className="row">
        {canRun ? (
          <button className="btn btn-primary btn-small" onClick={() => void run()} disabled={running}>
            {running ? "กำลังรัน… (Python ครั้งแรกอาจรอสักครู่)" : "▶ ดูผลลัพธ์"}
          </button>
        ) : null}
        {onTry && lang === runnableLang ? (
          <button className="btn btn-small" onClick={() => onTry(code + "\n")}>
            ✎ นำไปลองแก้ในตัวแก้ไข
          </button>
        ) : null}
      </div>

      {result ? (
        <div className="demo-result" aria-live="polite">
          {result.drawing ? <TurtleCanvas drawing={result.drawing} /> : null}
          {result.lines.length > 0 ? (
            <pre className="output">
              {result.lines.map((line, index) => (
                <div key={index} className={`line ${line.kind}`}>
                  {line.text === "" ? " " : line.text}
                </div>
              ))}
            </pre>
          ) : !result.drawing ? (
            <p className="small muted">โค้ดนี้ไม่ได้แสดงข้อความอะไรออกมา</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
