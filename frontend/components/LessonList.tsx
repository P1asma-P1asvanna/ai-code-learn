"use client";

import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { fetchCourseProgress, type CourseDetail, type CourseProgressData } from "@/lib/learn";

const STATUS_LABEL = {
  not_started: "ยังไม่เริ่ม",
  in_progress: "กำลังเรียน",
  completed: "เรียนจบแล้ว",
} as const;

export default function LessonList({ course }: { course: CourseDetail }) {
  const { data: session, status: sessionStatus } = useSession();
  const token = session?.accessToken;
  const [progress, setProgress] = useState<CourseProgressData | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    fetchCourseProgress(token, course.slug)
      .then((data) => {
        if (!cancelled) setProgress(data);
      })
      .catch(() => {
        // โหลดความคืบหน้าไม่ได้ก็แค่ไม่แสดงเครื่องหมาย รายการบทเรียนยังใช้ได้ตามปกติ
      });
    return () => {
      cancelled = true;
    };
  }, [token, course.slug]);

  const byLesson = new Map((progress?.lessons ?? []).map((item) => [item.lesson_id, item]));
  const completedCount = (progress?.lessons ?? []).filter((item) => item.status === "completed").length;
  const totalScore = (progress?.lessons ?? []).reduce((sum, item) => sum + item.score, 0);

  return (
    <>
      {progress ? (
        <p className="small">
          เรียนจบแล้ว {completedCount}/{course.lessons.length} บท · คะแนนรวม {totalScore}
        </p>
      ) : sessionStatus !== "loading" && !token ? (
        <p className="notice small">
          <button className="link" onClick={() => void signIn("github")}>
            เข้าสู่ระบบด้วย GitHub
          </button>{" "}
          เพื่อเก็บความคืบหน้าและคะแนน (อ่านบทเรียนได้โดยไม่ต้องล็อกอิน)
        </p>
      ) : null}

      <ol className="lesson-list">
        {course.lessons.map((lesson, index) => {
          const item = byLesson.get(lesson.id);
          const status = item?.status ?? "not_started";
          return (
            <li key={lesson.id}>
              <Link href={`/lessons/${course.slug}/${lesson.slug}`} className="lesson-row">
                <span className={`lesson-num${status === "completed" ? " done" : ""}`} aria-hidden>
                  {status === "completed" ? "✓" : index + 1}
                </span>
                <span className="lesson-row-main">
                  <strong>{lesson.title}</strong>
                  <span className="small muted">
                    {lesson.estimated_minutes} นาที
                    {lesson.exercise_count > 0 ? ` · แบบฝึกหัด ${lesson.exercise_count} ข้อ` : ""}
                    {item && item.exercises_total > 0
                      ? ` · ผ่านแล้ว ${item.exercises_passed}/${item.exercises_total}`
                      : ""}
                  </span>
                </span>
                {progress ? <span className={`status status-${status}`}>{STATUS_LABEL[status]}</span> : null}
              </Link>
            </li>
          );
        })}
      </ol>
    </>
  );
}
