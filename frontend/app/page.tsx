import Link from "next/link";

import { fetchCourses, type CourseSummary } from "@/lib/learn";

// หน้านี้ดึงข้อมูลสดจาก backend ทุกครั้ง (ไม่ prerender ตอน build)
export const dynamic = "force-dynamic";

export default async function Home() {
  let courses: CourseSummary[] = [];
  let failed = false;

  try {
    courses = await fetchCourses();
  } catch {
    failed = true;
  }

  return (
    <main className="container">
      <h1>เรียนเขียนโค้ดฟรี</h1>
      <p className="muted">
        อ่านบทเรียน ลองเขียนโค้ดแล้วรันได้ทันที ทำแบบฝึกหัดเก็บคะแนน และเปิด AI ช่วยตรวจโค้ดเมื่ออยากได้คำใบ้
      </p>

      <p className="row">
        <Link href="/lessons" className="btn btn-primary">
          เริ่มเรียน
        </Link>
        <Link href="/playground" className="btn">
          เปิด Playground
        </Link>
      </p>

      <h2>คอร์สที่มีให้เรียน</h2>
      {failed ? (
        <p className="error-text">
          ยังเชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ถ้าเพิ่งเปิดเว็บหลังไม่มีคนใช้สักพัก เซิร์ฟเวอร์ฟรีต้องใช้เวลาตื่นประมาณ 1 นาที
          ลองรีเฟรชอีกครั้ง
        </p>
      ) : courses.length === 0 ? (
        <p className="muted">ยังไม่มีบทเรียน</p>
      ) : (
        <ul className="cards">
          {courses.map((course) => (
            <li key={course.id}>
              <Link href={`/lessons/${course.slug}`} className="card card-link">
                <span className="small muted">{course.language.name}</span>
                <strong>{course.title}</strong>
                {course.description ? <span className="small">{course.description}</span> : null}
                <span className="small muted">{course.lesson_count} บทเรียน</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
