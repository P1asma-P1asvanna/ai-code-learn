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
