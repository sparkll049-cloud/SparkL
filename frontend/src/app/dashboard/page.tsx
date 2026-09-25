"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search, BookOpen, Upload, FileText, GraduationCap,
  ChevronRight, ArrowRight, Clock, Plus, Flame,
  Users, TrendingUp, AlertCircle, Crown, Sparkles,
  Target, Trophy, Zap, Star,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import Image from "next/image";

interface Course { id: string; name: string; code?: string; }
interface Profile {
  full_name: string | null; phone: string | null;
  institution: { name: string } | null; department: { name: string } | null;
  level: { name: string } | null; study_mode: { name: string } | null;
  courses?: Course[]; streak?: number; xp?: number;
}
interface RecentQuestion {
  id: string; title: string; year: number | null;
  created_at: string; course: { name: string } | null; views?: number;
}
interface DashboardData {
  profile: Profile; recent_questions: RecentQuestion[];
  stats: { questions_in_courses: number; my_uploads: number; total_views?: number };
}

async function fetchDashboardSummary(
  supabase: ReturnType<typeof createClient>,
  router: ReturnType<typeof useRouter>
): Promise<DashboardData> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { router.push("/auth/login"); throw new Error("No session"); }
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/dashboard/summary`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!res.ok) throw new Error("Failed to load dashboard.");
  return res.json();
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Bone({ className }: { className?: string }) {
  return <div className={`sp-bone animate-pulse ${className}`} />;
}

function Skeleton() {
  return (
    <div className="min-h-screen px-4 py-6 lg:px-8 lg:py-8" style={{ background: "var(--sp-bg)" }}>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <Bone className="h-6 w-32" /> <Bone className="h-9 w-52 rounded-xl" />
        </div>
        <Bone className="h-32 rounded-2xl" />
        <div className="grid grid-cols-3 gap-3">
          {[...Array(3)].map((_, i) => <Bone key={i} className="h-16 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-3">
            <Bone className="h-4 w-20" />
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {[...Array(5)].map((_, i) => <Bone key={i} className="h-28 rounded-2xl" />)}
            </div>
          </div>
          <div className="space-y-3">
            <Bone className="h-36 rounded-2xl" /> <Bone className="h-24 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Course accent palette (uses CSS vars so both themes work) ─────────────────

const ACCENTS = [
  { text: "text-indigo-500", bgVar: "var(--sp-course-indigo-bg)", bdrVar: "var(--sp-course-indigo-bdr)" },
  { text: "text-teal-500",   bgVar: "var(--sp-course-teal-bg)",   bdrVar: "var(--sp-course-teal-bdr)"   },
  { text: "text-violet-500", bgVar: "var(--sp-course-violet-bg)", bdrVar: "var(--sp-course-violet-bdr)" },
  { text: "text-sky-500",    bgVar: "var(--sp-course-sky-bg)",    bdrVar: "var(--sp-course-sky-bdr)"    },
  { text: "text-rose-500",   bgVar: "var(--sp-course-rose-bg)",   bdrVar: "var(--sp-course-rose-bdr)"   },
  { text: "text-amber-500",  bgVar: "var(--sp-course-amber-bg)",  bdrVar: "var(--sp-course-amber-bdr)"  },
];

// ── Count-up ──────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      setValue(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return value;
}

// ── Course card ───────────────────────────────────────────────────────────────

function CourseCard({ course, index }: { course: Course; index: number }) {
  const a = ACCENTS[index % ACCENTS.length];
  const initials = course.name.split(" ").map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  return (
    <Link
      href={`/dashboard/courses/${course.id}`}
      className={`group flex flex-col rounded-2xl border p-4 transition-all duration-150 hover:scale-[1.02] hover:shadow-md`}
      style={{ background: a.bgVar, borderColor: a.bdrVar }}
    >
      <span className={`mb-3 text-lg font-black leading-none ${a.text}`}>{initials}</span>
      <p className={`flex-1 text-xs font-semibold leading-snug ${a.text}`}>{course.name}</p>
      {course.code && (
        <p className={`mt-1.5 font-mono text-[10px] font-bold ${a.text} opacity-60`}>{course.code}</p>
      )}
      <div className={`mt-3 flex items-center gap-1 text-[10px] font-semibold ${a.text} opacity-0 group-hover:opacity-80 transition-opacity`}>
        Open <ChevronRight className="h-2.5 w-2.5" />
      </div>
    </Link>
  );
}

// ── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  const count = useCountUp(value);
  return (
    <div className="flex items-center gap-3 rounded-2xl border px-4 py-3.5"
      style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-card)" }}>
      <div className="shrink-0">{icon}</div>
      <div>
        <p className="text-lg font-black tabular-nums leading-none" style={{ color: "var(--sp-text)" }}>{count}</p>
        <p className="mt-0.5 text-[10px] font-medium" style={{ color: "var(--sp-text-3)" }}>{label}</p>
      </div>
    </div>
  );
}

// ── Streak ring ───────────────────────────────────────────────────────────────

function StreakRing({ streak = 0 }: { streak: number }) {
  const r = 22; const circ = 2 * Math.PI * r;
  const dash = Math.min(streak / 7, 1) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative flex items-center justify-center">
        <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
          <circle cx="28" cy="28" r={r} fill="none" stroke="var(--sp-ring-track)" strokeWidth="4" />
          <circle cx="28" cy="28" r={r} fill="none"
            stroke={streak >= 7 ? "#F59E0B" : "#6366F1"} strokeWidth="4"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            style={{ transition: "stroke-dasharray 1s cubic-bezier(0.34,1.56,0.64,1)" }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <Flame className={`h-3 w-3 ${streak >= 7 ? "text-amber-500" : "text-indigo-500"}`} />
          <span className="text-xs font-black" style={{ color: "var(--sp-text)" }}>{streak}</span>
        </div>
      </div>
      <p className="text-[9px] font-medium" style={{ color: "var(--sp-text-3)" }}>
        {streak === 1 ? "1 day" : `${streak} days`}
      </p>
    </div>
  );
}

// ── XP bar ────────────────────────────────────────────────────────────────────

function XPBar({ xp = 0 }: { xp: number }) {
  const level = Math.floor(xp / 100) + 1;
  const progress = xp % 100;
  return (
    <div className="flex-1 space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <Zap className="h-3 w-3 text-indigo-500" />
          <span className="text-[11px] font-bold" style={{ color: "var(--sp-text)" }}>Level {level}</span>
        </div>
        <span className="text-[9px]" style={{ color: "var(--sp-text-3)" }}>{xp} XP</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--sp-border)" }}>
        <div className="h-full rounded-full bg-indigo-500 transition-all duration-1000" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-[9px]" style={{ color: "var(--sp-text-3)" }}>{100 - progress} XP to next level</p>
    </div>
  );
}

// ── Today's focus ─────────────────────────────────────────────────────────────

function TodayFocus({ courses }: { courses: Course[] }) {
  const [idx] = useState(() => Math.floor(Math.random() * courses.length));
  const spotlight = courses[idx];
  if (!spotlight) return null;
  return (
    <Link href={`/dashboard/courses/${spotlight.id}`}
      className="group flex items-center gap-3 rounded-2xl border p-4 transition-all"
      style={{ borderColor: "var(--sp-course-indigo-bdr)", background: "var(--sp-course-indigo-bg)" }}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-500">
        <Target className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 opacity-70">Today's focus</p>
        <p className="truncate text-xs font-bold" style={{ color: "var(--sp-text)" }}>{spotlight.name}</p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

// ── Upgrade banner ────────────────────────────────────────────────────────────

function UpgradeBanner() {
  return (
    <div className="relative overflow-hidden rounded-2xl border p-4"
      style={{ background: "var(--sp-course-indigo-bg)", borderColor: "var(--sp-course-indigo-bdr)" }}
    >
      <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-indigo-400/20 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-4 -left-4 h-16 w-16 rounded-full bg-violet-400/20 blur-2xl" />
      <div className="relative">
        <div className="mb-2.5 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/20">
            <Crown className="h-3.5 w-3.5 text-indigo-500" />
          </div>
          <p className="text-xs font-black text-indigo-500">Upgrade to Pro</p>
        </div>
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--sp-text-2)" }}>
          Unlock unlimited past questions, AI explanations, practice mode, and priority uploads.
        </p>
        <div className="mt-3 space-y-1.5">
          {[
            { icon: <Sparkles className="h-3 w-3" />, text: "AI-powered answer explanations" },
            { icon: <Trophy className="h-3 w-3" />,   text: "Full practice mode — unlimited" },
            { icon: <Star className="h-3 w-3" />,     text: "Download any past question" },
          ].map((f) => (
            <div key={f.text} className="flex items-center gap-2">
              <span className="text-indigo-500">{f.icon}</span>
              <span className="text-[10px] font-medium" style={{ color: "var(--sp-text-2)" }}>{f.text}</span>
            </div>
          ))}
        </div>
        <Link href="/dashboard/subscribe"
          className="mt-4 flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 py-2.5 text-[11px] font-black text-white transition hover:bg-indigo-500"
        >
          <Crown className="h-3 w-3" /> Unlock Pro
        </Link>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ icon, title, body, cta }: {
  icon: React.ReactNode; title: string; body: string; cta: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-10 text-center"
      style={{ borderColor: "var(--sp-border)" }}>
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-500">{icon}</div>
      <p className="text-xs font-bold" style={{ color: "var(--sp-text-2)" }}>{title}</p>
      <p className="mt-1.5 max-w-[200px] text-[11px] leading-relaxed" style={{ color: "var(--sp-text-3)" }}>{body}</p>
      <Link href={cta.href}
        className="mt-5 rounded-xl bg-indigo-600 px-4 py-2 text-[11px] font-bold text-white hover:bg-indigo-500 transition-colors">
        {cta.label}
      </Link>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardHomePage() {
  const supabase = createClient();
  const router = useRouter();
  const [query, setQuery]         = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isPro, setIsPro]         = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => fetchDashboardSummary(supabase, router),
  });

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/avatar/me`,
          { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (res.ok) { const j = await res.json(); if (j.avatar_url) setAvatarUrl(j.avatar_url); }
      } catch { /* silent */ }
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/payments/subscription/status`,
          { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (res.ok) { const j = await res.json(); setIsPro(j.is_paid === true); }
      } catch { /* silent */ }
    }
    load();
  }, [supabase]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setQuery("");
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const courses         = data?.profile.courses ?? [];
  const recentQuestions = data?.recent_questions ?? [];
  const stats           = data?.stats ?? { questions_in_courses: 0, my_uploads: 0 };
  const streak          = data?.profile.streak ?? 0;
  const xp              = data?.profile.xp ?? 0;

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    return courses.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6);
  }, [query, courses]);

  if (isLoading) return <Skeleton />;

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center" style={{ background: "var(--sp-bg)" }}>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
          <AlertCircle className="h-5 w-5 text-red-500" />
        </div>
        <p className="text-sm font-semibold" style={{ color: "var(--sp-text-2)" }}>
          {error instanceof Error ? error.message : "Couldn't load your dashboard."}
        </p>
        <button onClick={() => window.location.reload()}
          className="rounded-xl border px-5 py-2.5 text-xs font-bold transition hover:border-indigo-500/40"
          style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}>
          Try again
        </button>
      </div>
    );
  }

  const firstName = (data.profile.full_name ?? "there").split(" ")[0];
  const hour      = new Date().getHours();
  const greeting  = hour < 5 ? "Up late" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="min-h-screen transition-colors duration-300" style={{ background: "var(--sp-bg)" }}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .fu  { animation:fadeUp 0.35s ease both }
        .fu1 { animation-delay:.05s } .fu2 { animation-delay:.10s }
        .fu3 { animation-delay:.15s } .fu4 { animation-delay:.20s }
        .fu5 { animation-delay:.25s }
      `}</style>

      {/* ── Topbar ── */}
      <header className="sticky top-0 z-30 border-b backdrop-blur-md transition-colors"
        style={{ background: "var(--sp-header-bg)", borderColor: "var(--sp-border)" }}>
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 lg:px-8">

          <Link href="/dashboard" className="flex items-center gap-2">
            <Image src="/images/logo.jpg" alt="SparkL" width={28} height={28} className="rounded-lg object-cover" />
            <span className="text-sm font-black tracking-tight" style={{ color: "var(--sp-text)" }}>SparkL</span>
          </Link>

          {/* Search */}
          <div className="relative w-48 lg:w-64" ref={searchRef}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "var(--sp-text-3)" }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search courses…"
              className="w-full rounded-xl border py-2 pl-9 pr-3 text-xs outline-none transition focus:border-indigo-500/60"
              style={{ background: "var(--sp-input-bg)", borderColor: "var(--sp-border)", color: "var(--sp-text)" }}
            />
            {query.trim() && (
              <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border shadow-xl"
                style={{ background: "var(--sp-search-popup)", borderColor: "var(--sp-border)" }}>
                {searchResults.length === 0
                  ? <p className="px-4 py-3 text-xs" style={{ color: "var(--sp-text-3)" }}>No match for &ldquo;{query}&rdquo;</p>
                  : searchResults.map((c, i) => {
                    const a = ACCENTS[i % ACCENTS.length];
                    return (
                      <Link key={c.id} href={`/dashboard/courses/${c.id}`}
                        className="flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-indigo-500/5"
                        onClick={() => setQuery("")}>
                        <div className={`h-1.5 w-1.5 rounded-full ${a.text} bg-current`} />
                        <span className="text-xs font-medium" style={{ color: "var(--sp-text-2)" }}>{c.name}</span>
                      </Link>
                    );
                  })
                }
              </div>
            )}
          </div>

          {/* Avatar */}
          <Link href="/dashboard/profile">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile"
                className="h-8 w-8 rounded-full object-cover ring-2 ring-indigo-500/40 transition hover:ring-indigo-500/70" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-black text-white ring-2 ring-indigo-500/30 transition hover:ring-indigo-500/60">
                {firstName.slice(0, 2).toUpperCase()}
              </div>
            )}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 lg:px-8 lg:py-8">

        {/* ── Greeting ── */}
        <div className="fu mb-5 rounded-2xl border p-5 sm:p-6"
          style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium" style={{ color: "var(--sp-text-3)" }}>{greeting},</p>
              <h1 className="mt-0.5 text-2xl font-black tracking-tight sm:text-3xl" style={{ color: "var(--sp-text)" }}>
                {firstName} 👋
              </h1>
              {(data.profile.department?.name || data.profile.institution?.name) && (
                <p className="mt-1.5 text-xs" style={{ color: "var(--sp-text-3)" }}>
                  {[data.profile.department?.name, data.profile.institution?.name, data.profile.level?.name].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>
            <div className="flex items-center gap-4">
              <StreakRing streak={streak} />
              <div className="h-8 w-px" style={{ background: "var(--sp-border)" }} />
              <XPBar xp={xp} />
            </div>
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="fu fu1 mb-5 grid grid-cols-3 gap-2.5">
          <StatPill icon={<BookOpen className="h-4 w-4 text-indigo-500" />}  label="Courses"        value={courses.length} />
          <StatPill icon={<FileText className="h-4 w-4 text-violet-500" />}  label="Past questions" value={stats.questions_in_courses} />
          <StatPill icon={<TrendingUp className="h-4 w-4 text-teal-500" />}  label="My uploads"     value={stats.my_uploads} />
        </div>

        {/* ── Body grid ── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

          {/* Left */}
          <div className="space-y-5 lg:col-span-2">

            {courses.length > 0 && <div className="fu fu2"><TodayFocus courses={courses} /></div>}

            {/* Courses */}
            <section className="fu fu3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold" style={{ color: "var(--sp-text)" }}>Your courses</h2>
                <Link href="/onboarding"
                  className="flex items-center gap-0.5 text-[11px] font-medium text-indigo-500 opacity-60 hover:opacity-100 transition-opacity">
                  Manage <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              {courses.length === 0 ? (
                <EmptyState icon={<BookOpen className="h-5 w-5" />} title="No courses yet"
                  body="Choose your courses to unlock past questions for your semester."
                  cta={{ href: "/onboarding", label: "Choose courses" }} />
              ) : (
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  {courses.map((course, i) => <CourseCard key={course.id} course={course} index={i} />)}
                  <Link href="/onboarding"
                    className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed p-4 transition-colors"
                    style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}>
                    <Plus className="h-4 w-4" />
                    <span className="text-[10px] font-semibold">Add course</span>
                  </Link>
                </div>
              )}
            </section>

            {/* Recent uploads */}
            <section className="fu fu4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold" style={{ color: "var(--sp-text)" }}>Recent uploads</h2>
                {recentQuestions.length > 0 && (
                  <Link href="/dashboard/courses"
                    className="flex items-center gap-0.5 text-[11px] font-medium text-indigo-500 opacity-60 hover:opacity-100 transition-opacity">
                    See all <ChevronRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
              {recentQuestions.length === 0 ? (
                <EmptyState icon={<FileText className="h-5 w-5" />} title="Nothing here yet"
                  body={`Be the first to share a past question for ${data.profile.department?.name ?? "your department"}.`}
                  cta={{ href: "/dashboard/upload", label: "Upload now" }} />
              ) : (
                <div className="overflow-hidden rounded-2xl border"
                  style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
                  {recentQuestions.map((q, i) => (
                    <Link key={q.id} href={`/questions/${q.id}`}
                      className={`group flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-indigo-500/[0.04] ${i > 0 ? "border-t" : ""}`}
                      style={i > 0 ? { borderColor: "var(--sp-border)" } : {}}>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-500 group-hover:bg-violet-500/15 transition-colors">
                        <FileText className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold" style={{ color: "var(--sp-text-2)" }}>{q.title}</p>
                        <p className="truncate text-[10px] mt-0.5" style={{ color: "var(--sp-text-3)" }}>
                          {q.course?.name ?? "—"}{q.year ? ` · ${q.year}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--sp-text-3)" }}>
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(q.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                        </span>
                        {q.views != null && (
                          <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--sp-text-3)" }}>
                            <Users className="h-2.5 w-2.5" />{q.views}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right sidebar */}
          <div className="fu fu5 space-y-4">

            {/* Upload CTA */}
            <Link href="/dashboard/upload"
              className="group flex items-center gap-3 rounded-2xl border p-4 transition-all hover:scale-[1.01]"
              style={{ background: "var(--sp-course-indigo-bg)", borderColor: "var(--sp-course-indigo-bdr)" }}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white group-hover:bg-indigo-500 transition-colors">
                <Upload className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold" style={{ color: "var(--sp-text)" }}>Upload a past question</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--sp-text-3)" }}>Help your department · earn XP</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>

            {!isPro && <UpgradeBanner />}

            {stats.my_uploads === 0 && (
              <div className="rounded-2xl border p-4"
                style={{ background: "var(--sp-course-amber-bg)", borderColor: "var(--sp-course-amber-bdr)" }}>
                <div className="mb-2 flex items-center gap-2">
                  <Flame className="h-3.5 w-3.5 text-amber-500" />
                  <p className="text-xs font-bold text-amber-600 dark:text-amber-400">Start your streak</p>
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: "var(--sp-text-2)" }}>
                  Your first upload earns 50 XP and kicks off your contribution streak.
                </p>
                <Link href="/dashboard/upload"
                  className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:opacity-80 transition-opacity">
                  Upload now <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}

            {/* Profile summary */}
            <div className="rounded-2xl border p-4"
              style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
              <div className="mb-3 flex items-center gap-2">
                <GraduationCap className="h-3.5 w-3.5 text-indigo-500" />
                <h3 className="text-xs font-bold" style={{ color: "var(--sp-text)" }}>Your profile</h3>
              </div>
              <div className="space-y-1.5">
                {[data.profile.institution?.name, data.profile.department?.name, data.profile.level?.name]
                  .filter(Boolean).map((val) => (
                  <p key={val} className="truncate text-[11px]" style={{ color: "var(--sp-text-3)" }}>{val}</p>
                ))}
              </div>
              <Link href="/dashboard/profile"
                className="mt-4 flex items-center justify-center gap-1 rounded-xl border py-2 text-[11px] font-semibold transition-colors hover:border-indigo-500/40 hover:text-indigo-500"
                style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}>
                Edit profile <ChevronRight className="h-3 w-3" />
              </Link>
            </div>

            {/* Quick links */}
            <div className="overflow-hidden rounded-2xl border"
              style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
              {[
                { href: "/dashboard/courses", icon: <BookOpen className="h-3.5 w-3.5" />, label: "Browse all courses" },
                { href: "/dashboard/upload",  icon: <Zap className="h-3.5 w-3.5" />,      label: "My uploads" },
              ].map((item, i) => (
                <Link key={item.href} href={item.href}
                  className={`group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-indigo-500/[0.05] ${i > 0 ? "border-t" : ""}`}
                  style={i > 0 ? { borderColor: "var(--sp-border)" } : {}}>
                  <span style={{ color: "var(--sp-text-3)" }}>{item.icon}</span>
                  <span className="flex-1 text-xs font-medium" style={{ color: "var(--sp-text-2)" }}>{item.label}</span>
                  <ChevronRight className="h-3 w-3 text-indigo-500 opacity-20 group-hover:opacity-70 transition-opacity" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}