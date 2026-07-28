"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, FileText, Loader2, CheckCircle2 } from "lucide-react";

import { createClient } from "@/utils/supabase/client";

interface CourseListItem {
  id: string;
  name: string;
  question_count: number;
  selected: boolean;
}

async function fetchCourses(
  supabase: ReturnType<typeof createClient>,
  router: ReturnType<typeof useRouter>
): Promise<CourseListItem[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    router.push("/auth/login");
    throw new Error("No session");
  }

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/courses`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (!res.ok) throw new Error("Failed to load courses.");

  const json = await res.json();
  return Array.isArray(json?.courses) ? json.courses : [];
}

export default function CoursesPage() {
  const supabase = createClient();
  const router = useRouter();

  const {
    data: courses = [],
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: ["courses"],
    queryFn: () => fetchCourses(supabase, router),
  });

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 pb-16 pt-8">
      <h1 className="text-2xl font-bold text-slate-900">Courses</h1>
      <p className="mt-1 text-sm text-slate-500">
        All courses in your department. Tap one to browse its past questions.
      </p>

      {error && (
        <p className="mt-4 text-sm text-red-500">
          {error instanceof Error ? error.message : "Something went wrong."}
        </p>
      )}

      {!error && courses.length === 0 ? (
        <div className="mt-10 flex flex-col items-center gap-2 text-center">
          <BookOpen size={32} className="text-slate-300" />
          <p className="text-sm text-slate-500">
            No courses found for your department yet.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {courses.map((course) => (
            <Link
              key={course.id}
              href={`/dashboard/courses/${course.id}`}
              className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-lg transition hover:shadow-xl"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                  <BookOpen size={18} className="text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-slate-900">{course.name}</p>
                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <FileText size={12} />
                    {course.question_count} past question
                    {course.question_count !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {course.selected && (
                <CheckCircle2 size={18} className="text-blue-600" />
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
