import Link from "next/link";
import { notFound } from "next/navigation";

import LessonView from "@/components/LessonView";
import { ApiError } from "@/lib/api";
import { fetchLessonPage, type LessonPage } from "@/lib/learn";

export const dynamic = "force-dynamic";

export default async function LessonRoute({
  params,
}: {
  params: Promise<{ course: string; lesson: string }>;
}) {
  const { course, lesson } = await params;

  let page: LessonPage;
  try {
    page = await fetchLessonPage(course, lesson);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    return (
      <main className="container narrow">
        <nav className="breadcrumb small" aria-label="เส้นทาง">
          <Link href="/lessons">บทเรียน</Link>
        </nav>
        <p className="error-text">
          ยังเชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ถ้าเพิ่งเปิดเว็บหลังไม่มีคนใช้สักพัก เซิร์ฟเวอร์ฟรีต้องใช้เวลาตื่นประมาณ 1 นาที ลองรีเฟรชอีกครั้ง
        </p>
      </main>
    );
  }

  // key ทำให้ state (โค้ดที่พิมพ์ไว้ คำตอบที่เลือก) เริ่มใหม่ทุกครั้งที่เปลี่ยนบทเรียน
  return <LessonView key={page.lesson.id} page={page} />;
}
