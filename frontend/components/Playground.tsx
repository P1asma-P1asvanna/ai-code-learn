"use client";

import Editor, { type OnMount } from "@monaco-editor/react";
import { signIn, useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  fetchAiStatus,
  requestReview,
  type AiStatus,
  type ReviewIssue,
  type ReviewResult,
} from "@/lib/ai";
import { ApiError, wakeBackend } from "@/lib/api";
import TurtleCanvas from "@/components/TurtleCanvas";
import HtmlPreview from "@/components/HtmlPreview";
import { CodeRunner, type OutputLine, type RunnerLanguage, type RunResult } from "@/lib/coderunner";
import type { Drawing } from "@/lib/turtle";

type EditorInstance = Parameters<OnMount>[0];
type MonacoInstance = Parameters<OnMount>[1];

// HTML & CSS ไม่ได้รันเป็นโปรแกรม แต่แสดงหน้าเว็บสดแทน
type Language = RunnerLanguage | "html";

const STARTERS: Record<Language, string> = {
  python: 'name = "โลก"\nprint(f"สวัสดี {name}!")\n',
  javascript: 'const name = "โลก";\nconsole.log(`สวัสดี ${name}!`);\n',
  sql: "SELECT name, kind, age FROM pets\nWHERE age > 2\nORDER BY age DESC;\n-- ตารางที่มีให้ลอง: pets, snacks\n",
  html: '<style>\n  h1 { color: royalblue; }\n</style>\n\n<h1>สวัสดีชาวโลก</h1>\n<p>แก้ HTML และ CSS ตรงนี้ ผลลัพธ์ขึ้นทันที</p>\n',
};
const FILE_NAMES: Record<Language, string> = { python: "main.py", javascript: "main.js", sql: "main.sql", html: "index.html" };

// รอให้ผู้เรียนหยุดพิมพ์กี่มิลลิวินาทีก่อนให้ AI ตรวจอัตโนมัติ
const AUTO_DELAY_MS = 2500;
// เว้นระยะอย่างน้อยเท่านี้ระหว่างการตรวจอัตโนมัติสองครั้ง (กันชนโควต้าต่อนาทีของ backend)
const MIN_INTERVAL_MS = 7000;
const AUTO_STORAGE_KEY = "ai-review-auto";

const SEVERITY_LABEL: Record<ReviewIssue["severity"], string> = {
  error: "ผิดพลาด",
  warning: "ควรระวัง",
  tip: "คำแนะนำ",
};

export default function Playground() {
  const { data: session, status: sessionStatus } = useSession();
  const token = session?.accessToken;

  const [language, setLanguage] = useState<Language>("python");
  const [code, setCode] = useState(STARTERS.python);
  const [output, setOutput] = useState<OutputLine[]>([]);
  const [drawing, setDrawing] = useState<Drawing | null>(null);
  const [running, setRunning] = useState(false);
  const [runNote, setRunNote] = useState("");
  const [lastRun, setLastRun] = useState<RunResult | null>(null);

  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [aiStatusFailed, setAiStatusFailed] = useState(false);
  const [autoReview, setAutoReview] = useState(false);
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [quotaBlocked, setQuotaBlocked] = useState(false);
  const [dark, setDark] = useState(false);

  const runnerRef = useRef<CodeRunner | null>(null);
  const editorRef = useRef<EditorInstance | null>(null);
  const monacoRef = useRef<MonacoInstance | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastReviewedKeyRef = useRef("");
  const lastReviewAtRef = useRef(0);
  const runShortcutRef = useRef<() => void>(() => {});

  // ผลรันที่ล้มเหลวของโค้ดชุดนี้ ส่งให้ AI ใช้ประกอบการอธิบาย error
  const runError = lastRun?.status === "error" ? lastRun.errorText : null;
  const reviewKey = `${language}\u0000${code}\u0000${runError ?? ""}`;
  const tooLong = aiStatus !== null && code.length > aiStatus.max_code_chars;
  const canUseAi = aiStatus?.enabled === true && Boolean(token) && !quotaBlocked;

  // ---------------------------------------------------------------- setup

  useEffect(() => {
    const runner = new CodeRunner();
    runnerRef.current = runner;
    return () => {
      runner.dispose();
      if (runnerRef.current === runner) runnerRef.current = null;
      abortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    try {
      setAutoReview(localStorage.getItem(AUTO_STORAGE_KEY) === "1");
    } catch {
      // เบราว์เซอร์บล็อก localStorage — ใช้ค่าเริ่มต้น (ปิด)
    }

    const query = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(query.matches);
    const onThemeChange = (event: MediaQueryListEvent) => setDark(event.matches);
    query.addEventListener("change", onThemeChange);

    let cancelled = false;
    void wakeBackend(); // ปลุก backend ที่หลับอยู่ให้ตื่นระหว่างผู้เรียนเริ่มพิมพ์โค้ด
    fetchAiStatus()
      .then((status) => {
        if (!cancelled) setAiStatus(status);
      })
      .catch(() => {
        if (!cancelled) setAiStatusFailed(true);
      });

    return () => {
      cancelled = true;
      query.removeEventListener("change", onThemeChange);
    };
  }, []);

  // ---------------------------------------------------------------- editor

  const applyMarkers = useCallback((result: ReviewResult | null) => {
    const monaco = monacoRef.current;
    const model = editorRef.current?.getModel();
    if (!monaco || !model) return;

    const markers = (result?.issues ?? []).flatMap((issue) => {
      if (issue.line === null) return [];
      const line = Math.min(Math.max(issue.line, 1), model.getLineCount());
      return [
        {
          severity:
            issue.severity === "error"
              ? monaco.MarkerSeverity.Error
              : issue.severity === "warning"
                ? monaco.MarkerSeverity.Warning
                : monaco.MarkerSeverity.Info,
          message: issue.message,
          startLineNumber: line,
          startColumn: 1,
          endLineNumber: line,
          endColumn: model.getLineMaxColumn(line),
        },
      ];
    });
    monaco.editor.setModelMarkers(model, "ai-review", markers);
  }, []);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runShortcutRef.current());
  };

  const handleChange = (value: string | undefined) => {
    setCode(value ?? "");
    setLastRun(null); // ผลรันเดิมไม่ตรงกับโค้ดที่แก้แล้ว
    applyMarkers(null); // เส้นใต้ของ AI เลื่อนตามบรรทัดไม่ได้ เลยล้างเมื่อแก้โค้ด
  };

  const changeLanguage = (next: Language) => {
    if (next === language) return;
    runnerRef.current?.stop();
    abortRef.current?.abort();
    abortRef.current = null;
    applyMarkers(null);
    setReviewing(false);
    setLanguage(next);
    setCode(STARTERS[next]);
    setOutput([]);
    setDrawing(null);
    setLastRun(null);
    setReview(null);
    setReviewError(null);
    lastReviewedKeyRef.current = "";
  };

  // ---------------------------------------------------------------- run

  const handleRun = useCallback(async () => {
    const runner = runnerRef.current;
    if (!runner || running || language === "html") return;

    setOutput([]);
    setDrawing(null);
    setRunNote("");
    setLastRun(null);
    setRunning(true);
    const result = await runner.run(
      language,
      code,
      (line) => setOutput((previous) => [...previous, line]),
      setRunNote,
      setDrawing,
    );
    setRunning(false);
    setRunNote("");
    setLastRun(result);
  }, [language, code, running]);

  useEffect(() => {
    runShortcutRef.current = () => void handleRun();
  }, [handleRun]);

  // ---------------------------------------------------------------- AI review

  const runReview = useCallback(async () => {
    if (!token || !code.trim()) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    lastReviewedKeyRef.current = reviewKey;
    lastReviewAtRef.current = Date.now();
    setReviewing(true);
    setReviewError(null);

    try {
      const result = await requestReview(
        token,
        { language, code, last_output: runError },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setReview(result);
      applyMarkers(result);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (error instanceof ApiError) {
        if (error.status === 401) {
          setReviewError("เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง");
        } else {
          setReviewError(error.message);
          if (error.code === "daily_quota" || error.code === "global_quota") {
            setQuotaBlocked(true);
          }
        }
      } else {
        setReviewError("ติดต่อ AI ไม่สำเร็จ (ถ้าเซิร์ฟเวอร์เพิ่งตื่น ลองใหม่อีกครั้งในอีกสักครู่)");
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setReviewing(false);
      }
    }
  }, [token, code, language, runError, reviewKey, applyMarkers]);

  // ตรวจอัตโนมัติ: รอให้หยุดพิมพ์ + เว้นระยะขั้นต่ำ + ไม่ซ้อนกับคำขอที่ยังค้างอยู่
  useEffect(() => {
    if (!autoReview || !canUseAi || reviewing || tooLong) return;
    if (!code.trim() || reviewKey === lastReviewedKeyRef.current) return;

    const sinceLast = Date.now() - lastReviewAtRef.current;
    const wait = Math.max(AUTO_DELAY_MS, MIN_INTERVAL_MS - sinceLast);
    const timer = setTimeout(() => void runReview(), wait);
    return () => clearTimeout(timer);
  }, [autoReview, canUseAi, reviewing, tooLong, code, reviewKey, runReview]);

  const toggleAuto = (value: boolean) => {
    setAutoReview(value);
    try {
      localStorage.setItem(AUTO_STORAGE_KEY, value ? "1" : "0");
    } catch {
      // ไม่เป็นไร แค่จำค่าข้ามการเปิดหน้าไม่ได้
    }
  };

  const jumpToLine = (line: number | null) => {
    const editor = editorRef.current;
    if (!editor || line === null) return;
    editor.revealLineInCenter(line);
    editor.setPosition({ lineNumber: line, column: 1 });
    editor.focus();
  };

  // ---------------------------------------------------------------- render

  return (
    <div className="playground">
      <section className="panel editor-panel" aria-label="เขียนและรันโค้ด">
        <div className="toolbar">
          <label className="field">
            <span className="small muted">ภาษา</span>
            <select
              value={language}
              onChange={(event) => changeLanguage(event.target.value as Language)}
              disabled={running}
            >
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
              <option value="sql">SQL</option>
              <option value="html">HTML &amp; CSS</option>
            </select>
          </label>
          <div className="spacer" />
          {language === "html" ? null : running ? (
            <button className="btn btn-danger" onClick={() => runnerRef.current?.stop()}>
              ■ หยุด
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => void handleRun()}>
              ▶ รันโค้ด
            </button>
          )}
        </div>

        <div className="editor-frame">
          <Editor
            height="100%"
            path={FILE_NAMES[language]}
            language={language}
            value={code}
            theme={dark ? "vs-dark" : "light"}
            onChange={handleChange}
            onMount={handleMount}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              tabSize: language === "python" || language === "sql" ? 4 : 2,
              wordWrap: "on",
              scrollBeyondLastLine: false,
              automaticLayout: true,
            }}
          />
        </div>
        <p className="small muted hint">
          {language === "html"
            ? "ผลลัพธ์แสดงสดด้านล่างขณะพิมพ์ · สคริปต์ในหน้าเว็บจะไม่ทำงานเพื่อความปลอดภัย"
            : "กด Ctrl/⌘ + Enter เพื่อรัน · โค้ดทำงานในเบราว์เซอร์ของคุณเอง ไม่ถูกส่งไปที่เซิร์ฟเวอร์"}
          {language === "python" ? " · input() ยังไม่รองรับ" : ""}
          {language === "sql" ? " · มีตาราง pets และ snacks ให้ลอง (สร้างใหม่ทุกครั้งที่รัน)" : ""}
        </p>

        <div className="output-head">
          <h2>{language === "html" ? "ตัวอย่างผลลัพธ์" : "ผลลัพธ์"}</h2>
          {runNote ? <span className="small muted">{runNote}</span> : null}
          {lastRun?.status === "ok" ? (
            <span className="small ok">เสร็จสิ้นใน {lastRun.durationMs} ms</span>
          ) : null}
        </div>
        {language === "html" ? <HtmlPreview code={code} /> : null}
        <pre className="output" aria-live="polite" style={language === "html" ? { display: "none" } : undefined}>
          {output.length === 0 ? (
            drawing ? (
              <span className="muted">โค้ดนี้วาดภาพ ดูภาพด้านล่าง</span>
            ) : (
              <span className="muted">กด “รันโค้ด” เพื่อดูผลลัพธ์ที่นี่</span>
            )
          ) : (
            output.map((line, index) => (
              <div key={index} className={`line ${line.kind}`}>
                {line.text === "" ? " " : line.text}
              </div>
            ))
          )}
        </pre>
        {drawing ? <TurtleCanvas drawing={drawing} /> : null}
      </section>

      <aside className="panel ai-panel" aria-label="AI ช่วยตรวจโค้ด" aria-live="polite">
        <div className="panel-head">
          <h2>AI ช่วยตรวจโค้ด</h2>
          <span className="badge">เสริม · ปิดได้</span>
        </div>

        {aiStatusFailed ? (
          <p className="muted small">
            เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ในตอนนี้ (อาจกำลังตื่นจากการพัก) ลองรีเฟรชหน้านี้อีกครั้ง
            ส่วนการเขียนและรันโค้ดใช้ได้ตามปกติ
          </p>
        ) : aiStatus === null ? (
          <p className="muted small">กำลังตรวจสอบระบบ AI… (ครั้งแรกอาจใช้เวลาประมาณ 1 นาที)</p>
        ) : !aiStatus.enabled ? (
          <p className="muted small">
            ผู้ดูแลยังไม่ได้เปิดใช้ระบบ AI ตรวจโค้ด — เขียนและรันโค้ดได้ตามปกติ
          </p>
        ) : sessionStatus === "loading" ? (
          <p className="muted small">กำลังตรวจสอบการเข้าสู่ระบบ…</p>
        ) : !token ? (
          <div className="stack">
            <p className="small">
              เข้าสู่ระบบเพื่อให้ AI ช่วยตรวจโค้ดและแนะนำแบบทันที (ฟรี วันละ {aiStatus.daily_limit} ครั้ง)
            </p>
            <button className="btn btn-primary" onClick={() => void signIn("github")}>
              เข้าสู่ระบบด้วย GitHub
            </button>
          </div>
        ) : (
          <div className="stack">
            <label className="switch">
              <input
                type="checkbox"
                checked={autoReview}
                disabled={quotaBlocked}
                onChange={(event) => toggleAuto(event.target.checked)}
              />
              <span>ตรวจให้อัตโนมัติขณะเขียน</span>
            </label>
            <p className="small muted">
              ปิดไว้ได้ถ้าอยากลองคิดเอง AI จะให้คำใบ้ ไม่เฉลยทั้งหมด
              {autoReview ? " · ตรวจหลังหยุดพิมพ์ประมาณ 2-3 วินาที" : ""}
            </p>

            <button
              className="btn"
              onClick={() => void runReview()}
              disabled={!canUseAi || reviewing || tooLong || !code.trim()}
            >
              {reviewing ? "AI กำลังตรวจ…" : "ตรวจโค้ดตอนนี้"}
            </button>

            {tooLong && aiStatus ? (
              <p className="small warning-text">
                โค้ดยาวเกิน {aiStatus.max_code_chars} ตัวอักษร AI จะยังไม่ตรวจให้
              </p>
            ) : null}
            {reviewError ? <p className="small error-text">{reviewError}</p> : null}

            {review ? (
              <div className="review" aria-busy={reviewing}>
                {review.summary ? <p className="summary">{review.summary}</p> : null}
                {review.issues.length === 0 ? (
                  <p className="small muted">ไม่พบจุดที่ต้องแก้ 🎉</p>
                ) : (
                  <ul className="issues">
                    {review.issues.map((issue, index) => (
                      <li key={index} className={`issue ${issue.severity}`}>
                        <div className="issue-head">
                          <span className={`tag ${issue.severity}`}>{SEVERITY_LABEL[issue.severity]}</span>
                          {issue.line !== null ? (
                            <button
                              className="link"
                              onClick={() => jumpToLine(issue.line)}
                              aria-label={`ไปที่บรรทัด ${issue.line}`}
                            >
                              บรรทัด {issue.line}
                            </button>
                          ) : null}
                        </div>
                        <p>{issue.message}</p>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="small muted">เหลือโควต้าวันนี้อีก {review.remaining_today} ครั้ง</p>
              </div>
            ) : null}

            {quotaBlocked ? (
              <p className="small muted">โควต้า AI วันนี้หมดแล้ว พรุ่งนี้กลับมาใช้ใหม่ได้</p>
            ) : null}
          </div>
        )}

        <p className="small muted privacy">
          เมื่อใช้ AI ตรวจ โค้ดและข้อความ error ที่แสดงอยู่จะถูกส่งไปยังผู้ให้บริการ AI ภายนอก
          อย่าใส่รหัสผ่านหรือข้อมูลส่วนตัวในโค้ด
        </p>
      </aside>
    </div>
  );
}
