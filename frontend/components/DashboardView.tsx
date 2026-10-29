"use client";

import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { ApiError } from "@/lib/api";
import { fetchDashboard, type DashboardData, type LessonStatus } from "@/lib/learn";

const STATUS_LABEL: Record<LessonStatus, string> = {
  not_started: "ยังไม่เริ่ม",
  in_progress: "กำลังเรียน",
  completed: "เรียนจบแล้ว",
};

function percent(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

function Meter({ value, label }: { value: number; label: string }) {
  return (
    <div className="meter" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className="meter-fill" style={{ width: `${value}%` }} />
    </div>
  );
}

export default function DashboardView() {
  const { data: session, status: sessionStatus } = useSession();
  const token = session?.accessToken;

  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setError(null);
    fetchDashboard(token)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(
          err instanceof ApiError && err.status === 401
            ? "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง"
            : "โหลดข้อมูลไม่สำเร็จ (ถ้าเพิ่งเปิดเว็บ เซิร์ฟเวอร์ฟรีต้องใช้เวลาตื่นประมาณ 1 นาที) ลองรีเฟรชอีกครั้ง",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (sessionStatus === "loading") {
    return <p className="muted">กำลังตรวจสอบการเข้าสู่ระบบ…</p>;
  }

  if (!token) {
    return (
      <div className="panel stack">
        <p>เข้าสู่ระบบเพื่อดูคะแนนและความคืบหน้าของคุณ (ฟรี)</p>
        <div>
          <button className="btn btn-primary" onClick={() => void signIn("github")}>
            เข้าสู่ระบบด้วย GitHub
          </button>
        </div>
      </div>
    );
  }

  if (error) return <p className="error-text">{error}</p>;
  if (!data) return <p className="muted">กำลังโหลดข้อมูล… (ครั้งแรกอาจใช้เวลาประมาณ 1 นาที)</p>;

  const scorePercent = percent(data.total_score, data.max_score);
  const allDone = data.lessons_total > 0 && data.lessons_completed === data.lessons_total;

  return (
    <div className="stack dashboard">
      <div className="tiles">
        <div className="tile">
          <span className="small muted">คะแนนรวม</span>
          <strong className="tile-value">
            {data.total_score}
            <span className="tile-of"> / {data.max_score}</span>
          </strong>
          <Meter value={scorePercent} label="คะแนนรวม" />
        </div>
        <div className="tile">
          <span className="small muted">บทเรียนที่เรียนจบ</span>
          <strong className="tile-value">
            {data.lessons_completed}
            <span className="tile-of"> / {data.lessons_total}</span>
          </strong>
          <Meter value={percent(data.lessons_completed, data.lessons_total)} label="บทเรียนที่เรียนจบ" />
        </div>
        <div className="tile">
          <span className="small muted">แบบฝึกหัดที่ผ่าน</span>
          <strong className="tile-value">
            {data.exercises_passed}
            <span className="tile-of"> / {data.exercises_total}</span>
          </strong>
          <Meter value={percent(data.exercises_passed, data.exercises_total)} label="แบบฝึกหัดที่ผ่าน" />
        </div>
      </div>

      <section className="panel" aria-label="เรียนต่อ">
        <h2>เรียนต่อ</h2>
        {data.next_up ? (
          <div className="row next-up">
            <div>
              <strong>{data.next_up.title}</strong>
              <div className="small muted">
                {data.next_up.course_title} · {STATUS_LABEL[data.next_up.status]}
              </div>
            </div>
            <div className="spacer" />
            <Link className="btn btn-primary" href={`/lessons/${data.next_up.course_slug}/${data.next_up.slug}`}>
              {data.next_up.status === "in_progress" ? "เรียนต่อ →" : "เริ่มเรียน →"}
            </Link>
          </div>
        ) : allDone ? (
          <p className="ok">เรียนจบทุกบทแล้ว เก่งมาก! 🎉 ลองเอาความรู้ไปเขียนโปรแกรมของตัวเองใน Playground ได้เลย</p>
        ) : (
          <p className="muted">ยังไม่มีบทเรียน</p>
        )}
      </section>

      <section className="panel" aria-label="ความคืบหน้าแยกตามคอร์ส">
        <h2>ความคืบหน้าแยกตามคอร์ส</h2>
        <ul className="course-progress">
          {data.courses.map((course) => (
            <li key={course.slug}>
              <div className="row">
                <Link href={`/lessons/${course.slug}`}>
                  <strong>{course.title}</strong>
                </Link>
                <div className="spacer" />
                <span className="small muted">
                  {course.lessons_completed}/{course.lessons_total} บท · {course.score}/{course.max_score} คะแนน
                </span>
              </div>
              <Meter value={percent(course.lessons_completed, course.lessons_total)} label={`ความคืบหน้า ${course.title}`} />
              <span className="small muted">
                แบบฝึกหัดผ่านแล้ว {course.exercises_passed}/{course.exercises_total} ข้อ
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel" aria-label="บทเรียนล่าสุด">
        <h2>บทเรียนล่าสุด</h2>
        {data.recent_lessons.length === 0 ? (
          <p className="muted small">
            ยังไม่มีประวัติการเรียน <Link href="/lessons">เริ่มจากหน้าบทเรียน</Link>
          </p>
        ) : (
          <ol className="lesson-list">
            {data.recent_lessons.map((lesson) => (
              <li key={lesson.id}>
                <Link href={`/lessons/${lesson.course_slug}/${lesson.slug}`} className="lesson-row">
                  <span className="lesson-row-main">
                    <strong>{lesson.title}</strong>
                    <span className="small muted">{lesson.course_title}</span>
                  </span>
                  <span className={`status status-${lesson.status}`}>{STATUS_LABEL[lesson.status]}</span>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
