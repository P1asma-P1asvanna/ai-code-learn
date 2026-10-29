import { apiFetch } from "@/lib/api";
import type { CaseSpec } from "@/lib/grader";

export type LanguageInfo = { slug: string; name: string; runtime: string | null };

export type CourseSummary = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  level: string;
  language: LanguageInfo;
  lesson_count: number;
};

export type LessonBrief = { slug: string; title: string };

export type CourseDetail = {
  slug: string;
  title: string;
  description: string | null;
  level: string;
  language: LanguageInfo;
  lessons: { id: string; slug: string; title: string; estimated_minutes: number; exercise_count: number }[];
};

export type McqOption = { id: string; text: string };

type ExerciseBase = { id: string; prompt: string; points: number; sort_order: number };
export type McqExercise = ExerciseBase & { kind: "mcq"; options: McqOption[] };
export type CodeExercise = ExerciseBase & { kind: "code"; starter_code: string; cases: CaseSpec[] };
export type Exercise = McqExercise | CodeExercise;

export type LessonPage = {
  course: { slug: string; title: string; language: LanguageInfo };
  lesson: {
    id: string;
    slug: string;
    title: string;
    content_md: string;
    starter_code: string | null;
    estimated_minutes: number;
  };
  exercises: Exercise[];
  prev: LessonBrief | null;
  next: LessonBrief | null;
};

export type LessonStatus = "not_started" | "in_progress" | "completed";

export type ExerciseStat = { attempts: number; passed: boolean; score: number };

export type LessonProgressData = {
  status: LessonStatus;
  exercises: Record<string, ExerciseStat>;
};

export type CourseProgressData = {
  lessons: {
    lesson_id: string;
    slug: string;
    status: LessonStatus;
    exercises_total: number;
    exercises_passed: number;
    score: number;
  }[];
};

export type SubmitResult = {
  passed: boolean;
  points: number;
  awarded: number;
  attempts: number;
  explanation: string | null;
  correct_option_id: string | null;
  cases: boolean[] | null;
  failed_cases: { index: number; expected: string }[] | null;
  lesson_status: LessonStatus;
};

// ---- เนื้อหา (ไม่ต้องล็อกอิน) ----

export const fetchCourses = () => apiFetch<CourseSummary[]>("/content/courses");
export const fetchCourse = (slug: string) => apiFetch<CourseDetail>(`/content/courses/${encodeURIComponent(slug)}`);
export const fetchLessonPage = (course: string, lesson: string) =>
  apiFetch<LessonPage>(`/content/courses/${encodeURIComponent(course)}/lessons/${encodeURIComponent(lesson)}`);

// ---- ความคืบหน้า (ต้องล็อกอิน) ----

export const fetchCourseProgress = (token: string, course: string) =>
  apiFetch<CourseProgressData>(`/progress/courses/${encodeURIComponent(course)}`, { token });

export const fetchLessonProgress = (token: string, lessonId: string) =>
  apiFetch<LessonProgressData>(`/progress/lessons/${encodeURIComponent(lessonId)}`, { token });

export const submitExercise = (
  token: string,
  exerciseId: string,
  body: { answer: string; outputs?: string[] },
) =>
  apiFetch<SubmitResult>(`/progress/exercises/${encodeURIComponent(exerciseId)}/submit`, {
    method: "POST",
    token,
    body: JSON.stringify(body),
  });

export const completeLesson = (token: string, lessonId: string) =>
  apiFetch<{ status: LessonStatus }>(`/progress/lessons/${encodeURIComponent(lessonId)}/complete`, {
    method: "POST",
    token,
  });
