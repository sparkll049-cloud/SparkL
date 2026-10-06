
"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  BookOpen, FileText, Lock, Sparkles, ArrowRight,
  Clock, Plus, Search, Crown, X,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CourseListItem {
  id: string; name: string; code?: string | null;
  question_count: number; selected: boolean;
}
interface LockedCourseItem {
  id: string; name: string; code?: string | null;
  locked: true; question_count: null; selected: boolean;
}
interface CoursesResponse {
  courses: CourseListItem[];
  locked_courses: LockedCourseItem[];
  department_id: string | null;
  is_paid: boolean;
  plan: string;
}
interface SubscriptionStatus {
  is_paid: boolean; is_trial: boolean; trial_days_left?: number; plan: string;
}
// Shape returned by /api/courses/search
interface ApiCourse {
  id: string; name: string; department?: string; institution?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const COURSE_PALETTE = [
  "#6366F1", "#0EA5E9", "#8B5CF6", "#10B981", "#F59E0B", "#EF4444",
];

function courseInitials(name: string): string {
  const letters = name.split(" ").filter(w => /^[a-zA-Z]/.test(w))
    .map(w => w[0].toUpperCase()).slice(0, 2).join("");
  return letters || name.slice(0, 2).toUpperCase();
}

function splitCourseName(name: string, code?: string | null): { code: string | null; title: string } {
  const m = name.match(/^\s*([A-Za-z]{2,5})\s?-?\s?(\d{2,4}[A-Za-z]?)\s*[-:–—]?\s*(.*)$/);
  if (!m) return { code: code ?? null, title: name };
  return { code: code ?? `${m[1].toUpperCase()} ${m[2]}`, title: m[3].trim() || name };
}

const clamp2: React.CSSProperties = {
  display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
};

async function fetchCourses(
  supabase: ReturnType<typeof createClient>,
  router: ReturnType<typeof useRouter>,
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

function PageSkeleton() {
  return (
    <div className="min-h-screen px-4 pb-16 pt-8" style={{ background: "var(--sp-bg)" }}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="space-y-2">
          <div className="sp-bone h-7 w-36 rounded-xl" />
          <div className="sp-bone h-4 w-64 rounded-xl" />
        </div>
        <div className="sp-bone h-11 w-full rounded-full" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <div key={i} className="sp-bone h-44 rounded-2xl" />)}
        </div>
      </div>
    </div>
  );
}

// ── Course thumbnail ──────────────────────────────────────────────────────────

function Thumb({ accent, label, dim }: { accent: string; label: string; dim?: boolean }) {
  return (
    <div
      className="relative h-24 overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${accent}26, ${accent}0D)`, opacity: dim ? 0.5 : 1 }}
    >
      <div
        className="absolute left-1/2 top-4 h-[84px] w-16 -translate-x-1/2 rounded-md bg-white transition-transform duration-200 group-hover:-translate-y-1"
        style={{ boxShadow: `0 6px 16px ${accent}35` }}
      >
        <div className="mx-2 mt-2 h-1.5 rounded-full" style={{ background: accent }} />
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className="mx-2 mt-1.5 h-[3px] rounded-full bg-slate-200"
            style={{ width: `${62 + ((i * 17) % 32)}%` }} />
        ))}
      </div>
      <span className="absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[9px] font-black text-white shadow"
        style={{ background: accent }}>
        {label}
      </span>
    </div>
  );
}

function CourseCard({ course, index }: { course: CourseListItem | ApiCourse; index: number }) {
  const accent = COURSE_PALETTE[index % COURSE_PALETTE.length];
  const name = course.name;
  const code = "code" in course ? course.code : undefined;
  const question_count = "question_count" in course ? course.question_count : null;
  const { code: displayCode, title } = splitCourseName(name, code);
  const empty = question_count === 0;
  return (
    <Link
      href={`/dashboard/courses/${course.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
      style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
    >
      <Thumb accent={accent} label={displayCode ?? courseInitials(name)} />
      <div className="flex flex-1 flex-col p-3">
        <p className="min-h-[2rem] text-xs font-bold leading-snug" style={{ ...clamp2, color: "var(--sp-text)" }}>
          {title}
        </p>
        <div className="mt-2.5 flex items-center justify-between">
          <span className="flex items-center gap-1 text-[10px] font-medium" style={{ color: "var(--sp-text-3)" }}>
            <FileText className="h-2.5 w-2.5" />
            {question_count === null
              ? "View course"
              : empty
                ? "No papers yet"
                : `${question_count} paper${question_count !== 1 ? "s" : ""}`}
          </span>
          <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: accent }}>
            Open <ArrowRight className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function LockedCourseCard({ course, index }: { course: LockedCourseItem; index: number }) {
  const accent = COURSE_PALETTE[index % COURSE_PALETTE.length];
  const { code, title } = splitCourseName(course.name, course.code);
  return (
    <Link
      href="/dashboard/subscribe"
      className="group flex flex-col overflow-hidden rounded-2xl border transition-all hover:-translate-y-0.5 hover:shadow-lg"
      style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
    >
      <Thumb accent={accent} label={code ?? courseInitials(course.name)} dim />
      <div className="flex flex-1 flex-col p-3">
        <p className="min-h-[2rem] text-xs font-bold leading-snug opacity-60" style={{ ...clamp2, color: "var(--sp-text)" }}>
          {title}
        </p>
        <span className="mt-2.5 flex items-center gap-1 text-[10px] font-bold text-indigo-500">
          <Lock className="h-2.5 w-2.5" /> Unlock with a plan
        </span>
      </div>
    </Link>
  );
}

function Banner({ tone, icon, title, sub, href, cta }: {
  tone: "emerald" | "indigo"; icon: React.ReactNode; title: string; sub: string; href: string; cta: string;
}) {
  const c = tone === "emerald" ? "#10B981" : "#6366F1";
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5"
      style={{ borderColor: `${c}33`, background: `${c}0F` }}>
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl" style={{ background: `${c}26`, color: c }}>
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold" style={{ color: c }}>{title}</p>
          <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>{sub}</p>
        </div>
      </div>
      <Link href={href}
        className="flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold text-white transition hover:opacity-90"
        style={{ background: c }}>
        {cta} <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CoursesPage() {
  const supabase     = createClient();
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [subStatus, setSubStatus]       = useState<SubscriptionStatus | null>(null);
  // Pre-fill search from ?q= URL param (this is what "See all results" sets)
  const [search, setSearch]             = useState(() => searchParams.get("q") ?? "");
  const [focused, setFocused]           = useState(false);
  const [globalResults, setGlobalResults] = useState<ApiCourse[] | null>(null);
  const [globalLoading, setGlobalLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/payments/subscription/status`,
          { headers: { Authorization: `Bearer ${session.access_token}` } },
        );
        if (res.ok) setSubStatus(await res.json());
      } catch { /* non-critical */ }
    })();
  }, [supabase]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["courses"],
    queryFn: () => fetchCourses(supabase, router),
  });

  // ── Global search via /api/courses/search whenever query is set ────────────
  useEffect(() => {
    const q = search.trim();
    if (!q) { setGlobalResults(null); return; }

    setGlobalLoading(true);
    let cancelled = false;

    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || cancelled) return;
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/courses/search?q=${encodeURIComponent(q)}&limit=30`,
          { headers: { Authorization: `Bearer ${session.access_token}` } },
        );
        if (!res.ok || cancelled) return;
        const json = await res.json();
        if (!cancelled) setGlobalResults(json.courses ?? []);
      } catch {
        if (!cancelled) setGlobalResults([]);
      } finally {
        if (!cancelled) setGlobalLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [search, supabase]);

  if (isLoading) return <PageSkeleton />;

  const allCourses    = data?.courses ?? [];
  const lockedCourses = data?.locked_courses ?? [];
  const isPaid        = data?.is_paid ?? true;
  const isTrial       = subStatus?.is_trial ?? false;
  const trialDays     = subStatus?.trial_days_left ?? 0;
  const showLocked    = !isPaid && !isTrial && lockedCourses.length > 0;

  const q = search.trim().toLowerCase();

  // When a query is active, show global search results (all courses in DB).
  // Fall back to local filter only while global results are still loading.
  const qNoSpace = q.replace(/\s/g, "");
  const localFiltered = q
    ? allCourses.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.code ?? "").toLowerCase().replace(/\s/g, "").includes(qNoSpace) ||
        c.name.toLowerCase().replace(/\s/g, "").includes(qNoSpace))
    : allCourses;

  // What to actually render in the grid
  const isSearching       = q.length > 0;
  const searchResults     = globalResults ?? (globalLoading ? null : localFiltered);
  const showSearchResults = isSearching && searchResults !== null;

  const totalPapers = allCourses.reduce((s, c) => s + c.question_count, 0);

  return (
    <div className="min-h-screen pb-16 pt-8" style={{ background: "var(--sp-bg)" }}>
      <div className="mx-auto max-w-5xl px-4 lg:px-6">

        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: "var(--sp-text)" }}>
              {isSearching ? `Results for "${search}"` : "My courses"}
            </h1>
            <p className="mt-1 text-sm" style={{ color: "var(--sp-text-3)" }}>
              {isSearching
                ? globalLoading
                  ? "Searching all courses…"
                  : `${searchResults?.length ?? 0} course${(searchResults?.length ?? 0) !== 1 ? "s" : ""} found`
                : `${allCourses.length} course${allCourses.length !== 1 ? "s" : ""} · ${totalPapers} past paper${totalPapers !== 1 ? "s" : ""}`}
            </p>
          </div>
          {!isSearching && (
            <Link href="/onboarding"
              className="flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-bold transition-all hover:border-indigo-500/40 hover:text-indigo-500"
              style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}>
              <Plus className="h-3 w-3" /> Manage
            </Link>
          )}
        </div>

        {/* Search bar */}
        <div className="relative mb-5">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2"
            style={{ color: focused ? "#6366F1" : "var(--sp-text-3)" }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Search all courses, e.g. MTH211 or Heat Transfer"
            className="w-full rounded-full border py-3 pl-11 pr-10 text-sm outline-none transition-all"
            style={{
              background: "var(--sp-input-bg)",
              borderColor: focused ? "rgba(99,102,241,0.5)" : "var(--sp-border)",
              color: "var(--sp-text)",
              boxShadow: focused ? "0 0 0 3px rgba(99,102,241,0.10)" : "none",
            }}
          />
          {search && (
            <button onClick={() => setSearch("")} aria-label="Clear search"
              className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: "var(--sp-text-3)" }}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {isTrial && !isSearching && (
          <Banner tone="emerald" icon={<Clock className="h-3.5 w-3.5" />}
            title={`${trialDays} day${trialDays !== 1 ? "s" : ""} left in your free trial`}
            sub="Full access until your trial ends" href="/dashboard/subscribe" cta="View plans" />
        )}
        {showLocked && !isSearching && (
          <Banner tone="indigo" icon={<Crown className="h-3.5 w-3.5" />}
            title={`${lockedCourses.length} course${lockedCourses.length !== 1 ? "s" : ""} locked`}
            sub="Upgrade to unlock every course" href="/dashboard/subscribe" cta="Upgrade" />
        )}

        {error && (
          <p className="mb-4 rounded-xl bg-red-500/10 px-4 py-3 text-sm text-red-500">
            {error instanceof Error ? error.message : "Something went wrong."}
          </p>
        )}

        {/* ── Global search results ── */}
        {showSearchResults && (
          <>
            {globalLoading && (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {[...Array(6)].map((_, i) => <div key={i} className="sp-bone h-44 rounded-2xl" />)}
              </div>
            )}

            {!globalLoading && searchResults!.length === 0 && (
              <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed py-10 text-center"
                style={{ borderColor: "var(--sp-border)" }}>
                <Search className="h-5 w-5 opacity-30" style={{ color: "var(--sp-text-3)" }} />
                <p className="text-sm font-bold" style={{ color: "var(--sp-text-2)" }}>
                  No courses found for &ldquo;{search}&rdquo;
                </p>
                <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>Try a different keyword or course code</p>
                <button onClick={() => setSearch("")} className="mt-1 text-xs font-bold text-indigo-500 hover:underline">
                  Clear search
                </button>
              </div>
            )}

            {!globalLoading && searchResults!.length > 0 && (
              <section>
                <h2 className="mb-3 px-0.5 text-xs font-bold" style={{ color: "var(--sp-text-3)" }}>
                  {searchResults!.length} result{searchResults!.length !== 1 ? "s" : ""} across all courses
                </h2>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  {searchResults!.map((c, i) => (
                    <CourseCard key={c.id} course={c as any} index={i} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* ── Enrolled courses (no search active) ── */}
        {!isSearching && (
          <>
            {!error && allCourses.length === 0 && lockedCourses.length === 0 && (
              <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed py-16 text-center"
                style={{ borderColor: "var(--sp-border)" }}>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
                  <BookOpen className="h-6 w-6" />
                </div>
                <p className="text-sm font-bold" style={{ color: "var(--sp-text-2)" }}>No courses yet</p>
                <p className="max-w-[220px] text-xs" style={{ color: "var(--sp-text-3)" }}>
                  Choose your department courses to see their past questions.
                </p>
                <Link href="/onboarding"
                  className="mt-2 flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-500">
                  Choose courses <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}

            {allCourses.length > 0 && (
              <section>
                <h2 className="mb-3 px-0.5 text-xs font-bold" style={{ color: "var(--sp-text-3)" }}>Enrolled</h2>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  {allCourses.map((c, i) => <CourseCard key={c.id} course={c} index={i} />)}
                  <Link href="/onboarding"
                    className="flex min-h-[170px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-4 transition-all hover:border-indigo-500/40 hover:bg-indigo-500/[0.03]"
                    style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}>
                    <Plus className="h-5 w-5" />
                    <span className="text-[10px] font-bold">Add course</span>
                  </Link>
                </div>
              </section>
            )}

            {showLocked && (
              <section className="mt-8">
                <h2 className="mb-3 px-0.5 text-xs font-bold text-amber-500">Locked</h2>
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                  {lockedCourses.map((c, i) => (
                    <LockedCourseCard key={c.id} course={c} index={allCourses.length + i} />
                  ))}
                </div>
              </section>
            )}

            {!isPaid && !isTrial && (
              <div className="mt-8 rounded-2xl border border-dashed border-indigo-500/25 bg-indigo-500/[0.04] p-6 text-center">
                <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/15">
                  <Sparkles className="h-4 w-4 text-indigo-400" />
                </div>
                <p className="text-sm font-black" style={{ color: "var(--sp-text)" }}>Unlock every course</p>
                <p className="mt-1 text-xs" style={{ color: "var(--sp-text-3)" }}>
                  Unlimited practice, all past questions and AI study tools.
                </p>
                <Link href="/dashboard/subscribe"
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-indigo-500">
                  <Crown className="h-3.5 w-3.5 text-yellow-300" fill="currentColor" />
                  See plans, from ₦2,000/semester
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}