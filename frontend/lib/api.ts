const API = process.env.NEXT_PUBLIC_API_URL!;

export async function apiFetch<T>(
  path: string,
  { token, ...init }: RequestInit & { token?: string } = {}
): Promise<T> {
  const res = await fetch(`${API}/api/v1${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

/** ปลุก backend ที่หลับอยู่ (Render free tier) */
export async function wakeBackend(): Promise<boolean> {
  try {
    const res = await fetch(`${API}/health`, { cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}
