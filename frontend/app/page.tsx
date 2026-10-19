import { apiFetch } from "@/lib/api";

type Language = { id: string; slug: string; name: string; runtime: string | null };

export default async function Home() {
  let languages: Language[] = [];
  let error: string | null = null;

  try {
    languages = await apiFetch<Language[]>("/content/languages");
  } catch {
    error = "ยังเชื่อมต่อ backend ไม่ได้ — ลองเช็คว่า API รันอยู่หรือยัง";
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: 32 }}>
      <h1>AI Code Learn</h1>
      <p>โครงเปล่า — ถ้าเห็นรายการภาษาด้านล่าง แปลว่าทุกชั้นต่อกันติดแล้ว</p>
      {error ? (
        <p style={{ color: "crimson" }}>{error}</p>
      ) : (
        <ul>
          {languages.map((l) => (
            <li key={l.id}>
              {l.name} ({l.runtime ?? "อ่านอย่างเดียว"})
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
