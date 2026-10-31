import Link from "next/link";

import { fetchCourses, type CourseSummary } from "@/lib/learn";

// หน้านี้ดึงข้อมูลสดจาก backend ทุกครั้ง (ไม่ prerender ตอน build)
export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: "📖", title: "อ่านง่าย", text: "อธิบายด้วยภาษาง่าย ๆ เปรียบเทียบกับของใกล้ตัว แม้เด็กประถมก็เข้าใจ" },
  { icon: "▶️", title: "รันได้ในเบราว์เซอร์", text: "เขียนโค้ดแล้วกดรันได้เลย ไม่ต้องติดตั้งโปรแกรมใด ๆ" },
  { icon: "🎬", title: "ตัวอย่างสาธิต", text: "กดดูผลลัพธ์ได้ทันที รวมถึงวาดภาพด้วยโค้ด ให้เห็นว่าโค้ดทำอะไรได้บ้าง" },
  { icon: "🏆", title: "แบบฝึกหัดและคะแนน", text: "ทำโจทย์ ได้คะแนน สะสมป้ายความสำเร็จ และดูความคืบหน้าบน Dashboard" },
  { icon: "🤖", title: "AI Tutor ใจดี", text: "ถามคำถามได้ AI ให้คำใบ้โดยไม่เฉลยตรง ๆ และปิดได้ถ้าอยากคิดเอง" },
  { icon: "💸", title: "ฟรีทั้งหมด", text: "ไม่มีค่าใช้จ่าย ล็อกอินด้วย GitHub เพื่อเก็บคะแนนเท่านั้น" },
];

const STEPS = [
  { n: "1", title: "อ่านบทเรียน", text: "บทสั้น ๆ ใช้เวลาไม่เกิน 15 นาที" },
  { n: "2", title: "ดูตัวอย่างและลองเอง", text: "กดดูผลลัพธ์ แล้วแก้โค้ดเล่นดูว่าเกิดอะไรขึ้น" },
  { n: "3", title: "ทำแบบฝึกหัด", text: "ตอบคำถามและเขียนโค้ด ระบบตรวจให้ทันที" },
];

const FAQ = [
  { q: "ต้องเสียเงินหรือไม่?", a: "ไม่ต้อง ใช้ได้ฟรี ไม่มีค่าสมัครและไม่มีโฆษณาแฝงในบทเรียน" },
  { q: "ต้องติดตั้งโปรแกรมอะไรไหม?", a: "ไม่ต้อง ทุกอย่างทำงานในเบราว์เซอร์ของคุณ เขียนและรันโค้ดได้ในหน้าเว็บเลย" },
  { q: "ต้องล็อกอินไหม?", a: "อ่านบทเรียนและลองเขียนโค้ดได้โดยไม่ต้องล็อกอิน ล็อกอินด้วย GitHub เมื่ออยากเก็บคะแนน ความคืบหน้า และใช้ AI" },
  { q: "เหมาะกับใคร?", a: "คนที่ไม่เคยเขียนโค้ดมาก่อน รวมถึงนักเรียนที่เพิ่งเริ่มหัด เนื้อหาเริ่มจากศูนย์" },
];

export default async function Home() {
  let courses: CourseSummary[] = [];
  let failed = false;

  try {
    courses = await fetchCourses();
  } catch {
    failed = true;
  }

  return (
    <main className="container landing">
      <section className="hero">
        <h1>เรียนเขียนโค้ด ง่าย สนุก ฟรี</h1>
        <p className="hero-lead">
          อ่านบทเรียนที่อธิบายด้วยภาษาง่าย ๆ ดูตัวอย่างโค้ดทำงานให้เห็นกับตา เขียนและรันเองได้ทันทีในเบราว์เซอร์
          ไม่ต้องติดตั้งอะไร
        </p>
        <p className="row">
          <Link href="/lessons" className="btn btn-primary">
            เริ่มเรียนเลย
          </Link>
          <Link href="/playground" className="btn">
            ลองเขียนโค้ด (Playground)
          </Link>
        </p>
      </section>

      <section aria-label="คอร์สที่มีให้เรียน">
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
      </section>

      <section aria-label="จุดเด่น">
        <h2>ทำไมถึงเรียนง่าย</h2>
        <ul className="features">
          {FEATURES.map((f) => (
            <li key={f.title} className="feature">
              <span className="feature-icon" aria-hidden>
                {f.icon}
              </span>
              <strong>{f.title}</strong>
              <span className="small muted">{f.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="วิธีเรียน">
        <h2>เรียนอย่างไร</h2>
        <ol className="steps">
          {STEPS.map((s) => (
            <li key={s.n} className="step">
              <span className="step-num" aria-hidden>
                {s.n}
              </span>
              <strong>{s.title}</strong>
              <span className="small muted">{s.text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-label="คำถามที่พบบ่อย" className="faq">
        <h2>คำถามที่พบบ่อย</h2>
        {FAQ.map((item) => (
          <details key={item.q}>
            <summary>{item.q}</summary>
            <p className="small">{item.a}</p>
          </details>
        ))}
        <p className="small muted">
          อยากรู้ว่าเราเก็บข้อมูลอะไรบ้าง ดูที่ <Link href="/about">เกี่ยวกับเว็บนี้และความเป็นส่วนตัว</Link>
        </p>
      </section>
    </main>
  );
}
