"use client";

import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useCallback, useEffect, useRef, useState } from "react";

import CodeEditor from "@/components/CodeEditor";
import type { DemoResult } from "@/components/DemoBlock";
import HtmlPreview from "@/components/HtmlPreview";
import Markdown, { InlineText } from "@/components/Markdown";
import TutorChat from "@/components/TutorChat";
import { ApiError } from "@/lib/api";
import { buildSource, runCases, type CaseRun } from "@/lib/grader";
import { runWebCases } from "@/lib/htmlcheck";
import {
  completeLesson,
  fetchLessonProgress,
  submitExercise,
  type CodeExercise,
  type ExerciseStat,
  type LessonPage,
  type LessonStatus,
  type McqExercise,
  type SubmitResult,
} from "@/lib/learn";
import { CodeRunner, type Language, type OutputLine } from "@/lib/runner";
import type { Drawing } from "@/lib/turtle";
import TurtleCanvas from "@/components/TurtleCanvas";

const FREE_TAB = "free";

type Feedback =
  | { kind: "error"; text: string; lines: string[] }
  | { kind: "result"; result: SubmitResult; outputs: string[] };

type TabState = {
  code: string;
  output: OutputLine[];
  drawing: Drawing | null;
  caseIndex: number;
  feedback: Feedback | null;
};

type Busy = null | { tab: string; mode: "run" | "submit" };

function isRunnable(slug: string): slug is Language {
  return slug === "python" || slug === "javascript";
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง";
    return error.message;
  }
  return "ติดต่อเซิร์ฟเวอร์ไม่สำเร็จ (ถ้าเพิ่งเปิดเว็บ เซิร์ฟเวอร์ฟรีอาจกำลังตื่น ลองใหม่อีกครั้งในอีกสักครู่)";
}

export default function LessonView({ page }: { page: LessonPage }) {
  const { course, lesson, exercises, prev, next } = page;
  const languageSlug = course.language.slug;
  const runnableLanguage: Language | null = isRunnable(languageSlug) ? languageSlug : null;
  // HTML/CSS ไม่ได้รันเป็นโปรแกรม: แสดงตัวอย่างหน้าเว็บสด และตรวจจากหน้าเว็บที่ render แล้ว
  const isWeb = languageSlug === "html";
  const canCode = runnableLanguage !== null || isWeb;
  const editorLanguage: "python" | "javascript" | "html" | null = isWeb ? "html" : runnableLanguage;
  const fileExt = languageSlug === "python" ? "py" : isWeb ? "html" : "js";

  const { data: session, status: sessionStatus } = useSession();
  const token = session?.accessToken;

  const codeExercises = exercises.filter((e): e is CodeExercise => e.kind === "code");

  const [tabs, setTabs] = useState<Record<string, TabState>>(() => {
    const initial: Record<string, TabState> = {
      [FREE_TAB]: { code: lesson.starter_code ?? "", output: [], drawing: null, caseIndex: 0, feedback: null },
    };
    for (const exercise of codeExercises) {
      initial[exercise.id] = { code: exercise.starter_code, output: [], drawing: null, caseIndex: 0, feedback: null };
    }
    return initial;
  });
  const [activeTab, setActiveTab] = useState(FREE_TAB);
  const [busy, setBusy] = useState<Busy>(null);
  const [runNote, setRunNote] = useState("");

  const [stats, setStats] = useState<Record<string, ExerciseStat>>({});
  const [lessonStatus, setLessonStatus] = useState<LessonStatus>("not_started");
  const [progressError, setProgressError] = useState(false);

  const [choices, setChoices] = useState<Record<string, string>>({});
  const [mcqResults, setMcqResults] = useState<Record<string, SubmitResult | { error: string }>>({});
  const [mcqBusy, setMcqBusy] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  const runnerRef = useRef<CodeRunner | null>(null);

  useEffect(() => {
    const runner = new CodeRunner();
    runnerRef.current = runner;
    return () => {
      runner.dispose();
      if (runnerRef.current === runner) runnerRef.current = null;
    };
  }, []);

  // โหลดความคืบหน้าของผู้เรียนคนนี้ในบทเรียนนี้
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setProgressError(false);
    fetchLessonProgress(token, lesson.id)
      .then((data) => {
        if (cancelled) return;
        setStats(data.exercises);
        setLessonStatus(data.status);
      })
      .catch(() => {
        if (!cancelled) setProgressError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token, lesson.id]);

  const patchTab = useCallback((key: string, patch: Partial<TabState>) => {
    setTabs((previous) => ({ ...previous, [key]: { ...previous[key], ...patch } }));
  }, []);

  const appendLine = useCallback((key: string, line: OutputLine) => {
    setTabs((previous) => ({
      ...previous,
      [key]: { ...previous[key], output: [...previous[key].output, line] },
    }));
  }, []);

  const recordResult = (exerciseId: string, result: SubmitResult) => {
    setStats((previous) => {
      const old = previous[exerciseId] ?? { attempts: 0, passed: false, score: 0 };
      return {
        ...previous,
        [exerciseId]: {
          attempts: result.attempts,
          passed: old.passed || result.passed,
          score: old.score + result.awarded,
        },
      };
    });
    setLessonStatus(result.lesson_status);
  };

  // ---------------------------------------------------------------- รันโค้ด

  const handleRun = async (key: string) => {
    const runner = runnerRef.current;
    if (!runner || !runnableLanguage || busy) return;
    const tab = tabs[key];
    const exercise = codeExercises.find((e) => e.id === key);
    const source = exercise ? buildSource(tab.code, exercise.cases[tab.caseIndex] ?? { before: "", after: "" }) : tab.code;

    patchTab(key, { output: [], drawing: null, feedback: null });
    setBusy({ tab: key, mode: "run" });
    await runner.run(
      runnableLanguage,
      source,
      (line) => appendLine(key, line),
      setRunNote,
      (drawing) => patchTab(key, { drawing }),
    );
    setBusy(null);
    setRunNote("");
  };

  const handleStop = () => runnerRef.current?.stop();

  // ตัวอย่างสาธิตในเนื้อหาบทเรียน (```ภาษา demo): รันแล้วคืนผลให้แสดงใต้โค้ดนั้น ไม่ยุ่งกับตัวแก้ไข
  const runDemo = async (code: string): Promise<DemoResult> => {
    const runner = runnerRef.current;
    if (!runner || !runnableLanguage) return { lines: [], drawing: null };
    if (busy) {
      return { lines: [{ kind: "info", text: "กำลังตรวจหรือรันโค้ดอื่นอยู่ รอให้เสร็จแล้วกดอีกครั้ง" }], drawing: null };
    }
    const lines: OutputLine[] = [];
    let drawing: Drawing | null = null;
    await runner.run(runnableLanguage, code, (line) => lines.push(line), setRunNote, (next) => {
      drawing = next;
    });
    setRunNote("");
    return { lines, drawing };
  };

  // ---------------------------------------------------------------- ส่งตรวจโค้ด

  const handleSubmitCode = async (exercise: CodeExercise) => {
    const runner = runnerRef.current;
    if (busy || (!isWeb && (!runner || !runnableLanguage))) return;
    const key = exercise.id;
    const code = tabs[key].code;

    if (!token) {
      patchTab(key, { feedback: { kind: "error", text: "ต้องเข้าสู่ระบบก่อนจึงจะส่งตรวจและเก็บคะแนนได้", lines: [] } });
      return;
    }
    if (!code.trim()) {
      patchTab(key, { feedback: { kind: "error", text: "ยังไม่ได้เขียนโค้ด", lines: [] } });
      return;
    }

    setActiveTab(key);
    patchTab(key, { output: [], feedback: null });
    setBusy({ tab: key, mode: "submit" });

    let runs: CaseRun[] = [];
    try {
      runs =
        isWeb || !runner || !runnableLanguage
          ? await runWebCases(code, exercise.cases)
          : await runCases(runner, runnableLanguage, code, exercise.cases, setRunNote);
    } finally {
      setRunNote("");
    }

    const failedRun = runs.find((run) => run.status !== "ok");
    if (failedRun || runs.length !== exercise.cases.length) {
      const stopped = failedRun?.status === "stopped";
      patchTab(key, {
        feedback: {
          kind: "error",
          text: stopped
            ? "ยกเลิกการตรวจแล้ว"
            : failedRun?.status === "timeout"
              ? "โค้ดทำงานนานเกินไป (อาจมี loop ที่ไม่มีวันจบ) จึงยังไม่ได้ส่งตรวจ ไม่นับเป็นครั้งที่ตอบ"
              : "โค้ดรันไม่สำเร็จ จึงยังไม่ได้ส่งตรวจ (ไม่นับเป็นครั้งที่ตอบ) ดูข้อความ error ด้านล่าง",
          lines: failedRun?.errorLines ?? [],
        },
      });
      setBusy(null);
      return;
    }

    try {
      const result = await submitExercise(token, exercise.id, {
        answer: code,
        outputs: runs.map((run) => run.output),
      });
      recordResult(exercise.id, result);
      patchTab(key, { feedback: { kind: "result", result, outputs: runs.map((run) => run.output) } });
    } catch (error) {
      patchTab(key, { feedback: { kind: "error", text: errorMessage(error), lines: [] } });
    } finally {
      setBusy(null);
    }
  };

  // ---------------------------------------------------------------- ปรนัย

  const handleSubmitMcq = async (exercise: McqExercise) => {
    const choice = choices[exercise.id];
    if (!choice || mcqBusy) return;
    if (!token) {
      setMcqResults((previous) => ({
        ...previous,
        [exercise.id]: { error: "ต้องเข้าสู่ระบบก่อนจึงจะส่งคำตอบและเก็บคะแนนได้" },
      }));
      return;
    }
    setMcqBusy(exercise.id);
    try {
      const result = await submitExercise(token, exercise.id, { answer: choice });
      recordResult(exercise.id, result);
      setMcqResults((previous) => ({ ...previous, [exercise.id]: result }));
    } catch (error) {
      setMcqResults((previous) => ({ ...previous, [exercise.id]: { error: errorMessage(error) } }));
    } finally {
      setMcqBusy(null);
    }
  };

  // ---------------------------------------------------------------- อื่น ๆ

  const handleComplete = async () => {
    if (!token || completing) return;
    setCompleting(true);
    try {
      const data = await completeLesson(token, lesson.id);
      setLessonStatus(data.status);
    } catch (error) {
      setProgressError(true);
      console.error(errorMessage(error));
    } finally {
      setCompleting(false);
    }
  };

  const tryCode = (code: string) => {
    setActiveTab(FREE_TAB);
    patchTab(FREE_TAB, { code, output: [], drawing: null });
    document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openExerciseEditor = (exerciseId: string) => {
    setActiveTab(exerciseId);
    document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const totalPoints = exercises.reduce((sum, e) => sum + e.points, 0);
  const earnedPoints = exercises.reduce((sum, e) => sum + (stats[e.id]?.score ?? 0), 0);

  const active = tabs[activeTab] ?? tabs[FREE_TAB];
  const activeExercise = codeExercises.find((e) => e.id === activeTab) ?? null;
  const isBusyHere = busy?.tab === activeTab;
  // error จากการรันล่าสุดของตัวแก้ไขที่เปิดอยู่ ส่งให้ AI Tutor ใช้อธิบาย (เฉพาะเมื่อผู้เรียนเปิดสวิตช์แนบโค้ด)
  const activeError =
    active.output
      .filter((line) => line.kind === "stderr")
      .map((line) => line.text)
      .join("\n") || null;
  const outputPane = (
    <pre className="output" aria-live="polite">
      {active.output.length === 0 ? (
        <span className="muted">
          {active.drawing ? "โค้ดนี้วาดภาพ ดูภาพด้านล่าง" : "กด “รันโค้ด” เพื่อดูผลลัพธ์ที่นี่"}
        </span>
      ) : (
        active.output.map((line, index) => (
          <div key={index} className={`line ${line.kind}`}>
            {line.text === "" ? " " : line.text}
          </div>
        ))
      )}
    </pre>
  );

  return (
    <main className="container">
      <nav className="breadcrumb small" aria-label="เส้นทาง">
        <Link href="/lessons">บทเรียน</Link>
        <span aria-hidden> / </span>
        <Link href={`/lessons/${course.slug}`}>{course.title}</Link>
      </nav>

      <div className="lesson-grid">
        <div className="lesson-main">
          <article className="panel">
            <div className="lesson-meta small muted">
              <span>{course.language.name}</span>
              <span>· อ่านประมาณ {lesson.estimated_minutes} นาที</span>
              {lessonStatus === "completed" ? <span className="ok">· ✓ เรียนจบแล้ว</span> : null}
            </div>
            <Markdown
              source={lesson.content_md}
              runnableLang={isWeb ? "html" : (runnableLanguage ?? undefined)}
              onTryCode={tryCode}
              onRunDemo={runDemo}
            />
          </article>

          {exercises.length > 0 ? (
            <section className="panel exercises" aria-label="แบบฝึกหัด">
              <div className="panel-head">
                <h2>แบบฝึกหัด</h2>
                <span className="badge">
                  {token ? `${earnedPoints}/${totalPoints} คะแนน` : `${totalPoints} คะแนน`}
                </span>
              </div>

              {sessionStatus !== "loading" && !token ? (
                <p className="notice small">
                  อยากเก็บคะแนนและความคืบหน้า?{" "}
                  <button className="link" onClick={() => void signIn("github")}>
                    เข้าสู่ระบบด้วย GitHub
                  </button>{" "}
                  (ฟรี) ส่วนการอ่านบทเรียนและลองเขียนโค้ดไม่ต้องล็อกอิน
                </p>
              ) : null}
              {progressError ? (
                <p className="small warning-text">โหลดความคืบหน้าไม่สำเร็จ (คะแนนเดิมอาจยังไม่แสดง) ลองรีเฟรชหน้านี้</p>
              ) : null}

              <ol className="exercise-list">
                {exercises.map((exercise, index) => {
                  const stat = stats[exercise.id];
                  return (
                    <li key={exercise.id} className={`exercise${stat?.passed ? " done" : ""}`}>
                      <div className="exercise-head">
                        <strong>ข้อ {index + 1}</strong>
                        <span className="badge">
                          {exercise.kind === "mcq" ? "ปรนัย" : "เขียนโค้ด"} · {exercise.points} คะแนน
                        </span>
                        {stat?.passed ? (
                          <span className="ok small">
                            ✓ ผ่านแล้ว{stat.score > 0 ? ` (ได้ ${stat.score} คะแนน)` : ""}
                          </span>
                        ) : null}
                      </div>
                      <p className="prompt">
                        <InlineText text={exercise.prompt} />
                      </p>

                      {exercise.kind === "mcq" ? (
                        <McqBlock
                          exercise={exercise}
                          choice={choices[exercise.id]}
                          result={mcqResults[exercise.id]}
                          locked={Boolean(stat?.passed)}
                          busy={mcqBusy === exercise.id}
                          onChoose={(id) => setChoices((previous) => ({ ...previous, [exercise.id]: id }))}
                          onSubmit={() => void handleSubmitMcq(exercise)}
                        />
                      ) : canCode ? (
                        <CodeExerciseBlock
                          web={isWeb}
                          exercise={exercise}
                          feedback={tabs[exercise.id]?.feedback ?? null}
                          running={busy?.tab === exercise.id && busy.mode === "submit"}
                          disabled={busy !== null}
                          onOpen={() => openExerciseEditor(exercise.id)}
                          onSubmit={() => void handleSubmitCode(exercise)}
                        />
                      ) : (
                        <p className="small muted">ภาษานี้ยังรันในเบราว์เซอร์ไม่ได้ จึงยังทำข้อนี้ไม่ได้</p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </section>
          ) : null}

          <section className="panel lesson-footer">
            {token && lessonStatus !== "completed" ? (
              <button className="btn" onClick={() => void handleComplete()} disabled={completing}>
                {completing ? "กำลังบันทึก…" : "✓ ทำเครื่องหมายว่าเรียนจบบทนี้"}
              </button>
            ) : null}
            {lessonStatus === "completed" ? <span className="ok">✓ เรียนจบบทนี้แล้ว</span> : null}
            {lessonStatus === "completed" && !next ? (
              <span className="small">🎉 นี่คือบทสุดท้ายของคอร์ส ดูสรุปได้ที่หน้ารายการบทเรียน</span>
            ) : null}
            <div className="spacer" />
            {prev ? (
              <Link className="btn" href={`/lessons/${course.slug}/${prev.slug}`}>
                ← {prev.title}
              </Link>
            ) : null}
            {next ? (
              <Link className="btn btn-primary" href={`/lessons/${course.slug}/${next.slug}`}>
                {next.title} →
              </Link>
            ) : (
              <Link className="btn btn-primary" href={`/lessons/${course.slug}`}>
                กลับไปรายการบทเรียน
              </Link>
            )}
          </section>
        </div>

        <aside id="workspace" className="panel workspace" aria-label="ตัวแก้ไขโค้ด">
          {editorLanguage ? (
            <>
              <div className="tabs" role="tablist">
                <button
                  role="tab"
                  aria-selected={activeTab === FREE_TAB}
                  className={`tab${activeTab === FREE_TAB ? " active" : ""}`}
                  onClick={() => setActiveTab(FREE_TAB)}
                >
                  ลองเขียนเอง
                </button>
                {codeExercises.map((exercise) => (
                  <button
                    key={exercise.id}
                    role="tab"
                    aria-selected={activeTab === exercise.id}
                    className={`tab${activeTab === exercise.id ? " active" : ""}`}
                    onClick={() => setActiveTab(exercise.id)}
                  >
                    ข้อ {exercises.indexOf(exercise) + 1}
                    {stats[exercise.id]?.passed ? " ✓" : ""}
                  </button>
                ))}
              </div>

              <div className="toolbar">
                {activeExercise && !isWeb ? (
                  <label className="field">
                    <span className="small muted">รันด้วยตัวอย่าง</span>
                    <select
                      value={active.caseIndex}
                      onChange={(event) => patchTab(activeTab, { caseIndex: Number(event.target.value) })}
                      disabled={busy !== null}
                    >
                      {activeExercise.cases.map((_, index) => (
                        <option key={index} value={index}>
                          ตัวอย่างที่ {index + 1}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <div className="spacer" />
                {isWeb ? (
                  <span className="small muted">ตัวอย่างผลลัพธ์อัปเดตให้อัตโนมัติ</span>
                ) : isBusyHere ? (
                  <button className="btn btn-danger" onClick={handleStop}>
                    ■ หยุด
                  </button>
                ) : (
                  <button className="btn btn-primary" onClick={() => void handleRun(activeTab)} disabled={busy !== null}>
                    ▶ รันโค้ด
                  </button>
                )}
              </div>

              <CodeEditor
                key={activeTab}
                path={`${activeTab}.${fileExt}`}
                language={editorLanguage}
                value={active.code}
                onChange={(value) => patchTab(activeTab, { code: value, feedback: null })}
                onRun={() => void handleRun(activeTab)}
              />
              <p className="small muted hint">
                {isWeb
                  ? "เขียน HTML และ CSS (ใส่ CSS ในแท็ก <style>) ผลลัพธ์แสดงด้านล่าง · สคริปต์ในหน้าเว็บจะไม่ทำงานเพื่อความปลอดภัย"
                  : "กด Ctrl/⌘ + Enter เพื่อรัน · โค้ดทำงานในเบราว์เซอร์ของคุณเอง"}
                {languageSlug === "python" ? " · input() ยังไม่รองรับ" : ""}
              </p>
              {activeExercise && !isWeb ? (
                <CaseHint exercise={activeExercise} index={active.caseIndex} />
              ) : null}

              <div className="output-head">
                <h2>{isWeb ? "ตัวอย่างผลลัพธ์" : "ผลลัพธ์"}</h2>
                {runNote ? <span className="small muted">{runNote}</span> : null}
              </div>
              {isWeb ? <HtmlPreview code={active.code} /> : outputPane}
              {!isWeb && active.drawing ? <TurtleCanvas drawing={active.drawing} /> : null}
            </>
          ) : (
            <p className="muted small">ภาษานี้ยังไม่มีตัวรันโค้ดในเบราว์เซอร์ (อ่านบทเรียนได้อย่างเดียว)</p>
          )}
        </aside>
      </div>

      <TutorChat lessonId={lesson.id} code={canCode ? active.code : null} lastError={activeError} />
    </main>
  );
}

// ---------------------------------------------------------------- ส่วนย่อย

function CaseHint({ exercise, index }: { exercise: CodeExercise; index: number }) {
  const spec = exercise.cases[index];
  if (!spec || (spec.before.trim() === "" && spec.after.trim() === "")) return null;
  return (
    <div className="case-hint small">
      <span className="muted">ตัวอย่างที่ {index + 1} ระบบจะ{spec.before.trim() ? "ใส่ไว้ก่อนโค้ดของคุณ" : ""}
        {spec.before.trim() && spec.after.trim() ? " และ" : ""}
        {spec.after.trim() ? "ต่อท้ายโค้ดของคุณ" : ""}
        {" "}(เลขบรรทัดใน error อาจเลื่อนไปตามจำนวนบรรทัดที่ระบบใส่ให้)
      </span>
      {spec.before.trim() ? <pre>{spec.before}</pre> : null}
      {spec.after.trim() ? <pre>{spec.after}</pre> : null}
    </div>
  );
}

function McqBlock({
  exercise,
  choice,
  result,
  locked,
  busy,
  onChoose,
  onSubmit,
}: {
  exercise: McqExercise;
  choice: string | undefined;
  result: SubmitResult | { error: string } | undefined;
  locked: boolean;
  busy: boolean;
  onChoose: (id: string) => void;
  onSubmit: () => void;
}) {
  const submitted = result && "passed" in result ? result : null;
  return (
    <div className="stack">
      <fieldset className="options" disabled={locked || busy}>
        <legend className="sr-only">ตัวเลือกของข้อนี้</legend>
        {exercise.options.map((option) => {
          const isCorrect = submitted?.correct_option_id === option.id;
          return (
            <label key={option.id} className={`option${choice === option.id ? " selected" : ""}${isCorrect ? " correct" : ""}`}>
              <input
                type="radio"
                name={`ex-${exercise.id}`}
                value={option.id}
                checked={choice === option.id}
                onChange={() => onChoose(option.id)}
              />
              <span>
                <InlineText text={option.text} />
              </span>
            </label>
          );
        })}
      </fieldset>

      {!locked ? (
        <div>
          <button className="btn" onClick={onSubmit} disabled={!choice || busy}>
            {busy ? "กำลังตรวจ…" : "ตรวจคำตอบ"}
          </button>
        </div>
      ) : null}

      {result && "error" in result ? <p className="small error-text">{result.error}</p> : null}
      {submitted ? (
        <div className={`result ${submitted.passed ? "pass" : "fail"}`}>
          <strong>
            {submitted.passed
              ? submitted.awarded > 0
                ? `ถูกต้อง! ได้ ${submitted.awarded} คะแนน`
                : "ถูกต้อง (เคยได้คะแนนข้อนี้ไปแล้ว)"
              : "ยังไม่ถูก ลองอ่านบทเรียนอีกรอบแล้วเลือกใหม่ได้"}
          </strong>
          {submitted.explanation ? <p className="small">{submitted.explanation}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function CodeExerciseBlock({
  web,
  exercise,
  feedback,
  running,
  disabled,
  onOpen,
  onSubmit,
}: {
  web: boolean;
  exercise: CodeExercise;
  feedback: Feedback | null;
  running: boolean;
  disabled: boolean;
  onOpen: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="stack">
      <p className="small muted">
        {web
          ? `เขียน HTML/CSS ในตัวแก้ไขด้านขวา (บนมือถืออยู่ด้านล่างของหน้า) ระบบจะตรวจหน้าเว็บของคุณ ${exercise.cases.length} ข้อ`
          : `เขียนโค้ดในตัวแก้ไขด้านขวา (บนมือถืออยู่ด้านล่างของหน้า) ระบบจะรันโค้ดของคุณ ${exercise.cases.length} รอบด้วยค่าที่ต่างกัน`}
      </p>
      <div className="row">
        <button className="btn" onClick={onOpen}>
          เปิดตัวแก้ไขข้อนี้
        </button>
        <button className="btn btn-primary" onClick={onSubmit} disabled={disabled}>
          {running ? "กำลังตรวจ…" : "✓ ส่งตรวจ"}
        </button>
      </div>
      {feedback ? <CodeFeedback web={web} exercise={exercise} feedback={feedback} /> : null}
    </div>
  );
}

function CodeFeedback({ web, exercise, feedback }: { web: boolean; exercise: CodeExercise; feedback: Feedback }) {
  if (feedback.kind === "error") {
    return (
      <div className="result fail" role="status">
        <strong>{feedback.text}</strong>
        {feedback.lines.length > 0 ? (
          <pre className="output small-output">{feedback.lines.join("\n")}</pre>
        ) : null}
      </div>
    );
  }

  const { result, outputs } = feedback;
  const expectedByIndex = new Map((result.failed_cases ?? []).map((item) => [item.index, item.expected]));
  return (
    <div className={`result ${result.passed ? "pass" : "fail"}`} role="status">
      <strong>
        {result.passed
          ? result.awarded > 0
            ? `ผ่านทุกตัวอย่าง! ได้ ${result.awarded} คะแนน`
            : "ผ่านทุกตัวอย่าง (เคยได้คะแนนข้อนี้ไปแล้ว)"
          : web
            ? "ยังไม่ผ่านทุกข้อ ลองดูข้อที่ไม่ผ่านด้านล่างแล้วแก้โค้ดได้"
            : "ยังไม่ผ่านทุกตัวอย่าง ลองดูผลด้านล่างแล้วแก้โค้ดได้"}
      </strong>
      <ul className="case-results">
        {(result.cases ?? []).map((passed, index) => (
          <li key={index} className={passed ? "ok" : "error-text"}>
            <span>
              {passed ? "✓" : "✗"} {web ? `ข้อกำหนดที่ ${index + 1}` : `ตัวอย่างที่ ${index + 1}`}
              {web && exercise.cases[index]?.before.trim() ? `: ${exercise.cases[index].before}` : ""}
            </span>
            {!passed && web ? (
              <div className="small">
                <div>
                  <span className="muted">ที่พบในหน้าเว็บของคุณ:</span>{" "}
                  <code>{outputs[index] === "" ? "(ไม่พบ)" : outputs[index].replace(/\n/g, " , ")}</code>
                </div>
                <div>
                  <span className="muted">ที่ต้องการ:</span>{" "}
                  <code>{(expectedByIndex.get(index) ?? "").replace(/\n/g, " , ")}</code>
                </div>
              </div>
            ) : null}
            {!passed && !web ? (
              <div className="small">
                <div>
                  <span className="muted">โค้ดของคุณแสดง:</span> <code>{outputs[index] === "" ? "(ไม่มีผลลัพธ์)" : outputs[index]}</code>
                </div>
                <div>
                  <span className="muted">ที่ต้องการ:</span> <code>{expectedByIndex.get(index) ?? ""}</code>
                </div>
                {exercise.cases[index]?.before.trim() ? (
                  <div className="muted">
                    เมื่อกำหนด: <code>{exercise.cases[index].before.replace(/\n/g, "; ")}</code>
                  </div>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {result.explanation ? <p className="small">{result.explanation}</p> : null}
    </div>
  );
}
