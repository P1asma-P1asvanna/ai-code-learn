// ตัด / ท้าย URL ออกให้ เผื่อคัดลอกมาจาก Render แล้วติด / มาด้วย (ไม่งั้นจะได้ //api/v1 แล้วเรียกไม่ติด)
const API = (process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/+$/, "");

export class ApiError extends Error {
  status: number;
  /** รหัสที่ backend ส่งมา เช่น "daily_quota" (ถ้ามี) */
  code: string | null;

  constructor(status: number, message: string, code: string | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type ApiOptions = Omit<RequestInit, "headers"> & {
  token?: string;
  headers?: Record<string, string>;
};

export async function apiFetch<T>(
  path: string,
  { token, headers, ...init }: ApiOptions = {},
): Promise<T> {
  const res = await fetch(`${API}/api/v1${path}`, {
    ...init,
    headers: {
      // ใส่ Content-Type เฉพาะตอนมี body — GET ที่ไม่มีหัวนี้เบราว์เซอร์ไม่ต้องส่งคำขอ preflight (OPTIONS)
      // เพิ่มอีกรอบ ซึ่งสำคัญเมื่อ backend ฟรีเพิ่งตื่น เพราะทุกรอบเสียเวลา
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    let code: string | null = null;
    try {
      const body = (await res.json()) as { detail?: unknown };
      const detail = body.detail;
      if (typeof detail === "string") {
        message = detail;
      } else if (detail && typeof detail === "object") {
        const d = detail as { message?: unknown; code?: unknown };
        if (typeof d.message === "string") message = d.message;
        if (typeof d.code === "string") code = d.code;
      }
    } catch {
      // ตัวตอบกลับไม่ใช่ JSON — ใช้ข้อความ HTTP เดิม
    }
    throw new ApiError(res.status, message, code);
  }
  return (await res.json()) as T;
}

/** ปลุก backend ที่หลับอยู่ (Render free tier) — ไม่ throw */
export async function wakeBackend(): Promise<boolean> {
  try {
    const res = await fetch(`${API}/health`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}
