import { apiFetch } from "@/lib/api";

export type ReviewIssue = {
  line: number | null;
  severity: "error" | "warning" | "tip";
  message: string;
};

export type ReviewResult = {
  summary: string;
  issues: ReviewIssue[];
  remaining_today: number;
};

export type AiStatus = {
  enabled: boolean;
  daily_limit: number;
  max_code_chars: number;
};

export const fetchAiStatus = () => apiFetch<AiStatus>("/ai/status");

export function requestReview(
  token: string,
  body: { language: string; code: string; last_output?: string | null },
  signal: AbortSignal,
) {
  return apiFetch<ReviewResult>("/ai/review", {
    method: "POST",
    token,
    body: JSON.stringify(body),
    signal,
  });
}

// ---- AI Tutor (แชต) ----

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type TutorReply = { reply: string; remaining_today: number };

export function requestTutor(
  token: string,
  body: { lesson_id?: string; messages: ChatMessage[]; code?: string | null; last_output?: string | null },
  signal: AbortSignal,
) {
  return apiFetch<TutorReply>("/ai/tutor", {
    method: "POST",
    token,
    body: JSON.stringify(body),
    signal,
  });
}
