"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  FileText,
  Loader2,
  CheckCircle2,
  Lock,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CourseListItem {
  id: string;
  name: string;
  question_count: number;
  selected: boolean;
}

interface LockedCourseItem {
  id: string;
  name: string;
  locked: true;
  question_count: null;
  selected: boolean;
}

interface CoursesResponse {
  courses: CourseListItem[];
  locked_courses: LockedCourseItem[];
  department_id: string | null;
  is_paid: boolean;
  plan: string;
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchCourses(
  supabase: ReturnType<typeof createClient>,
  router: ReturnType<typeof useRouter>
): Promise<CoursesResponse> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { router.push("/auth/login"); throw new Error("No session"); }

  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/courses`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!res.ok) throw new Error("Failed to load courses.");
  return res.json();
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Shimmer({ className }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-md bg-white/[0.05] ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="min-h-screen px-6 pb-16 pt-8" style={{ background: "var(--sp-bg)" }}>
      <style>{`@keyframes shimmer { to { transform: translateX(250%); } }`}</style>
      <div className="mx-auto max-w-5xl">
        <Shimmer className="h-7 w-32 mb-2" />
        <Shimmer className="h-4 w-64 mb-8" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-2xl border p-4"
              style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-card)" }}
            >
              <Shimmer className="h-10 w-10 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Shimmer className="h-4 w-3/4" />
                <Shimmer className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CoursesPage() {
  const supabase = createClient();
  const router = useRouter();

  const { data, isLoading: loading, error } = useQuery({
    queryKey: ["courses"],
    queryFn: () => fetchCourses(supabase, router),
  });

  if (loading) return <PageSkeleton />;

  const courses = data?.courses ?? [];
  const lockedCourses = data?.locked_courses ?? [];
  const isPaid = data?.is_paid ?? true; // default true to avoid flashing lock on paid users

  return (
    <div
      className="min-h-screen px-6 pb-16 pt-8 transition-colors"
      style={{ background: "var(--sp-bg)" }}
    >
      <style>{`@keyframes shimmer { to { transform: translateX(250%); } }`}</style>
      <div className="mx-auto max-w-5xl">

        {/* Header */}
        <h1 className="text-2xl font-bold" style={{ color: "var(--sp-text)" }}>
          My Courses
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--sp-text-3)" }}>
          All courses in your department. Tap one to browse its past questions.
        </p>

        {/* Free tier banner */}
        {!isPaid && lockedCourses.length > 0 && (
          <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.06] px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-indigo-300">
                  {lockedCourses.length} course{lockedCourses.length !== 1 ? "s" : ""} locked
                </p>
                <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>
                  You're on the free plan — upgrade to unlock all courses
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/subscribe"
              className="shrink-0 flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition-colors"
            >
              Upgrade
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}

        {error && (
          <p className="mt-4 text-sm text-red-400">
            {error instanceof Error ? error.message : "Something went wrong."}
          </p>
        )}

        {/* Empty state */}
        {!error && courses.length === 0 && lockedCourses.length === 0 && (
          <div className="mt-10 flex flex-col items-center gap-2 text-center">
            <BookOpen size={32} style={{ color: "var(--sp-text-3)" }} />
            <p className="text-sm" style={{ color: "var(--sp-text-3)" }}>
              No courses found for your department yet.
            </p>
          </div>
        )}

        {/* Unlocked courses */}
        {courses.length > 0 && (
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {courses.map((course) => (
              <Link
                key={course.id}
                href={`/dashboard/courses/${course.id}`}
                className="flex items-center justify-between rounded-2xl border p-4 transition-all hover:border-indigo-500/30"
                style={{
                  background: "var(--sp-bg-card)",
                  borderColor: "var(--sp-border)",
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
                    <BookOpen size={18} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="font-medium" style={{ color: "var(--sp-text)" }}>
                      {course.name}
                    </p>
                    <p
                      className="flex items-center gap-1 text-xs"
                      style={{ color: "var(--sp-text-3)" }}
                    >
                      <FileText size={12} />
                      {course.question_count} past question
                      {course.question_count !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                {course.selected && (
                  <CheckCircle2 size={18} className="text-blue-400 shrink-0" />
                )}
              </Link>
            ))}
          </div>
        )}

        {/* Locked courses */}
        {!isPaid && lockedCourses.length > 0 && (
          <div className="mt-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--sp-text-3)" }}>
              Locked courses
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {lockedCourses.map((course) => (
                <div
                  key={course.id}
                  className="relative flex items-center justify-between rounded-2xl border p-4 overflow-hidden"
                  style={{
                    background: "var(--sp-bg-card)",
                    borderColor: "var(--sp-border)",
                  }}
                >
                  {/* Blur overlay */}
                  <div className="absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[2px] bg-black/30 rounded-2xl">
                    <Link
                      href="/dashboard/subscribe"
                      className="flex items-center gap-1.5 rounded-xl bg-indigo-600/90 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 transition-colors"
                    >
                      <Lock size={11} />
                      Unlock
                    </Link>
                  </div>

                  {/* Card content underneath (blurred) */}
                  <div className="flex items-center gap-3 select-none">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.04]">
                      <BookOpen size={18} className="text-slate-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-600">{course.name}</p>
                      <p className="text-xs text-slate-700">Past questions</p>
                    </div>
                  </div>
                  <Lock size={16} className="text-slate-700 shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bottom upgrade CTA for free users */}
        {!isPaid && (
          <div className="mt-8 rounded-2xl border border-dashed border-indigo-500/20 bg-indigo-500/[0.04] p-6 text-center">
            <div className="flex justify-center mb-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15">
                <Sparkles className="h-4 w-4 text-indigo-400" />
              </div>
            </div>
            <p className="font-semibold text-sm" style={{ color: "var(--sp-text)" }}>
              Unlock all courses with SparkL Premium
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--sp-text-3)" }}>
              Get unlimited access to all past questions, practice mode, and more
            </p>
            <Link
              href="/dashboard/subscribe"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              View plans
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}