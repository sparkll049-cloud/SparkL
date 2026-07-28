"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  BookOpen,
  FileText,
  Loader2,
  ArrowLeft,
  Plus,
  Check,
} from "lucide-react";

import { createClient } from "@/utils/supabase/client";

interface Question {
  id: string;
  title: string;
  year: string | null;
  created_at: string;
}

interface CourseDetail {
  course: { id: string; name: string; department: { id: string; name: string } | null };
  question_count: number;
  questions: Question[];
  is_selected: boolean;
}

async function fetchCourseDetail(
  courseId: string,
  supabase: ReturnType<typeof createClient>,
  router: ReturnType<typeof useRouter>
): Promise<CourseDetail> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    router.push("/auth/login");
    throw new Error("No session");
  }

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/courses/${courseId}`,
    { headers: { Authorization: `Bearer ${session.access_token}` } }
  );

  if (!res.ok) throw new Error("Failed to load course.");

  return res.json();
}

export default function CourseDetailPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useParams();
  const queryClient = useQueryClient();
  const courseId = params?.id as string;

  const [toggling, setToggling] = useState(false);

  const {
    data,
    isLoading: loading,
    error,
  } = useQuery({
    queryKey: ["course", courseId],
    queryFn: () => fetchCourseDetail(courseId, supabase, router),
    enabled: !!courseId,
  });

  async function toggleSelected() {
    if (!data) return;
    setToggling(true);

    const nextSelected = !data.is_selected;

    // Optimistic update: flip this course's cache entry immediately
    queryClient.setQueryData(["course", courseId], {
      ...data,
      is_selected: nextSelected,
    });

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      if (data.is_selected) {
        await supabase
          .from("user_courses")
          .delete()
          .eq("user_id", user.id)
          .eq("course_id", courseId);
      } else {
        await supabase
          .from("user_courses")
          .insert({ user_id: user.id, course_id: courseId });
      }

      // The courses list page and dashboard both show "selected" state
      // and course counts — invalidate them so they refetch fresh data
      // next time they're visited, instead of showing stale info.
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    } catch (err) {
      // Roll back the optimistic update if the request failed
      queryClient.setQueryData(["course", courseId], data);
    } finally {
      setToggling(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-slate-600">
          {error instanceof Error ? error.message : "Course not found."}
        </p>
        <Link href="/dashboard/courses" className="font-semibold text-blue-600 hover:underline">
          Back to Courses
        </Link>
      </div>
    );
  }

  const { course, question_count, questions, is_selected } = data;

  return (
    <div className="mx-auto max-w-3xl px-6 pb-16 pt-8">
      <Link
        href="/dashboard/courses"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={16} />
        Back to Courses
      </Link>

      <div className="mt-4 rounded-2xl bg-white p-6 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <BookOpen size={22} className="text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{course.name}</h1>
              {course.department && (
                <p className="text-sm text-slate-500">{course.department.name}</p>
              )}
            </div>
          </div>

          <button
            onClick={toggleSelected}
            disabled={toggling}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-60 ${
              is_selected
                ? "bg-blue-50 text-blue-700"
                : "bg-slate-900 text-white hover:opacity-90"
            }`}
          >
            {toggling ? (
              <Loader2 size={14} className="animate-spin" />
            ) : is_selected ? (
              <Check size={14} />
            ) : (
              <Plus size={14} />
            )}
            {is_selected ? "In your courses" : "Add course"}
          </button>
        </div>

        <p className="mt-4 flex items-center gap-1.5 text-sm text-slate-500">
          <FileText size={14} />
          {question_count} approved past question{question_count !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="mt-6 rounded-2xl bg-white p-6 shadow-lg">
        <h2 className="text-lg font-semibold text-slate-900">Past Questions</h2>

        {questions.length === 0 ? (
          <div className="mt-6 flex flex-col items-center gap-2 py-8 text-center">
            <FileText size={28} className="text-slate-300" />
            <p className="text-sm text-slate-500">
              No past questions uploaded for this course yet.
            </p>
            <Link
              href="/dashboard/upload"
              className="mt-1 text-sm font-semibold text-blue-600 hover:underline"
            >
              Upload one
            </Link>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-slate-100">
            {questions.map((q) => (
              <div key={q.id} className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                    <FileText size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">{q.title}</p>
                    {q.year && <p className="text-sm text-slate-500">{q.year}</p>}
                  </div>
                </div>

                <Link
                  href={`/questions/${q.id}`}
                  className="text-sm font-semibold text-blue-600 hover:underline"
                >
                  View
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
        }
