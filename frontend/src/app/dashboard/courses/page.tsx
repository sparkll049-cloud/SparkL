"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen, FileText, Lock, Sparkles, ArrowRight,
  Clock, ChevronRight, Plus, Search, Crown,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CourseListItem {
  id: string;
  name: string;
  code?: string | null;
  question_count: number;
  selected: boolean;
}

interface LockedCourseItem {
  id: string;
  name: string;
  code?: string | null;
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

interface SubscriptionStatus {
  is_paid: boolean;
  is_trial: boolean;
  trial_days_left?: number;
  plan: string;
}

// ── Palette (same as dashboard) ───────────────────────────────────────────────

const COURSE_PALETTE = [
  { accent: "#6366F1", light: "rgba(99,102,241,0.10)",  border: "rgba(99,102,241,0.22)" },
  { accent: "#0EA5E9", light: "rgba(14,165,233,0.10)",  border: "rgba(14,165,233,0.22)" },
  { accent: "#8B5CF6", light: "rgba(139,92,246,0.10)",  border: "rgba(139,92,246,0.22)" },
  { accent: "#10B981", light: "rgba(16,185,129,0.10)",  border: "rgba(16,185,129,0.22)" },
  { accent: "#F59E0B", light: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.22)" },
  { accent: "#EF4444", light: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.22)"  },
];

function courseInitials(name: string): string {
  const letters = name
    .split(" ")
    .filter(w => /^[a-zA-Z]/.test(w))
    .map(w => w[0].toUpperCase())
    .slice(0, 2)
    .join("");
  return letters || name.slice(0, 2).toUpperCase();
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

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

function Bone({ className }: { className?: string }) {
  return <div className={`rounded-xl sp-bone ${className}`} />;
}

function PageSkeleton() {
  return (
    <div className="min-h-screen px-4 pb-16 pt-8" style={{ background: "var(--sp-bg)" }}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-2">
          <Bone className="h-7 w-36" />
          <Bone className="h-4 w-64" />
        </div>
        <Bone className="h-11 w-full rounded-full" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Bone key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Course card ────────────────────────────────────────────────────────────────

function CourseCard({ course, index }: { course: CourseListItem; index: number }) {
  const p        = COURSE_PALETTE[index % COURSE_PALETTE.length];
  const initials = courseInitials(course.name);
  return (
    <Link
      href={`/dashboard/courses/${course.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
      style={{ background: p.light, borderColor: p.border }}
    >
      {/* Top accent bar */}
      <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl" style={{ background: p.accent }} />

      <div className="flex items-start gap-3">
        {/* Initials badge */}
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white shadow-md"
          style={{ background: p.accent, boxShadow: `0 4px 12px ${p.accent}40` }}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          {course.code && (
            <p className="text-[10px] font-black uppercase tracking-wider mb-0.5" style={{ color: p.accent }}>
              {course.code}
            </p>
          )}
          <p className="text-xs font-bold leading-snug" style={{ color: "var(--sp-text)" }}>
            {course.name}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div
          className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ background: `${p.accent}15`, color: p.accent }}
        >
          <FileText className="h-2.5 w-2.5" />
          {course.question_count} paper{course.question_count !== 1 ? "s" : ""}
        </div>
        <div
          className="flex items-center gap-1 text-[10px] font-bold opacity-0 transition-opacity group-hover:opacity-100"
          style={{ color: p.accent }}
        >
          Open <ArrowRight className="h-2.5 w-2.5" />
        </div>
      </div>
    </Link>
  );
}

// ── Locked card ───────────────────────────────────────────────────────────────

function LockedCourseCard({ course, index }: { course: LockedCourseItem; index: number }) {
  const p        = COURSE_PALETTE[index % COURSE_PALETTE.length];
  const initials = courseInitials(course.name);
  return (
    <div className="group relative overflow-hidden rounded-2xl border p-4" style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-card)" }}>
      {/* Blur overlay */}
      <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl backdrop-blur-[3px]"
        style={{ background: "rgba(0,0,0,0.45)" }}>
        <Link
          href="/dashboard/subscribe"
          className="flex items-center gap-1.5 rounded-xl bg-indigo-600/95 px-4 py-2 text-xs font-black text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-500 transition-all hover:-translate-y-0.5"
        >
          <Lock className="h-3 w-3" /> Unlock
        </Link>
      </div>
      {/* Dimmed content underneath */}
      <div className="flex items-start gap-3 select-none opacity-40">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-black text-white"
          style={{ background: p.accent }}>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          {course.code && (
            <p className="text-[10px] font-black uppercase tracking-wider mb-0.5" style={{ color: p.accent }}>
              {course.code}
            </p>
          )}
          <p className="text-xs font-bold leading-snug" style={{ color: "var(--sp-text)" }}>{course.name}</p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between opacity-30 select-none">
        <div className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
          style={{ background: `${p.accent}15`, color: p.accent }}>
          <FileText className="h-2.5 w-2.5" /> Past papers
        </div>
        <Lock className="h-3 w-3" style={{ color: "var(--sp-text-3)" }} />
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CoursesPage() {
  const supabase = createClient();
  const router   = useRouter();

  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null);
  const [search, setSearch]       = useState("");
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    async function loadStatus() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/payments/subscription/status`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        if (res.ok) setSubStatus(await res.json());
      } catch { /* non-critical */ }
    }
    loadStatus();
  }, []);

  const { data, isLoading, error } = useQuery({
    queryKey: ["courses"],
    queryFn: () => fetchCourses(supabase, router),
  });

  if (isLoading) return <PageSkeleton />;

  const allCourses   = data?.courses ?? [];
  const lockedCourses = data?.locked_courses ?? [];
  const isPaid       = data?.is_paid ?? true;
  const isTrial      = subStatus?.is_trial ?? false;
  const trialDaysLeft = subStatus?.trial_days_left ?? 0;

  // Local filter — search across name and code
  const q = search.trim().toLowerCase();
  const filteredCourses = q
    ? allCourses.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.code ?? "").toLowerCase().includes(q) ||
        (c.code ?? "").toLowerCase().replace(/\s/g, "").includes(q.replace(/\s/g, ""))
      )
    : allCourses;

  const totalPapers = allCourses.reduce((s, c) => s + c.question_count, 0);

  return (
    <div className="min-h-screen pb-16 pt-8 transition-colors" style={{ background: "var(--sp-bg)" }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        .au-1 { animation: fadeUp 0.35s ease both; animation-delay: 0.05s }
        .au-2 { animation: fadeUp 0.35s ease both; animation-delay: 0.10s }
        .au-3 { animation: fadeUp 0.35s ease both; animation-delay: 0.15s }
        .au-4 { animation: fadeUp 0.35s ease both; animation-delay: 0.20s }
      `}</style>

      <div className="mx-auto max-w-5xl px-4 lg:px-6">

        {/* ── Header ── */}
        <div className="au-1 mb-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-black tracking-tight" style={{ color: "var(--sp-text)" }}>
                My Courses
              </h1>
              <p className="mt-1 text-sm" style={{ color: "var(--sp-text-3)" }}>
                {allCourses.length} course{allCourses.length !== 1 ? "s" : ""} · {totalPapers} past paper{totalPapers !== 1 ? "s" : ""}
              </p>
            </div>
            <Link
              href="/onboarding"
              className="flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all hover:border-indigo-500/40 hover:text-indigo-500"
              style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}
            >
              <Plus className="h-3 w-3" /> Manage
            </Link>
          </div>
        </div>

        {/* ── Search bar ── */}
        <div className="au-2 relative mb-5">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors"
            style={{ color: searchFocused ? "#6366F1" : "var(--sp-text-3)" }}
          />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Filter by name or code (e.g. MTH211)…"
            className="w-full rounded-full border py-3 pl-11 pr-4 text-sm outline-none transition-all"
            style={{
              background:  "var(--sp-input-bg)",
              borderColor: searchFocused ? "rgba(99,102,241,0.5)" : "var(--sp-border)",
              color:       "var(--sp-text)",
              boxShadow:   searchFocused ? "0 0 0 3px rgba(99,102,241,0.10)" : "none",
            }}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-indigo-500 hover:underline"
            >
              Clear
            </button>
          )}
        </div>

        {/* ── Trial banner ── */}
        {isTrial && (
          <div className="au-2 mb-4 flex items-center justify-between gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
                <Clock className="h-3.5 w-3.5 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-300">
                  {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} left in your free trial
                </p>
                <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>Full access until your trial ends</p>
              </div>
            </div>
            <Link
              href="/dashboard/subscribe"
              className="shrink-0 flex items-center gap-1.5 rounded-xl border border-emerald-500/30 px-3.5 py-2 text-xs font-bold text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            >
              View plans <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}

        {/* ── Free tier banner ── */}
        {!isPaid && !isTrial && lockedCourses.length > 0 && (
          <div className="au-2 mb-4 flex items-center justify-between gap-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.06] px-4 py-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15">
                <Crown className="h-3.5 w-3.5 text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-indigo-300">
                  {lockedCourses.length} course{lockedCourses.length !== 1 ? "s" : ""} locked
                </p>
                <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>
                  Upgrade to unlock all courses
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/subscribe"
              className="shrink-0 flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition-colors"
            >
              Upgrade <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}

        {error && (
          <p className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error instanceof Error ? error.message : "Something went wrong."}
          </p>
        )}

        {/* ── Empty state ── */}
        {!error && allCourses.length === 0 && lockedCourses.length === 0 && (
          <div className="au-3 flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed py-16 text-center"
            style={{ borderColor: "var(--sp-border)" }}>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
              <BookOpen className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold" style={{ color: "var(--sp-text-2)" }}>No courses found</p>
            <p className="max-w-[200px] text-xs" style={{ color: "var(--sp-text-3)" }}>
              Enrol in your department courses to access past questions.
            </p>
            <Link
              href="/onboarding"
              className="mt-2 flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 transition-all hover:-translate-y-0.5"
            >
              Choose courses <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        {/* ── Search no results ── */}
        {q && filteredCourses.length === 0 && allCourses.length > 0 && (
          <div className="au-3 flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed py-10 text-center"
            style={{ borderColor: "var(--sp-border)" }}>
            <Search className="h-5 w-5 opacity-30" style={{ color: "var(--sp-text-3)" }} />
            <p className="text-sm font-bold" style={{ color: "var(--sp-text-2)" }}>No match for "{search}"</p>
            <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>
              Try searching the global course search in the top bar instead
            </p>
            <button onClick={() => setSearch("")}
              className="mt-2 text-xs font-bold text-indigo-500 hover:underline">
              Clear filter
            </button>
          </div>
        )}

        {/* ── Unlocked courses ── */}
        {filteredCourses.length > 0 && (
          <section className="au-3">
            {allCourses.length > 0 && (
              <p className="mb-3 text-[10px] font-bold uppercase tracking-wider px-0.5" style={{ color: "var(--sp-text-3)" }}>
                {q ? `${filteredCourses.length} result${filteredCourses.length !== 1 ? "s" : ""}` : "Enrolled courses"}
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredCourses.map((course, i) => (
                <CourseCard key={course.id} course={course} index={i} />
              ))}
              {/* Add course tile — only when not filtering */}
              {!q && (
                <Link
                  href="/onboarding"
                  className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-4 transition-all hover:border-indigo-500/40 hover:bg-indigo-500/[0.03]"
                  style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)", minHeight: "112px" }}
                >
                  <Plus className="h-5 w-5" />
                  <span className="text-[10px] font-bold">Add course</span>
                </Link>
              )}
            </div>
          </section>
        )}

        {/* ── Locked courses — post-trial ── */}
        {!isPaid && !isTrial && lockedCourses.length > 0 && !q && (
          <section className="au-4 mt-6">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-wider px-0.5 text-amber-500/70">
              Locked — upgrade to access
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lockedCourses.map((course, i) => (
                <LockedCourseCard key={course.id} course={course} index={allCourses.length + i} />
              ))}
            </div>
          </section>
        )}

        {/* ── Bottom upgrade CTA ── */}
        {!isPaid && !isTrial && (
          <div className="au-4 mt-8 rounded-2xl border border-dashed border-indigo-500/20 bg-indigo-500/[0.04] p-6 text-center">
            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15">
              <Sparkles className="h-4 w-4 text-indigo-400" />
            </div>
            <p className="font-black text-sm" style={{ color: "var(--sp-text)" }}>
              Unlock all courses with SparkL Premium
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--sp-text-3)" }}>
              Unlimited past questions, practice mode, AI explanations & more
            </p>
            <Link
              href="/dashboard/subscribe"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 transition-colors hover:-translate-y-0.5 transition-all"
            >
              <Crown className="h-3.5 w-3.5 text-yellow-300" fill="currentColor" />
              View plans — ₦2,500/mo
            </Link>
          </div>
        )}

      </div>
    </div>
  );
}
