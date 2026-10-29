import Link from "next/link";
import { notFound } from "next/navigation";

import LessonList from "@/components/LessonList";
import { ApiError } from "@/lib/api";
import { fetchCourse, type CourseDetail } from "@/lib/learn";

export const dynamic = "force-dynamic";

export default async function CoursePage({ params }: { params: Promise<{ course: string }> }) {
  const { course: slug } = await params;

  let course: CourseDetail | null = null;
  let failed = false;
  try {
    course = await fetchCourse(slug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    failed = true;
  }

  return (
    <main className="container narrow">
      <nav className="breadcrumb small" aria-label="เส้นทาง">
        <Link href="/lessons">บทเรียน</Link>
      </nav>

      {course ? (
        <>
          <h1>{course.title}</h1>
          <p className="muted">
            {course.language.name}
            {course.description ? ` · ${course.description}` : ""}
          </p>
          <LessonList course={course} />
        </>
      ) : failed ? (
        <p className="error-text">
          ยังเชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ถ้าเพิ่งเปิดเว็บหลังไม่มีคนใช้สักพัก เซิร์ฟเวอร์ฟรีต้องใช้เวลาตื่นประมาณ 1 นาที ลองรีเฟรชอีกครั้ง
        </p>
      ) : null}
    </main>
  );
}
