"use client";

import { signIn, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

import Markdown from "@/components/Markdown";
import { fetchAiStatus, requestTutor, type AiStatus, type ChatMessage } from "@/lib/ai";
import { ApiError } from "@/lib/api";

const MAX_INPUT_CHARS = 1000;
const MAX_SENT_MESSAGES = 10;

const QUICK_PROMPTS = [
  "อธิบายบทนี้ให้ง่ายขึ้นหน่อย",
  "โค้ดของฉันผิดตรงไหน",
  "ขอคำใบ้ข้อที่ติดอยู่ (ไม่ต้องเฉลย)",
];

type Props = {
  lessonId: string;
  /** โค้ดในตัวแก้ไขที่เปิดอยู่ตอนนี้ (ส่งให้ AI ก็ต่อเมื่อผู้เรียนเปิดสวิตช์แนบโค้ด) */
  code: string | null;
  /** ข้อความ error จากการรันล่าสุดของโค้ดนั้น */
  lastError: string | null;
};

export default function TutorChat({ lessonId, code, lastError }: Props) {
  const { data: session, status: sessionStatus } = useSession();
  const token = session?.accessToken;

  const [open, setOpen] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [aiStatusFailed, setAiStatusFailed] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [quotaBlocked, setQuotaBlocked] = useState(false);
  const [attachCode, setAttachCode] = useState(true);

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  // เช็คว่าระบบ AI เปิดอยู่ไหมตอนเปิดแผงครั้งแรก (ไม่โหลดอะไรเลยถ้าผู้เรียนไม่เปิด)
  useEffect(() => {
    if (!open || aiStatus || aiStatusFailed) return;
    let cancelled = false;
    fetchAiStatus()
      .then((status) => {
        if (!cancelled) setAiStatus(status);
      })
      .catch(() => {
        if (!cancelled) setAiStatusFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, aiStatus, aiStatusFailed]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages, busy, error, open]);

  const ask = async (history: ChatMessage[]) => {
    if (!token || busy) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setBusy(true);
    setError(null);
    try {
      const result = await requestTutor(
        token,
        {
          lesson_id: lessonId,
          messages: history.slice(-MAX_SENT_MESSAGES),
          code: attachCode && code && code.trim() ? code : null,
          last_output: attachCode && lastError ? lastError : null,
        },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setMessages([...history, { role: "assistant", content: result.reply }]);
      setRemaining(result.remaining_today);
    } catch (err) {
      if (controller.signal.aborted) return;
      if (err instanceof ApiError) {
        setError(err.status === 401 ? "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง" : err.message);
        if (err.code === "daily_quota" || err.code === "global_quota") setQuotaBlocked(true);
      } else {
        setError("ติดต่อ AI ไม่สำเร็จ (ถ้าเซิร์ฟเวอร์เพิ่งตื่น ลองใหม่อีกครั้งในอีกสักครู่)");
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setBusy(false);
      }
    }
  };

  const send = (text: string) => {
    const content = text.trim().slice(0, MAX_INPUT_CHARS);
    if (!content || busy || quotaBlocked) return;
    const history: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(history);
    setInput("");
    void ask(history);
  };

  const retry = () => {
    if (messages.length > 0 && messages[messages.length - 1].role === "user") void ask(messages);
  };

  const clear = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setMessages([]);
    setError(null);
    setBusy(false);
  };

  if (!open) {
    return (
      <button className="tutor-fab btn btn-primary" onClick={() => setOpen(true)} aria-label="เปิดแชต AI Tutor">
        💬 ถาม AI Tutor
      </button>
    );
  }

  const unavailable = aiStatusFailed
    ? "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ในตอนนี้ (อาจกำลังตื่นจากการพัก) ลองปิดแล้วเปิดแชตใหม่อีกครั้ง"
    : aiStatus && !aiStatus.enabled
      ? "ผู้ดูแลยังไม่ได้เปิดใช้ระบบ AI — อ่านบทเรียนและทำแบบฝึกหัดได้ตามปกติ"
      : null;

  const ready = Boolean(token) && aiStatus?.enabled === true && !quotaBlocked;
  const lastIsUser = messages.length > 0 && messages[messages.length - 1].role === "user";

  return (
    <section className="tutor-panel" aria-label="แชต AI Tutor">
      <div className="tutor-head">
        <strong>AI Tutor</strong>
        <span className="badge">เสริม · ปิดได้</span>
        <div className="spacer" />
        {messages.length > 0 ? (
          <button className="link" onClick={clear}>
            ล้างแชต
          </button>
        ) : null}
        <button className="tutor-close" onClick={() => setOpen(false)} aria-label="ปิดแชต">
          ✕
        </button>
      </div>

      <div className="tutor-body" aria-live="polite">
        {unavailable ? (
          <p className="small muted">{unavailable}</p>
        ) : sessionStatus === "loading" || (!aiStatus && !aiStatusFailed) ? (
          <p className="small muted">กำลังเตรียมระบบ AI… (ครั้งแรกอาจใช้เวลาประมาณ 1 นาที)</p>
        ) : !token ? (
          <div className="stack">
            <p className="small">เข้าสู่ระบบเพื่อคุยกับ AI Tutor (ฟรี วันละ {aiStatus?.daily_limit ?? 60} ข้อความ)</p>
            <div>
              <button className="btn btn-primary" onClick={() => void signIn("github")}>
                เข้าสู่ระบบด้วย GitHub
              </button>
            </div>
          </div>
        ) : (
          <>
            {messages.length === 0 ? (
              <div className="stack">
                <p className="small">
                  ถามอะไรเกี่ยวกับบทนี้ได้เลย AI จะให้คำใบ้และอธิบายแนวคิด แต่ไม่เฉลยแบบฝึกหัดให้ตรง ๆ
                </p>
                <div className="quick-prompts">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button key={prompt} className="btn btn-small" onClick={() => send(prompt)} disabled={!ready || busy}>
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ul className="tutor-messages">
                {messages.map((message, index) => (
                  <li key={index} className={`tutor-msg ${message.role}`}>
                    {message.role === "assistant" ? <Markdown source={message.content} /> : <p>{message.content}</p>}
                  </li>
                ))}
                {busy ? (
                  <li className="tutor-msg assistant">
                    <p className="muted">AI กำลังคิด…</p>
                  </li>
                ) : null}
              </ul>
            )}

            {error ? (
              <div className="stack">
                <p className="small error-text">{error}</p>
                {lastIsUser && !quotaBlocked ? (
                  <div>
                    <button className="btn btn-small" onClick={retry} disabled={busy}>
                      ลองส่งอีกครั้ง
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
            {quotaBlocked ? <p className="small muted">โควต้า AI วันนี้หมดแล้ว พรุ่งนี้กลับมาใช้ใหม่ได้</p> : null}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {token && !unavailable ? (
        <div className="tutor-foot">
          <label className="switch small">
            <input type="checkbox" checked={attachCode} onChange={(event) => setAttachCode(event.target.checked)} />
            <span>ให้ AI ดูโค้ดในตัวแก้ไขด้วย</span>
          </label>
          <div className="tutor-input">
            <textarea
              value={input}
              rows={2}
              maxLength={MAX_INPUT_CHARS}
              placeholder={quotaBlocked ? "โควต้าวันนี้หมดแล้ว" : "พิมพ์คำถาม (Enter ส่ง, Shift+Enter ขึ้นบรรทัดใหม่)"}
              disabled={!ready}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  send(input);
                }
              }}
              aria-label="พิมพ์คำถามถาม AI Tutor"
            />
            <button className="btn btn-primary" onClick={() => send(input)} disabled={!ready || busy || !input.trim()}>
              ส่ง
            </button>
          </div>
          <p className="small muted privacy">
            ข้อความ{attachCode ? "และโค้ดที่แนบ" : ""}จะถูกส่งไปยังผู้ให้บริการ AI ภายนอก อย่าใส่รหัสผ่านหรือข้อมูลส่วนตัว AI อาจตอบผิดได้
            {remaining !== null ? ` · เหลือโควต้าวันนี้ ${remaining} ครั้ง` : ""}
          </p>
        </div>
      ) : null}
    </section>
  );
}
