"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  CheckSquare,
  Square,
  BookOpen,
  ArrowRight,
  GraduationCap,
  Loader2,
  FileText,
  Clock,
  MessageSquare,
} from "lucide-react";

// TODO: replace with a real check — e.g. does course_selection have
// any rows for this student_id? Swap this boolean for that query result.
const HAS_SELECTED_COURSES = true;

const CURRENT_STUDENT = {
  department: "Computer Science",
  level: "ND1",
};

const AVAILABLE_COURSES = [
  { id: "c1", course_code: "CSC201", course_title: "Data Structures" },
  { id: "c2", course_code: "CSC205", course_title: "Computer Architecture" },
  { id: "c3", course_code: "CSC211", course_title: "Discrete Mathematics" },
  { id: "c4", course_code: "CSC221", course_title: "Object Oriented Programming" },
  { id: "c5", course_code: "GNS201", course_title: "Use of English II" },
  { id: "c6", course_code: "CSC231", course_title: "Systems Analysis and Design" },
];

// TODO: replace with the student's actual selected courses + counts
const MY_COURSES = [
  { id: "c1", course_code: "CSC201", course_title: "Data Structures", question_count: 14 },
  { id: "c2", course_code: "CSC205", course_title: "Computer Architecture", question_count: 8 },
  { id: "c3", course_code: "CSC211", course_title: "Discrete Mathematics", question_count: 21 },
  { id: "c4", course_code: "CSC221", course_title: "Object Oriented Programming", question_count: 6 },
  { id: "c5", course_code: "GNS201", course_title: "Use of English II", question_count: 3 },
];

// TODO: replace with an activity feed scoped to the student's course_ids
// (new uploads, new verified solutions, etc.)
const RECENT_ACTIVITY = [
  { id: "a1", course_code: "CSC201", type: "upload", text: "New 2023/2024 past question added", time: "2h ago" },
  { id: "a2", course_code: "CSC211", type: "solution", text: "Solution posted for 2022/2023 paper", time: "5h ago" },
  { id: "a3", course_code: "GNS201", type: "upload", text: "New 2021/2022 past question added", time: "1d ago" },
  { id: "a4", course_code: "CSC201", type: "solution", text: "Solution verified for 2022/2023 paper", time: "2d ago" },
];

const MIN_COURSES = 1;

export default function CoursesPage() {
  return HAS_SELECTED_COURSES ? <MyCoursesView /> : <CourseSelectionView />;
}

// ============================================================
// View 1: My Courses (after onboarding is complete)
// ============================================================
function MyCoursesView() {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center gap-2">
          <Image
            src="/images/logo.jpg"
            alt="SparkL"
            width={44}
            height={44}
            priority
            className="object-contain"
          />
        </div>

        <h1 className="text-2xl font-bold text-slate-900">My courses</h1>
        <p className="mt-1 text-sm text-slate-500">
          {CURRENT_STUDENT.department} · {CURRENT_STUDENT.level} · {MY_COURSES.length} courses this semester
        </p>

        {/* Course grid */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MY_COURSES.map((course) => (
            <Link
              key={course.id}
              href={`/dashboard/courses/${course.id}`}
              className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition-all hover:border-blue-200 hover:shadow-md"
            >
              <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                <BookOpen className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-slate-800">
                {course.course_code}
              </p>
              <p className="mt-0.5 truncate text-xs text-slate-500">
                {course.course_title}
              </p>
              <div className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-600">
                <FileText className="h-3.5 w-3.5" />
                {course.question_count} past questions
              </div>
            </Link>
          ))}
        </div>

        {/* Activity feed */}
        <div className="mt-8">
          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Latest activity in your courses
          </h2>
          <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
            <div className="divide-y divide-slate-100">
              {RECENT_ACTIVITY.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      item.type === "upload"
                        ? "bg-blue-100 text-blue-600"
                        : "bg-green-100 text-green-600"
                    }`}
                  >
                    {item.type === "upload" ? (
                      <FileText className="h-4 w-4" />
                    ) : (
                      <MessageSquare className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold">{item.course_code}</span>{" "}
                      — {item.text}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 text-xs text-slate-400">
                    <Clock className="h-3 w-3" />
                    {item.time}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// View 2: Onboarding selection (one-time, before first selection)
// ============================================================
function CourseSelectionView() {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const canContinue = selected.size >= MIN_COURSES;

  const toggleCourse = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedList = useMemo(
    () => AVAILABLE_COURSES.filter((c) => selected.has(c.id)),
    [selected]
  );

  const handleContinue = async () => {
    if (!canContinue) return;
    setSubmitting(true);
    setError("");

    try {
      // TODO: POST to /api/course-selection with Array.from(selected)
      await new Promise((res) => setTimeout(res, 1200));
      router.push("/dashboard");
    } catch {
      setError("Something went wrong saving your courses. Try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6">
          <Image
            src="/images/logo.jpg"
            alt="SparkL"
            width={50}
            height={50}
            priority
            className="mb-3 object-contain"
          />

          <div className="mb-4 flex items-center gap-2">
            <div className="h-1.5 flex-1 rounded-full bg-blue-600" />
            <div className="h-1.5 flex-1 rounded-full bg-blue-600" />
            <span className="ml-2 shrink-0 text-xs font-medium text-slate-400">
              Step 2 of 2
            </span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            Select your courses
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Pick every course you're offering this semester in{" "}
            <span className="font-medium text-slate-700">
              {CURRENT_STUDENT.department}
            </span>{" "}
            ({CURRENT_STUDENT.level}). This is a one-time setup.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <span className="text-xs font-medium text-slate-500">
              {AVAILABLE_COURSES.length} courses available
            </span>
            <span className="text-xs font-medium text-blue-600">
              {selected.size} selected
            </span>
          </div>

          <div className="divide-y divide-slate-100">
            {AVAILABLE_COURSES.map((course) => {
              const isChecked = selected.has(course.id);
              return (
                <button
                  key={course.id}
                  type="button"
                  onClick={() => toggleCourse(course.id)}
                  className={`flex w-full items-center gap-3 px-5 py-4 text-left transition-colors ${
                    isChecked ? "bg-blue-50" : "hover:bg-slate-50"
                  }`}
                >
                  {isChecked ? (
                    <CheckSquare className="h-5 w-5 shrink-0 text-blue-600" />
                  ) : (
                    <Square className="h-5 w-5 shrink-0 text-slate-300" />
                  )}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800">
                      {course.course_code}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {course.course_title}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {selectedList.length > 0 && (
          <p className="mt-3 text-xs text-slate-400">
            You're registering for: {selectedList.map((c) => c.course_code).join(", ")}
          </p>
        )}

        <button
          type="button"
          disabled={!canContinue || submitting}
          onClick={handleContinue}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving your courses...
            </>
          ) : (
            <>
              Continue to dashboard
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>

        {!canContinue && (
          <p className="mt-2 text-center text-xs text-slate-400">
            Select at least {MIN_COURSES} course to continue
          </p>
        )}
      </div>
    </div>
  );
}