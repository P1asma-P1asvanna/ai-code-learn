import Link from "next/link";

import { apiFetch } from "@/lib/api";

// หน้านี้ดึงข้อมูลสดจาก backend ทุกครั้ง (ไม่ prerender ตอน build)
export const dynamic = "force-dynamic";

type Language = { id: string; slug: string; name: string; runtime: string | null };

export default async function Home() {
  let languages: Language[] = [];
  let failed = false;

  try {
    languages = await apiFetch<Language[]>("/content/languages");
  } catch {
    failed = true;
  }

  return (
    <main className="container">
      <h1>เรียนเขียนโค้ดฟรี</h1>
      <p className="muted">
        อ่านบทเรียน ลองเขียนโค้ดแล้วรันได้ทันที และเปิด AI ช่วยตรวจโค้ดเมื่ออยากได้คำใบ้
      </p>

      <p>
        <Link href="/playground" className="btn btn-primary">
          เปิด Playground
        </Link>
      </p>

      <h2>ภาษาที่มีให้เรียน</h2>
      {failed ? (
        <p className="error-text">
          ยังเชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ถ้าเพิ่งเปิดเว็บหลังไม่มีคนใช้สักพัก เซิร์ฟเวอร์ฟรีต้องใช้เวลาตื่นประมาณ 1 นาที
          ลองรีเฟรชอีกครั้ง
        </p>
      ) : languages.length === 0 ? (
        <p className="muted">ยังไม่มีบทเรียน</p>
      ) : (
        <ul className="cards">
          {languages.map((language) => (
            <li key={language.id} className="card">
              <strong>{language.name}</strong>
              <span className="small muted">
                {language.runtime ? "รันโค้ดได้ใน Playground" : "อ่านอย่างเดียว"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
