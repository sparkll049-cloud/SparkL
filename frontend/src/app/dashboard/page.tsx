"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search, BookOpen, Upload, FileText, GraduationCap,
  ChevronRight, ArrowRight, Clock, Plus, Flame,
  Users, AlertCircle, Crown, Sparkles,
  Target, Trophy, Zap, Star, Bell, BarChart2,
  CheckCircle2, Calendar, Award, ChevronUp,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import Image from "next/image";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Course { id: string; name: string; }
interface CourseSearchResult {
  id: string; name: string;
  department?: string | null; institution?: string | null;
}
interface Profile {
  full_name: string | null; phone: string | null;
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
  created_at: string; course: { name: string } | null; views?: number;
}
interface DashboardData {
  profile: Profile;
  recent_questions: RecentQuestion[];
  stats: { questions_in_courses: number; my_uploads: number };
}

// ── API helpers ────────────────────────────────────────────────────────────────

async function fetchDashboardSummary(
  supabase: ReturnType<typeof createClient>,
  router: ReturnType<typeof useRouter>,
): Promise<DashboardData> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { router.push("/auth/login"); throw new Error("No session"); }
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_API_URL}/api/dashboard/summary`,
    { headers: { Authorization: `Bearer ${session.access_token}` } },
  );
  if (!res.ok) throw new Error("Failed to load dashboard.");
  return res.json();
}

async function fireStreakUpdate(
  supabase: ReturnType<typeof createClient>,
): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/dashboard/streak/update`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      },
    );
  } catch {
    // fire-and-forget — never block the UI
  }
}

// ── local  course search hook ─────────────────────────────────────────────────
function useLocalCourseSearch(query: string, courses: Course[]) {
  const q = query.trim().toLowerCase();
  if (!q) return { results: [] as Course[], searching: false };
  return {
    results: courses.filter(c => c.name.toLowerCase().includes(q)),
    searching: false,
  };
}
// ── Count-up hook ──────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1200) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    const tick  = (now: number) => {
      const p    = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 4);
      setValue(Math.round(ease * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [target, duration]);
  return value;
}

// ── Course palette ─────────────────────────────────────────────────────────────

const COURSE_PALETTE = [
  { accent: "#6366F1", light: "rgba(99,102,241,0.10)",  border: "rgba(99,102,241,0.20)"  },
  { accent: "#0EA5E9", light: "rgba(14,165,233,0.10)",  border: "rgba(14,165,233,0.20)"  },
  { accent: "#8B5CF6", light: "rgba(139,92,246,0.10)",  border: "rgba(139,92,246,0.20)"  },
  { accent: "#10B981", light: "rgba(16,185,129,0.10)",  border: "rgba(16,185,129,0.20)"  },
  { accent: "#F59E0B", light: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.20)"  },
  { accent: "#EF4444", light: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.20)"   },
];

// ── Initials helper (skips numeric words) ─────────────────────────────────────

function courseInitials(name: string): string {
  const letters = name
    .split(" ")
    .filter(w => /^[a-zA-Z]/.test(w))
    .map(w => w[0].toUpperCase())
    .slice(0, 2)
    .join("");
  return letters || name.slice(0, 2).toUpperCase();
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function Bone({ className = "" }: { className?: string }) {
  return <div className={`sp-bone rounded-xl ${className}`} />;
}

function PageSkeleton() {
  return (
    <div className="min-h-screen" style={{ background: "var(--sp-bg)" }}>
      <div className="h-16 border-b" style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-card)" }}>
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
          <Bone className="h-7 w-24" />
          <Bone className="h-9 w-56 rounded-full" />
          <Bone className="h-9 w-9 rounded-full" />
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="space-y-4">
            <Bone className="h-48 rounded-2xl" />
            <Bone className="h-32 rounded-2xl" />
            <Bone className="h-40 rounded-2xl" />
          </div>
          <div className="space-y-6 lg:col-span-2">
            <div className="grid grid-cols-3 gap-3">
              {[...Array(3)].map((_, i) => <Bone key={i} className="h-24 rounded-2xl" />)}
            </div>
            <Bone className="h-10 rounded-full" />
            <div className="grid grid-cols-2 gap-3">
              {[...Array(6)].map((_, i) => <Bone key={i} className="h-28 rounded-2xl" />)}
            </div>
            <Bone className="h-48 rounded-2xl" />
          </div>
          <div className="space-y-4">
            <Bone className="h-52 rounded-2xl" />
            <Bone className="h-36 rounded-2xl" />
            <Bone className="h-28 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Streak ring ────────────────────────────────────────────────────────────────

function StreakRing({ streak = 0, size = 80 }: { streak: number; size?: number }) {
  const r     = (size / 2) - 6;
  const circ  = 2 * Math.PI * r;
  const fill  = Math.min(streak / 7, 1) * circ;
  const color = streak >= 7 ? "#F59E0B" : streak >= 3 ? "#6366F1" : "#94A3B8";
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sp-ring-track)" strokeWidth="5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.34,1.56,0.64,1)" }} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <Flame className="h-4 w-4" style={{ color }} />
        <span className="text-sm font-black" style={{ color: "var(--sp-text)" }}>{streak}</span>
      </div>
    </div>
  );
}

// ── Level badge ────────────────────────────────────────────────────────────────

function LevelBadge({ xp = 0 }: { xp: number }) {
  const level    = Math.floor(xp / 100) + 1;
  const progress = xp % 100;
  const LEVEL_NAMES = ["Newcomer", "Explorer", "Scholar", "Achiever", "Expert", "Master", "Legend"];
  const name     = LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500 text-white shadow-lg shadow-indigo-500/30">
            <Zap className="h-3.5 w-3.5" fill="white" />
          </div>
          <div>
            <p className="text-xs font-black" style={{ color: "var(--sp-text)" }}>Level {level} · {name}</p>
            <p className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>{xp} XP total</p>
          </div>
        </div>
        <span className="text-[10px] font-bold text-indigo-500">{100 - progress} to next</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--sp-ring-track)" }}>
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, accent, delta }: {
  icon: React.ReactNode; label: string; value: number; accent: string; delta?: string;
}) {
  const count = useCountUp(value);
  return (
    <div className="group relative overflow-hidden rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg"
      style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
      <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-20 blur-xl transition-opacity group-hover:opacity-40"
        style={{ background: accent }} />
      <div className="mb-3 flex items-center justify-between">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: `${accent}20` }}>
          <span style={{ color: accent }}>{icon}</span>
        </div>
        {delta && (
          <span className="flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-500">
            <ChevronUp className="h-2.5 w-2.5" />{delta}
          </span>
        )}
      </div>
      <p className="text-2xl font-black tabular-nums" style={{ color: "var(--sp-text)" }}>{count}</p>
      <p className="mt-0.5 text-[11px] font-medium" style={{ color: "var(--sp-text-3)" }}>{label}</p>
    </div>
  );
}

// ── Course card ────────────────────────────────────────────────────────────────

function CourseCard({ course, index }: { course: Course; index: number }) {
  const p       = COURSE_PALETTE[index % COURSE_PALETTE.length];
  const initials = courseInitials(course.name);
  return (
    <Link
      href={`/dashboard/courses/${course.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
      style={{ background: p.light, borderColor: p.border }}
    >
      <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-2xl opacity-60" style={{ background: p.accent }} />
      <div
        className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-sm font-black text-white shadow-md"
        style={{ background: p.accent, boxShadow: `0 4px 12px ${p.accent}40` }}
      >
        {initials}
      </div>
      <p className="flex-1 text-xs font-bold leading-snug" style={{ color: p.accent }}>{course.name}</p>
      <div
        className="mt-3 flex items-center gap-1 text-[10px] font-bold opacity-0 transition-opacity group-hover:opacity-100"
        style={{ color: p.accent }}
      >
        Study now <ArrowRight className="h-2.5 w-2.5" />
      </div>
    </Link>
  );
}

// ── Activity item ──────────────────────────────────────────────────────────────

function ActivityItem({ q, index }: { q: RecentQuestion; index: number }) {
  const p = COURSE_PALETTE[index % COURSE_PALETTE.length];
  return (
    <Link
      href={`/questions/${q.id}`}
      className="group flex items-center gap-3 rounded-xl border p-3 transition-all hover:border-indigo-500/30 hover:shadow-md"
      style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
        style={{ background: p.accent, boxShadow: `0 3px 10px ${p.accent}35` }}
      >
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold" style={{ color: "var(--sp-text)" }}>{q.title}</p>
        <p className="truncate text-[10px] mt-0.5" style={{ color: "var(--sp-text-3)" }}>
          {q.course?.name ?? "—"}{q.year ? ` · ${q.year}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>
          {new Date(q.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
        </span>
        {q.views != null && (
          <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--sp-text-3)" }}>
            <Users className="h-2.5 w-2.5" />{q.views}
          </span>
        )}
      </div>
    </Link>
  );
}

// ── Upgrade card ───────────────────────────────────────────────────────────────

function UpgradeCard() {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 text-white"
      style={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #9333EA 100%)" }}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-6 -left-6 h-20 w-20 rounded-full bg-white/10 blur-xl" />
      <div className="relative">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur">
            <Crown className="h-4 w-4 text-yellow-300" fill="currentColor" />
          </div>
          <div>
            <p className="text-xs font-black">SparkL Pro</p>
            <p className="text-[10px] text-white/60">Student edition</p>
          </div>
        </div>
        <p className="text-[11px] text-white/80 leading-relaxed">
          Supercharge your studies with AI-powered tools built for Nigerian tertiary students.
        </p>
        <div className="mt-3 space-y-2">
          {[
            { icon: <Sparkles className="h-3 w-3" />,   text: "AI answer explanations" },
            { icon: <BarChart2 className="h-3 w-3" />,  text: "Unlimited practice mode" },
            { icon: <Award className="h-3 w-3" />,      text: "Certificates & badges" },
            { icon: <CheckCircle2 className="h-3 w-3"/>, text: "Download past questions" },
          ].map(f => (
            <div key={f.text} className="flex items-center gap-2">
              <span className="text-yellow-300">{f.icon}</span>
              <span className="text-[10px] font-medium text-white/80">{f.text}</span>
            </div>
          ))}
        </div>
        <Link
          href="/dashboard/subscribe"
          className="mt-4 flex items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 text-[11px] font-black text-indigo-700 transition hover:bg-yellow-50"
        >
          <Crown className="h-3 w-3 text-yellow-500" fill="currentColor" />
          Unlock Pro — ₦2,500/mo
        </Link>
      </div>
    </div>
  );
}

// ── Today focus ────────────────────────────────────────────────────────────────

function TodayFocus({ courses }: { courses: Course[] }) {
  const [idx] = useState(() => Math.floor(Math.random() * courses.length));
  const c     = courses[idx];
  if (!c) return null;
  const p = COURSE_PALETTE[idx % COURSE_PALETTE.length];
  return (
    <Link
      href={`/dashboard/courses/${c.id}`}
      className="group flex items-center gap-4 rounded-full border px-4 py-3 transition-all hover:shadow-md"
      style={{ background: `${p.accent}10`, borderColor: `${p.accent}30` }}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-xs font-black"
        style={{ background: p.accent }}
      >
        <Target className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: p.accent }}>Today's focus</p>
        <p className="truncate text-xs font-bold" style={{ color: "var(--sp-text)" }}>{c.name}</p>
      </div>
      <ArrowRight
        className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ color: p.accent }}
      />
    </Link>
  );
}

// ── Quick action ───────────────────────────────────────────────────────────────

function QuickAction({ href, icon, label, sub, color }: {
  href: string; icon: React.ReactNode; label: string; sub: string; color: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-lg"
      style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition-transform group-hover:scale-110"
        style={{ background: color, boxShadow: `0 4px 12px ${color}40` }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold" style={{ color: "var(--sp-text)" }}>{label}</p>
        <p className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>{sub}</p>
      </div>
      <ChevronRight
        className="h-3.5 w-3.5 shrink-0 opacity-30 group-hover:opacity-70 transition-opacity"
        style={{ color }}
      />
    </Link>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ icon, title, body, cta }: {
  icon: React.ReactNode; title: string; body: string;
  cta: { href: string; label: string };
}) {
  return (
    <div
      className="flex flex-col items-center rounded-2xl border-2 border-dashed px-8 py-12 text-center"
      style={{ borderColor: "var(--sp-border)" }}
    >
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">
        {icon}
      </div>
      <p className="text-sm font-bold" style={{ color: "var(--sp-text-2)" }}>{title}</p>
      <p className="mt-1.5 max-w-[200px] text-xs leading-relaxed" style={{ color: "var(--sp-text-3)" }}>{body}</p>
      <Link
        href={cta.href}
        className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-500 transition-all hover:-translate-y-0.5"
      >
        {cta.label} <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

// ── Streak section (day dots) ─────────────────────────────────────────────────

function StreakSection({ streak }: { streak: number }) {
  // Convert JS getDay() (0=Sun) to Mon-first index (0=Mon…6=Sun)
  const todayJS = new Date().getDay();
  const todayMF = todayJS === 0 ? 6 : todayJS - 1;

  return (
    <div className="rounded-2xl border p-4" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold" style={{ color: "var(--sp-text)" }}>Study streak</p>
        <span className="text-[10px] font-bold text-indigo-500">Goal: 7 days</span>
      </div>
      <div className="flex items-center gap-4">
        <StreakRing streak={streak} size={72} />
        <div className="flex-1 space-y-2">
          {/* Day dots — Mon to Sun */}
          <div className="flex gap-1">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => {
              // A day is "done" if it's before today AND within the current streak window
              const done    = i <= todayMF && (todayMF - i) < streak;
              const isToday = i === todayMF;
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-black transition-all"
                    style={{
                      background: done
                        ? "#6366F1"
                        : isToday
                        ? "rgba(99,102,241,0.18)"
                        : "var(--sp-ring-track)",
                      color: done ? "white" : isToday ? "#6366F1" : "var(--sp-text-3)",
                      boxShadow: done ? "0 2px 8px rgba(99,102,241,0.35)" : "none",
                      outline: isToday && !done ? "1.5px solid rgba(99,102,241,0.45)" : "none",
                    }}
                  >
                    {d}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] leading-relaxed" style={{ color: "var(--sp-text-3)" }}>
            {streak === 0
              ? "Start your streak today!"
              : streak >= 7
              ? "🔥 Full week! Amazing!"
              : `${7 - streak} more day${7 - streak !== 1 ? "s" : ""} to complete the week`}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function DashboardHomePage() {
  const supabase = createClient();
  const router   = useRouter();

  const [query, setQuery]                 = useState("");
  const [avatarUrl, setAvatarUrl]         = useState<string | null>(null);
  const [isPro, setIsPro]                 = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn:  () => fetchDashboardSummary(supabase, router),
  });

  // Fire streak update on every dashboard load (fire-and-forget)
  useEffect(() => {
    fireStreakUpdate(supabase);
  }, [supabase]);

  // Load avatar + subscription status
  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const r1 = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/avatar/me`,
          { headers: { Authorization: `Bearer ${session.access_token}` } },
        );
        if (r1.ok) { const j = await r1.json(); if (j.avatar_url) setAvatarUrl(j.avatar_url); }
      } catch {}
      try {
        const r2 = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/payments/subscription/status`,
          { headers: { Authorization: `Bearer ${session.access_token}` } },
        );
        if (r2.ok) { const j = await r2.json(); setIsPro(j.is_paid === true); }
      } catch {}
    }
    load();
  }, [supabase]);

  // Close search dropdown on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setQuery(""); setSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);


  const courses         = data?.profile.courses ?? [];
  const recentQuestions = data?.recent_questions ?? [];
  const stats           = data?.stats ?? { questions_in_courses: 0, my_uploads: 0 };
  const streak          = data?.profile.streak ?? 0;
  const xp              = data?.profile.xp ?? 0;
const { results: searchResults, searching: searchLoading } = useLocalCourseSearch(query, courses);
  if (isLoading) return <PageSkeleton />;

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center" style={{ background: "var(--sp-bg)" }}>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
          <AlertCircle className="h-6 w-6 text-red-500" />
        </div>
        <p className="text-sm font-semibold" style={{ color: "var(--sp-text-2)" }}>
          {error instanceof Error ? error.message : "Something went wrong."}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 transition"
        >
          Reload
        </button>
      </div>
    );
  }

  const firstName = (data.profile.full_name ?? "there").split(" ")[0];
  const hour      = new Date().getHours();
  const greeting  = hour < 5 ? "Still up?" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today     = new Date().toLocaleDateString("en-NG", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="min-h-screen" style={{ background: "var(--sp-bg)" }}>
      <style>{`
        @keyframes slideDown { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fadeUp    { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .anim-slide { animation: slideDown 0.3s ease both }
        .anim-1 { animation: fadeUp 0.4s ease both; animation-delay: 0.05s }
        .anim-2 { animation: fadeUp 0.4s ease both; animation-delay: 0.10s }
        .anim-3 { animation: fadeUp 0.4s ease both; animation-delay: 0.15s }
        .anim-4 { animation: fadeUp 0.4s ease both; animation-delay: 0.20s }
        .anim-5 { animation: fadeUp 0.4s ease both; animation-delay: 0.25s }
        .anim-6 { animation: fadeUp 0.4s ease both; animation-delay: 0.30s }
      `}</style>

      {/* ══ TOPBAR ══ */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-xl transition-colors"
        style={{ background: "var(--sp-header-bg)", borderColor: "var(--sp-border)" }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 lg:px-6">

          {/* Logo */}
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5 mr-2">
            <Image src="/images/logo.jpg" alt="SparkL" width={32} height={32} className="rounded-xl object-cover shadow-md" />
            <span className="hidden text-base font-black tracking-tight sm:block" style={{ color: "var(--sp-text)" }}>SparkL</span>
          </Link>

          {/* Search */}
          <div className="relative flex-1 max-w-md mx-auto" ref={searchRef}>
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors"
              style={{ color: searchFocused ? "#6366F1" : "var(--sp-text-3)" }}
            />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              placeholder="Search all courses…"
              className="w-full rounded-full border py-2.5 pl-11 pr-4 text-sm outline-none transition-all"
              style={{
                background:   "var(--sp-input-bg)",
                borderColor:  searchFocused ? "rgba(99,102,241,0.5)" : "var(--sp-border)",
                color:        "var(--sp-text)",
                boxShadow:    searchFocused ? "0 0 0 3px rgba(99,102,241,0.10)" : "none",
              }}
            />

            {/* Search dropdown */}
            {query.trim() && (
              <div
                className="anim-slide absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border shadow-2xl"
                style={{ background: "var(--sp-search-popup)", borderColor: "var(--sp-border)" }}
              >
                {searchLoading ? (
                  <div className="flex items-center justify-center gap-2 py-8">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                    <span className="text-xs" style={{ color: "var(--sp-text-3)" }}>Searching…</span>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="flex flex-col items-center py-8 gap-2">
                    <Search className="h-5 w-5 opacity-30" style={{ color: "var(--sp-text-3)" }} />
                    <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>
                      No courses match &ldquo;{query}&rdquo;
                    </p>
                  </div>
                ) : (
                  <div className="p-2">
                    <p
                      className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider"
                      style={{ color: "var(--sp-text-3)" }}
                    >
                      All courses
                    </p>
                    {searchResults.map((c, i) => {
                      const p        = COURSE_PALETTE[i % COURSE_PALETTE.length];
                      const initials = courseInitials(c.name);
                      
                      return (
                        <Link
                          key={c.id}
                          href={`/dashboard/courses/${c.id}`}
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-indigo-500/5"
                          onClick={() => { setQuery(""); setSearchFocused(false); }}
                        >
                          <div
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-black text-white"
                            style={{ background: p.accent }}
                          >
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold" style={{ color: "var(--sp-text)" }}>{c.name}</p>
                            
                          </div>
                          <ArrowRight className="ml-auto h-3 w-3 shrink-0" style={{ color: p.accent }} />
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <button
              className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors hover:border-indigo-500/30"
              style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
            >
              <Bell className="h-4 w-4" style={{ color: "var(--sp-text-2)" }} />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-indigo-500" />
            </button>
            <Link href="/dashboard/profile">
              {avatarUrl ? (
                <img
                  src={avatarUrl} alt="Profile"
                  className="h-9 w-9 rounded-xl object-cover ring-2 ring-indigo-500/30 transition hover:ring-indigo-500/60"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-[11px] font-black text-white shadow-md shadow-indigo-500/30">
                  {firstName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </Link>
          </div>
        </div>
      </header>

      {/* ══ MAIN LAYOUT ══ */}
      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">

          {/* ── LEFT RAIL ── */}
          <aside className="space-y-4 anim-1">

            {/* User card */}
            <div
              className="relative overflow-hidden rounded-2xl border p-5"
              style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-30"
                style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, transparent 60%)" }}
              />
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Profile" className="h-12 w-12 rounded-2xl object-cover ring-2 ring-indigo-500/20" />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-black text-white shadow-lg shadow-indigo-500/30">
                      {firstName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-black truncate" style={{ color: "var(--sp-text)" }}>
                      {data.profile.full_name ?? firstName}
                    </p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Active
                      </span>
                    </div>
                  </div>
                </div>

                {data.profile.department?.name && (
                  <div className="mb-4 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--sp-text-3)" }}>Academic</p>
                    {[data.profile.institution?.name, data.profile.department?.name, data.profile.level?.name]
                      .filter(Boolean)
                      .map(v => (
                        <p key={v} className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--sp-text-2)" }}>
                          <span className="h-1 w-1 rounded-full bg-indigo-500 shrink-0" />
                          {v}
                        </p>
                      ))}
                  </div>
                )}

                <LevelBadge xp={xp} />

                <Link
                  href="/dashboard/profile"
                  className="mt-4 flex items-center justify-center gap-1.5 rounded-xl border py-2 text-[11px] font-bold transition-all hover:border-indigo-500/40 hover:bg-indigo-500/5 hover:text-indigo-500"
                  style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}
                >
                  Edit profile <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Streak card */}
            <StreakSection streak={streak} />

            {/* Quick actions */}
            <div className="space-y-2">
              <p className="px-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--sp-text-3)" }}>
                Quick actions
              </p>
              <QuickAction href="/dashboard/upload"  label="Upload paper"   sub="Earn 50 XP per upload"  icon={<Upload className="h-4 w-4" />}       color="#6366F1" />
              <QuickAction href="/dashboard/courses" label="Browse courses" sub="Find past questions"     icon={<BookOpen className="h-4 w-4" />}      color="#0EA5E9" />
              <QuickAction href="/dashboard/profile" label="My profile"     sub="Account & settings"      icon={<GraduationCap className="h-4 w-4" />} color="#8B5CF6" />
            </div>
          </aside>

          {/* ── MAIN ── */}
          <main className="space-y-5 lg:col-span-2">

            {/* Greeting */}
            <div
              className="anim-1 relative overflow-hidden rounded-2xl border p-5"
              style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
            >
              <div
                className="pointer-events-none absolute right-0 top-0 h-32 w-32 opacity-10"
                style={{ background: "radial-gradient(circle, #6366F1 0%, transparent 70%)" }}
              />
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-3.5 w-3.5" style={{ color: "var(--sp-text-3)" }} />
                    <span className="text-[11px]" style={{ color: "var(--sp-text-3)" }}>{today}</span>
                  </div>
                  <p className="text-sm" style={{ color: "var(--sp-text-3)" }}>{greeting},</p>
                  <h1 className="text-2xl font-black tracking-tight mt-0.5" style={{ color: "var(--sp-text)" }}>
                    {firstName} 👋
                  </h1>
                  {data.profile.department?.name && (
                    <p className="mt-1 text-xs" style={{ color: "var(--sp-text-3)" }}>
                      {data.profile.department.name} · {data.profile.institution?.name}
                    </p>
                  )}
                </div>
                {!isPro && (
                  <Link
                    href="/dashboard/subscribe"
                    className="shrink-0 flex items-center gap-1.5 rounded-full bg-indigo-600 px-3.5 py-2 text-[11px] font-black text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-500 transition-all hover:-translate-y-0.5"
                  >
                    <Crown className="h-3 w-3 text-yellow-300" fill="currentColor" />
                    Go Pro
                  </Link>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="anim-2 grid grid-cols-3 gap-3">
              <StatCard icon={<BookOpen className="h-4 w-4" />} label="My courses"  value={courses.length}                accent="#6366F1" />
              <StatCard icon={<FileText className="h-4 w-4" />} label="Past papers" value={stats.questions_in_courses}    accent="#8B5CF6" />
              <StatCard icon={<Trophy className="h-4 w-4" />}   label="Uploads"     value={stats.my_uploads}              accent="#10B981"
                delta={stats.my_uploads > 0 ? `${stats.my_uploads}` : undefined} />
            </div>

            {/* Today's focus */}
            {courses.length > 0 && (
              <div className="anim-3"><TodayFocus courses={courses} /></div>
            )}

            {/* Courses */}
            <section className="anim-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black" style={{ color: "var(--sp-text)" }}>Your courses</h2>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--sp-text-3)" }}>
                    {courses.length} enrolled this semester
                  </p>
                </div>
                <Link
                  href="/onboarding"
                  className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-[10px] font-bold transition-all hover:border-indigo-500/40 hover:text-indigo-500"
                  style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}
                >
                  <Plus className="h-3 w-3" /> Manage
                </Link>
              </div>

              {courses.length === 0 ? (
                <EmptyState
                  icon={<BookOpen className="h-6 w-6" />}
                  title="No courses enrolled yet"
                  body="Enrol in your courses to unlock all past questions for your semester."
                  cta={{ href: "/onboarding", label: "Choose courses" }}
                />
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {courses.map((c, i) => <CourseCard key={c.id} course={c} index={i} />)}
                  <Link
                    href="/onboarding"
                    className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-4 transition-all hover:border-indigo-500/40 hover:bg-indigo-500/[0.03]"
                    style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}
                  >
                    <Plus className="h-5 w-5" />
                    <span className="text-[10px] font-bold">Add course</span>
                  </Link>
                </div>
              )}
            </section>

            {/* Recent uploads */}
            <section className="anim-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-black" style={{ color: "var(--sp-text)" }}>Recent uploads</h2>
                {recentQuestions.length > 0 && (
                  <Link href="/dashboard/courses" className="text-[11px] font-bold text-indigo-500 hover:underline">
                    See all
                  </Link>
                )}
              </div>

              {recentQuestions.length === 0 ? (
                <EmptyState
                  icon={<FileText className="h-6 w-6" />}
                  title="No papers yet"
                  body={`Be the first to upload for ${data.profile.department?.name ?? "your department"}.`}
                  cta={{ href: "/dashboard/upload", label: "Upload a paper" }}
                />
              ) : (
                <div className="space-y-2">
                  {recentQuestions.map((q, i) => <ActivityItem key={q.id} q={q} index={i} />)}
                </div>
              )}
            </section>
          </main>

          {/* ── RIGHT RAIL ── */}
          <aside className="space-y-4 anim-6">
            {!isPro && <UpgradeCard />}

            {isPro && (
              <div
                className="rounded-2xl border p-4 text-center"
                style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
              >
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600">
                  <Crown className="h-5 w-5 text-yellow-300" fill="currentColor" />
                </div>
                <p className="text-xs font-black" style={{ color: "var(--sp-text)" }}>SparkL Pro Active</p>
                <p className="mt-1 text-[10px]" style={{ color: "var(--sp-text-3)" }}>All features unlocked</p>
              </div>
            )}

            {stats.my_uploads === 0 && (
              <div
                className="rounded-2xl border p-4"
                style={{ background: "rgba(245,158,11,0.07)", borderColor: "rgba(245,158,11,0.22)" }}
              >
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20">
                    <Flame className="h-3.5 w-3.5 text-amber-500" />
                  </div>
                  <p className="text-xs font-black" style={{ color: "var(--sp-text)" }}>Start contributing</p>
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: "var(--sp-text-2)" }}>
                  Upload your first past question and earn 50 XP instantly. Help your department grow.
                </p>
                <Link
                  href="/dashboard/upload"
                  className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 py-2.5 text-[11px] font-black text-white hover:bg-amber-400 transition-all"
                >
                  <Upload className="h-3 w-3" /> Upload now
                </Link>
              </div>
            )}

            <div className="rounded-2xl border p-4" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                <p className="text-xs font-black" style={{ color: "var(--sp-text)" }}>Study tip</p>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--sp-text-2)" }}>
                Students who practice with past questions score{" "}
                <span className="font-bold text-indigo-500">40% higher</span> on average. Try practice mode now.
              </p>
            </div>
          </aside>

        </div>
      </div>
    </div>
  );
}