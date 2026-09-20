"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search, BookOpen, Upload, FileText, GraduationCap,
  ChevronRight, ArrowRight, Clock, Plus, Flame,
  Zap, Trophy, Target, TrendingUp, Star, Users,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import Image from "next/image";
import { PaymentGatewayWidget } from "@/components/PaymentGatewayWidget";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Course { id: string; name: string; code?: string; }
interface Profile {
  full_name: string | null;
  phone: string | null;
  institution: { name: string } | null;
  department: { name: string } | null;
  level: { name: string } | null;
  study_mode: { name: string } | null;
  courses?: Course[];
  streak?: number;
  xp?: number;
}
interface RecentQuestion {
  id: string; title: string; year: number | null;
  created_at: string; course: { name: string } | null;
  views?: number;
}
interface DashboardData {
  profile: Profile;
  recent_questions: RecentQuestion[];
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

// ── Count-up hook ─────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) return;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(ease * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return value;
}

// ── Shimmer skeleton ──────────────────────────────────────────────────────────

function Shimmer({ className }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-[var(--sp-bg-muted)] ${className}`}>
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="min-h-screen px-4 py-5 lg:px-8 lg:py-8" style={{ background: "var(--sp-bg)" }}>
      <style>{`@keyframes shimmer{to{transform:translateX(300%)}}`}</style>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shimmer className="h-8 w-8 rounded-xl" />
            <Shimmer className="h-5 w-24" />
          </div>
          <Shimmer className="h-9 w-56 rounded-xl" />
        </div>
        <div className="rounded-2xl border p-6 space-y-3" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
          <Shimmer className="h-4 w-32" />
          <Shimmer className="h-8 w-48" />
          <Shimmer className="h-3 w-64" />
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Shimmer key={i} className="h-24 rounded-2xl" />)}
        </div>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Shimmer className="h-4 w-24" />
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => <Shimmer key={i} className="h-28 rounded-2xl" />)}
            </div>
          </div>
          <div className="space-y-3">
            <Shimmer className="h-48 rounded-2xl" />
            <Shimmer className="h-20 rounded-2xl" />
            <Shimmer className="h-20 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, accentBg, accentBorder,
}: {
  icon: React.ReactNode; label: string; value: number;
  accentBg: string; accentBorder: string;
}) {
  const count = useCountUp(value);
  return (
    <div
      className="relative overflow-hidden rounded-2xl border p-4 transition-colors"
      style={{ background: accentBg, borderColor: accentBorder }}
    >
      <div className="mb-3">{icon}</div>
      <p className="text-2xl font-black tabular-nums" style={{ color: "var(--sp-text)" }}>{count}</p>
      <p className="mt-0.5 text-[11px] font-medium" style={{ color: "var(--sp-text-3)" }}>{label}</p>
    </div>
  );
}

// ── Streak ring ───────────────────────────────────────────────────────────────

function StreakRing({ streak = 0 }: { streak: number }) {
  const max = 7;
  const pct = Math.min(streak / max, 1);
  const r = 28;
  const circ = 2 * Math.PI * r;
  const dash = pct * circ;
  return (
    <div className="flex flex-col items-center justify-center gap-1">
      <div className="relative flex items-center justify-center">
        <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
          <circle cx="36" cy="36" r={r} fill="none" stroke="rgba(99,102,241,0.12)" strokeWidth="5" />
          <circle
            cx="36" cy="36" r={r} fill="none"
            stroke={streak >= 7 ? "#F59E0B" : "#6366F1"}
            strokeWidth="5"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.8s cubic-bezier(0.34,1.56,0.64,1)" }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <Flame className={`h-4 w-4 ${streak >= 7 ? "text-amber-400" : "text-indigo-400"}`} />
          <span className="text-sm font-black" style={{ color: "var(--sp-text)" }}>{streak}</span>
        </div>
      </div>
      <p className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>
        {streak === 1 ? "1 day streak" : `${streak} day streak`}
      </p>
    </div>
  );
}

// ── XP bar ────────────────────────────────────────────────────────────────────

function XPBar({ xp = 0 }: { xp: number }) {
  const level = Math.floor(xp / 100) + 1;
  const progress = xp % 100;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3 w-3 text-indigo-400" />
          <span className="text-[11px] font-bold" style={{ color: "var(--sp-text)" }}>Level {level}</span>
        </div>
        <span className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>{xp} XP · {100 - progress} to next</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--sp-border)" }}>
        <div className="h-full rounded-full bg-indigo-500 transition-all duration-1000" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

// ── Course colors (theme-aware) ───────────────────────────────────────────────

const COURSE_COLORS = [
  { bg: "indigo",  tailwind: "text-indigo-400",  dot: "bg-indigo-400"  },
  { bg: "teal",    tailwind: "text-teal-400",    dot: "bg-teal-400"    },
  { bg: "violet",  tailwind: "text-violet-400",  dot: "bg-violet-400"  },
  { bg: "sky",     tailwind: "text-sky-400",     dot: "bg-sky-400"     },
  { bg: "rose",    tailwind: "text-rose-400",    dot: "bg-rose-400"    },
  { bg: "amber",   tailwind: "text-amber-400",   dot: "bg-amber-400"   },
];

const COLOR_BG: Record<string, { card: string; border: string; hoverBorder: string }> = {
  indigo: { card: "rgba(99,102,241,0.08)",  border: "rgba(99,102,241,0.14)",  hoverBorder: "rgba(99,102,241,0.28)"  },
  teal:   { card: "rgba(20,184,166,0.08)",  border: "rgba(20,184,166,0.14)",  hoverBorder: "rgba(20,184,166,0.28)"  },
  violet: { card: "rgba(139,92,246,0.08)",  border: "rgba(139,92,246,0.14)",  hoverBorder: "rgba(139,92,246,0.28)"  },
  sky:    { card: "rgba(14,165,233,0.08)",  border: "rgba(14,165,233,0.14)",  hoverBorder: "rgba(14,165,233,0.28)"  },
  rose:   { card: "rgba(244,63,94,0.08)",   border: "rgba(244,63,94,0.14)",   hoverBorder: "rgba(244,63,94,0.28)"   },
  amber:  { card: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.14)",  hoverBorder: "rgba(245,158,11,0.28)"  },
};

// ── Course card ───────────────────────────────────────────────────────────────

function CourseCard({ course, index }: { course: Course; index: number }) {
  const c = COURSE_COLORS[index % COURSE_COLORS.length];
  const bg = COLOR_BG[c.bg];
  const initials = course.name.split(" ").map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
  return (
    <Link
      href={`/dashboard/courses/${course.id}`}
      className={`group relative flex flex-col rounded-2xl border p-4 transition-all duration-200`}
      style={{ background: bg.card, borderColor: bg.border }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = bg.hoverBorder)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = bg.border)}
    >
      <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl text-xs font-black ${c.tailwind}`}
        style={{ background: "var(--sp-bg-muted)" }}>
        {initials}
      </div>
      <p className={`flex-1 text-xs font-semibold leading-snug transition-colors ${c.tailwind}`}
        style={{ opacity: 0.85 }}>
        {course.name}
      </p>
      {course.code && <p className={`mt-1 text-[10px] font-mono font-bold ${c.tailwind} opacity-60`}>{course.code}</p>}
      <div className={`mt-3 flex items-center gap-1 text-[10px] font-medium ${c.tailwind} opacity-0 group-hover:opacity-100 transition-opacity`}>
        Open <ChevronRight className="h-2.5 w-2.5" />
      </div>
    </Link>
  );
}

// ── Today's focus ─────────────────────────────────────────────────────────────

function TodayFocus({ courses }: { courses: Course[] }) {
  const spotlight = courses[Math.floor(Math.random() * courses.length)];
  if (!spotlight) return null;
  return (
    <Link
      href={`/dashboard/courses/${spotlight.id}`}
      className="group flex items-center gap-3 rounded-2xl border p-4 transition-all"
      style={{
        background: "rgba(99,102,241,0.06)",
        borderColor: "rgba(99,102,241,0.18)",
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(99,102,241,0.32)")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(99,102,241,0.18)")}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-300">
        <Target className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold text-indigo-400/70 uppercase tracking-widest">Today's focus</p>
        <p className="truncate text-xs font-bold" style={{ color: "var(--sp-text)" }}>{spotlight.name}</p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    </Link>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ icon, title, body, cta }: {
  icon: React.ReactNode; title: string; body: string;
  cta: { href: string; label: string; icon?: React.ReactNode };
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed px-6 py-12 text-center"
      style={{ borderColor: "var(--sp-border)" }}>
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400">{icon}</div>
      <p className="text-xs font-bold" style={{ color: "var(--sp-text-2)" }}>{title}</p>
      <p className="mt-1.5 max-w-[200px] text-[11px] leading-relaxed" style={{ color: "var(--sp-text-3)" }}>{body}</p>
      <Link href={cta.href}
        className="mt-5 flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-[11px] font-bold text-white hover:bg-indigo-500 transition-colors">
        {cta.icon}{cta.label}
      </Link>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardHomePage() {
  const supabase = createClient();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => fetchDashboardSummary(supabase, router),
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setQuery("");
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const courses = data?.profile.courses ?? [];
  const recentQuestions = data?.recent_questions ?? [];
  const stats = data?.stats ?? { questions_in_courses: 0, my_uploads: 0, total_views: 0 };

  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    return courses.filter(c => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 6);
  }, [query, courses]);

  if (isLoading) return <Skeleton />;

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center"
        style={{ background: "var(--sp-bg)" }}>
        <div className="h-14 w-14 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
          <Flame className="h-6 w-6 text-red-400" />
        </div>
        <p className="text-sm font-semibold" style={{ color: "var(--sp-text-2)" }}>
          {error instanceof Error ? error.message : "Couldn't load your dashboard."}
        </p>
        <button onClick={() => window.location.reload()}
          className="rounded-xl border px-5 py-2.5 text-xs font-bold transition"
          style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-2)" }}>
          Try again
        </button>
      </div>
    );
  }

  const firstName = (data.profile.full_name ?? "there").split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 5 ? "Up late," : hour < 12 ? "Good morning," : hour < 17 ? "Good afternoon," : "Good evening,";
  const streak = data.profile.streak ?? 0;
  const xp = data.profile.xp ?? 0;

  return (
    <div className="min-h-screen transition-colors duration-300" style={{ background: "var(--sp-bg)" }}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        .fade-up { animation: fadeUp 0.4s ease both; }
        .fade-up-1 { animation-delay: 0.05s }
        .fade-up-2 { animation-delay: 0.1s }
        .fade-up-3 { animation-delay: 0.15s }
        .fade-up-4 { animation-delay: 0.2s }
        .fade-up-5 { animation-delay: 0.25s }
      `}</style>

      {/* ── Topbar ── */}
      <header className="sticky top-0 z-30 border-b backdrop-blur-md transition-colors"
        style={{ background: "var(--sp-header-bg)", borderColor: "var(--sp-border)" }}>
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 lg:px-8">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <Image src="/images/logo.jpg" alt="SparkL" width={28} height={28} className="rounded-lg object-cover" />
            <span className="text-sm font-black tracking-tight" style={{ color: "var(--sp-text)" }}>SparkL</span>
          </Link>

          {/* Search */}
          <div className="relative w-56 lg:w-72" ref={searchRef}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" style={{ color: "var(--sp-text-3)" }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your courses…"
              className="w-full rounded-xl border py-2 pl-9 pr-3 text-xs outline-none transition focus:border-indigo-500/50"
              style={{
                background: "var(--sp-input-bg)",
                borderColor: "var(--sp-border)",
                color: "var(--sp-text)",
              }}
            />
            {query.trim() && (
              <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border shadow-2xl"
                style={{ background: "var(--sp-search-popup)", borderColor: "var(--sp-border)" }}>
                {searchResults.length === 0 ? (
                  <p className="px-4 py-3.5 text-xs" style={{ color: "var(--sp-text-3)" }}>No match for &ldquo;{query}&rdquo;</p>
                ) : (
                  searchResults.map((c, i) => {
                    const col = COURSE_COLORS[i % COURSE_COLORS.length];
                    return (
                      <Link key={c.id} href={`/dashboard/courses/${c.id}`}
                        className="flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-indigo-500/5"
                        onClick={() => setQuery("")}>
                        <div className={`h-1.5 w-1.5 rounded-full ${col.dot}`} />
                        <span className="text-xs font-medium" style={{ color: "var(--sp-text-2)" }}>{c.name}</span>
                      </Link>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Avatar */}
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-[11px] font-black text-indigo-400">
            {firstName.slice(0, 2).toUpperCase()}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">

        {/* ── Hero greeting ── */}
        <div className="fade-up mb-6 rounded-2xl border p-6 transition-colors"
          style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium" style={{ color: "var(--sp-text-3)" }}>{greeting}</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight" style={{ color: "var(--sp-text)" }}>{firstName} 👋</h1>
              {data.profile.department?.name && (
                <p className="mt-1.5 text-xs" style={{ color: "var(--sp-text-3)" }}>
                  {data.profile.department.name}
                  {data.profile.institution?.name ? ` · ${data.profile.institution.name}` : ""}
                  {data.profile.level?.name ? ` · ${data.profile.level.name}` : ""}
                </p>
              )}
            </div>
            <div className="flex items-center gap-5">
              <StreakRing streak={streak} />
              <div className="hidden sm:block h-10 w-px" style={{ background: "var(--sp-border)" }} />
              <div className="hidden sm:block w-44">
                <XPBar xp={xp} />
              </div>
            </div>
          </div>
          <div className="mt-4 sm:hidden">
            <XPBar xp={xp} />
          </div>
        </div>

        {/* ── Stats ── */}
        <div className="fade-up fade-up-1 mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard icon={<BookOpen className="h-4 w-4 text-indigo-400" />} label="My courses"
            value={courses.length} accentBg="rgba(99,102,241,0.07)" accentBorder="rgba(99,102,241,0.14)" />
          <StatCard icon={<FileText className="h-4 w-4 text-violet-400" />} label="Past questions"
            value={stats.questions_in_courses} accentBg="rgba(139,92,246,0.07)" accentBorder="rgba(139,92,246,0.14)" />
          <StatCard icon={<TrendingUp className="h-4 w-4 text-teal-400" />} label="My uploads"
            value={stats.my_uploads} accentBg="rgba(20,184,166,0.07)" accentBorder="rgba(20,184,166,0.14)" />
          <StatCard icon={<Users className="h-4 w-4 text-sky-400" />} label="Total views"
            value={stats.total_views ?? 0} accentBg="rgba(14,165,233,0.07)" accentBorder="rgba(14,165,233,0.14)" />
        </div>

        {/* ── Body ── */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

          {/* Left */}
          <div className="space-y-6 lg:col-span-2">
            {courses.length > 0 && (
              <div className="fade-up fade-up-2"><TodayFocus courses={courses} /></div>
            )}

            <section className="fade-up fade-up-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold" style={{ color: "var(--sp-text)" }}>Your courses</h2>
                <Link href="/onboarding" className="flex items-center gap-0.5 text-[11px] font-medium text-indigo-400/60 hover:text-indigo-400 transition-colors">
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
                    className="flex flex-col items-center justify-center gap-1.5 rounded-2xl border border-dashed p-4 transition-all hover:border-indigo-500/25"
                    style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}>
                    <Plus className="h-4 w-4" />
                    <span className="text-[10px] font-semibold">Add course</span>
                  </Link>
                </div>
              )}
            </section>

            <section className="fade-up fade-up-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold" style={{ color: "var(--sp-text)" }}>Recent uploads</h2>
                {recentQuestions.length > 0 && (
                  <Link href="/dashboard/courses" className="flex items-center gap-0.5 text-[11px] font-medium text-indigo-400/60 hover:text-indigo-400 transition-colors">
                    See all <ChevronRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
              {recentQuestions.length === 0 ? (
                <EmptyState icon={<FileText className="h-5 w-5" />} title="Nothing here yet"
                  body={`Be the first to share a past question for ${data.profile.department?.name ?? "your department"}.`}
                  cta={{ href: "/dashboard/upload", label: "Upload now", icon: <Upload className="h-3 w-3" /> }} />
              ) : (
                <div className="overflow-hidden rounded-2xl border transition-colors"
                  style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
                  {recentQuestions.map((q, i) => (
                    <Link key={q.id} href={`/questions/${q.id}`}
                      className={`group flex items-center gap-3 px-4 py-3.5 transition hover:bg-indigo-500/[0.04] ${i > 0 ? "border-t" : ""}`}
                      style={i > 0 ? { borderColor: "var(--sp-border)" } : {}}>
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 group-hover:bg-violet-500/15 transition-colors">
                        <FileText className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold" style={{ color: "var(--sp-text-2)" }}>{q.title}</p>
                        <p className="truncate text-[10px] mt-0.5" style={{ color: "var(--sp-text-3)" }}>
                          {q.course?.name ?? "—"}{q.year ? ` · ${q.year}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <div className="flex items-center gap-1 text-[10px]" style={{ color: "var(--sp-text-3)" }}>
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(q.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                        </div>
                        {q.views != null && (
                          <span className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>{q.views} views</span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right sidebar */}
          <div className="fade-up fade-up-5 space-y-4">

            {/* Upload CTA */}
            <Link href="/dashboard/upload"
              className="group flex items-center gap-3 rounded-2xl border p-4 transition-all"
              style={{ background: "rgba(99,102,241,0.08)", borderColor: "rgba(99,102,241,0.20)" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(99,102,241,0.38)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(99,102,241,0.20)")}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-white group-hover:bg-indigo-400 transition-colors">
                <Upload className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold" style={{ color: "var(--sp-text)" }}>Upload past question</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--sp-text-3)" }}>Earn XP · Help your department</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>

            {/* 💳 Payment gateway placeholder */}
            <PaymentGatewayWidget />

            {/* Leaderboard teaser */}
            <div className="rounded-2xl border p-4 transition-colors"
              style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="h-3.5 w-3.5 text-amber-400" />
                  <h3 className="text-xs font-bold" style={{ color: "var(--sp-text)" }}>Department board</h3>
                </div>
                <Link href="/dashboard/leaderboard" className="text-[10px] text-indigo-400/60 hover:text-indigo-400 transition-colors">
                  Full board →
                </Link>
              </div>
              <div className="space-y-2.5">
                <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 border border-indigo-500/15 bg-indigo-500/10">
                  <span className="text-[11px] font-black w-4" style={{ color: "var(--sp-text-3)" }}>—</span>
                  <div className="flex h-6 w-6 items-center justify-center rounded-lg text-[9px] font-black"
                    style={{ background: "var(--sp-bg-muted)", color: "var(--sp-text-3)" }}>
                    {firstName.slice(0, 2).toUpperCase()}
                  </div>
                  <span className="flex-1 text-xs font-semibold" style={{ color: "var(--sp-text-2)" }}>You</span>
                  <div className="flex items-center gap-1">
                    <Star className="h-2.5 w-2.5 text-amber-400" />
                    <span className="text-[10px] font-bold" style={{ color: "var(--sp-text-3)" }}>{stats.my_uploads}</span>
                  </div>
                </div>
                <p className="px-1 text-[10px]" style={{ color: "var(--sp-text-3)" }}>Upload more questions to climb the board.</p>
              </div>
            </div>

            {/* Browse courses */}
            <Link href="/dashboard/courses"
              className="group flex items-center gap-3 rounded-2xl border p-4 transition-all"
              style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--sp-border-hover)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--sp-border)")}>
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all"
                style={{ background: "var(--sp-bg-muted)", color: "var(--sp-text-3)" }}>
                <BookOpen className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold" style={{ color: "var(--sp-text-2)" }}>Browse all courses</p>
                <p className="text-[10px] mt-0.5" style={{ color: "var(--sp-text-3)" }}>Explore past questions</p>
              </div>
              <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-colors text-indigo-400/30 group-hover:text-indigo-400" />
            </Link>

            {/* First upload nudge */}
            {stats.my_uploads === 0 && (
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Flame className="h-3.5 w-3.5 text-amber-400" />
                  <p className="text-xs font-bold text-amber-400">Start your streak</p>
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: "var(--sp-text-3)" }}>
                  Your first upload earns 50 XP and starts your contribution streak.
                </p>
                <Link href="/dashboard/upload" className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 transition-colors">
                  Upload now <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}

            {/* Profile summary */}
            <div className="rounded-2xl border p-4 transition-colors"
              style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
              <div className="mb-3 flex items-center gap-2">
                <GraduationCap className="h-3.5 w-3.5 text-indigo-400" />
                <h3 className="text-xs font-bold" style={{ color: "var(--sp-text)" }}>Your profile</h3>
              </div>
              <div className="space-y-2">
                {[
                  data.profile.institution?.name,
                  data.profile.department?.name,
                  data.profile.level?.name,
                ].filter(Boolean).map((val) => (
                  <p key={val} className="truncate text-[11px]" style={{ color: "var(--sp-text-3)" }}>{val}</p>
                ))}
              </div>
              <Link href="/dashboard/profile"
                className="mt-3.5 flex items-center justify-center gap-1 rounded-xl border py-2 text-[11px] font-semibold transition-all hover:border-indigo-500/30 hover:text-indigo-400"
                style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}>
                Edit profile <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}