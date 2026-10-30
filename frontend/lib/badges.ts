import type { DashboardData } from "@/lib/learn";

export type Badge = {
  id: string;
  icon: string;
  title: string;
  hint: string;
  earned: boolean;
};

/** ป้ายความสำเร็จ คำนวณจากข้อมูล Dashboard ล้วน ๆ (ไม่ต้องเก็บเพิ่มในฐานข้อมูล) */
export function computeBadges(data: DashboardData): Badge[] {
  const courseDone = data.courses.some((c) => c.lessons_total > 0 && c.lessons_completed === c.lessons_total);
  const allDone = data.lessons_total > 0 && data.lessons_completed === data.lessons_total;
  const allExercises = data.exercises_total > 0 && data.exercises_passed === data.exercises_total;

  return [
    { id: "first-lesson", icon: "🌱", title: "ก้าวแรก", hint: "เรียนจบ 1 บท", earned: data.lessons_completed >= 1 },
    { id: "five-lessons", icon: "📚", title: "นักอ่านตัวยง", hint: "เรียนจบ 5 บท", earned: data.lessons_completed >= 5 },
    { id: "ten-exercises", icon: "🧩", title: "นักแก้โจทย์", hint: "ผ่านแบบฝึกหัด 10 ข้อ", earned: data.exercises_passed >= 10 },
    { id: "score-100", icon: "⭐", title: "100 คะแนน", hint: "สะสมคะแนนรวมถึง 100", earned: data.total_score >= 100 },
    { id: "course-done", icon: "🎓", title: "จบคอร์ส", hint: "เรียนจบทุกบทในคอร์สใดคอร์สหนึ่ง", earned: courseDone },
    { id: "all-exercises", icon: "🏆", title: "ผ่านครบทุกข้อ", hint: "ผ่านแบบฝึกหัดทุกข้อ", earned: allExercises },
    { id: "all-done", icon: "🚀", title: "จบครบทุกคอร์ส", hint: "เรียนจบทุกบทของทุกคอร์ส", earned: allDone },
  ];
}
