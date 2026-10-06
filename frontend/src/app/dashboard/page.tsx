// app/dashboard/page.tsx  — SparkL Dashboard (v2)
"use client";

import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen, Upload, FileText, GraduationCap,
  ArrowRight, Plus, Flame, Users, AlertCircle,
  Crown, Sparkles, Target, Trophy, Zap, BarChart2,
  CheckCircle2, Calendar, Award, ChevronUp, Timer,
  ChevronRight, RefreshCw,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface Course { id: string; name: string }
interface Profile {
  full_name:   string | null;
  phone:       string | null;
  institution: { name: string } | null;
  department:  { name: string } | null;
  level:       { name: string } | null;
  study_mode:  { name: string } | null;
  courses?:    Course[];
  streak?:     number;
  xp?:         number;
}
interface RecentQuestion {
  id:         string;
  title:      string;
  year:       number | null;
  created_at: string;
  course:     { name: string } | null;
  views?:     number;
}
interface DashboardData {
  profile:          Profile;
  recent_questions: RecentQuestion[];
  stats:            { questions_in_courses: number; my_uploads: number };
}
interface SubStatus {
  is_paid:          boolean;
  is_trial:         boolean;
  effective_plan:   string;
  expires_at:       string | null;
  trial_days_left?: number;
}
interface Tier {
  key:          string;
  label:        string;
  detail:       string;
  color:        string;
  isPaid:       boolean;
  isTrial:      boolean;
  expiringSoon: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const PALETTE = [
  { accent: "#6366F1", bg: "rgba(99,102,241,0.10)",  border: "rgba(99,102,241,0.22)"  },
  { accent: "#0EA5E9", bg: "rgba(14,165,233,0.10)",  border: "rgba(14,165,233,0.22)"  },
  { accent: "#8B5CF6", bg: "rgba(139,92,246,0.10)",  border: "rgba(139,92,246,0.22)"  },
  { accent: "#10B981", bg: "rgba(16,185,129,0.10)",  border: "rgba(16,185,129,0.22)"  },
  { accent: "#F59E0B", bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.22)"  },
  { accent: "#EF4444", bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.22)"   },
] as const;

const TIER_COLORS: Record<string, string> = {
  unknown: "#64748B", free: "#64748B", trial: "#F59E0B",
  basic: "#0EA5E9",   pro: "#6366F1",  premium: "#8B5CF6",
};

const LEVEL_NAMES = [
  "Newcomer", "Explorer", "Scholar", "Achiever",
  "Expert",   "Master",   "Legend",
];

const DAYS = ["M", "T", "W", "T", "F", "S", "S"] as const;

// ─────────────────────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────────────────────

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return isNaN(t) ? null : Math.ceil((t - Date.now()) / 86_400_000);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric", month: "short",
  });
}

function getTier(sub: SubStatus | null): Tier {
  if (!sub) return {
    key: "unknown", label: "My plan", detail: "View plans",
    color: TIER_COLORS.unknown, isPaid: false, isTrial: false, expiringSoon: false,
  };
  if (sub.is_trial) {
    const d = sub.trial_days_left ?? 0;
    return {
      key: "trial", label: "Free Trial",
      detail: `${d} day${d === 1 ? "" : "s"} left`,
      color: TIER_COLORS.trial, isPaid: false, isTrial: true, expiringSoon: d <= 2,
    };
  }
  if (sub.is_paid) {
    const plan  = (sub.effective_plan || "pro").toLowerCase();
    const label = plan.charAt(0).toUpperCase() + plan.slice(1);
    const days  = daysUntil(sub.expires_at);
    const soon  = days !== null && days <= 7;
    let detail  = "Active";
    if (days !== null)
      detail = days <= 0 ? "Expires today" : soon
        ? `${days}d left · Renew`
        : `Until ${fmtDate(sub.expires_at!)}`;
    return {
      key: plan, label, detail,
      color: TIER_COLORS[plan] ?? TIER_COLORS.pro,
      isPaid: true, isTrial: false, expiringSoon: soon,
    };
  }
  const expired = (daysUntil(sub.expires_at) ?? 1) <= 0;
  return {
    key: "free", label: "Free",
    detail: expired ? "Plan expired · Renew" : "Upgrade for full access",
    color: TIER_COLORS.free, isPaid: false, isTrial: false, expiringSoon: false,
  };
}

function courseInitials(name: string) {
  return name.split(" ")
    .filter(w => /^[a-zA-Z]/.test(w))
    .map(w => w[0].toUpperCase())
    .slice(0, 2).join("") || name.slice(0, 2).toUpperCase();
}

function parseCourse(name: string): { code: string | null; title: string } {
  const m = name.match(
    /^\s*([A-Za-z]{2,5})\s?-?\s?(\d{2,4}[A-Za-z]?)\s*[-:–—]?\s*(.*)$/
  );
  if (!m) return { code: null, title: name };
  return { code: `${m[1].toUpperCase()} ${m[2]}`, title: m[3].trim() || name };
}

const clamp2: React.CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

// ─────────────────────────────────────────────────────────────────────────────
// HOOKS
// ─────────────────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 1000) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    const tick  = (now: number) => {
      const p    = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(ease * target));
      if (p < 1) requestAnimationFrame(tick);
    };
    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [target, duration]);
  return value;
}

// ─────────────────────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────────────────────

async function fetchDashboard(
  supabase: ReturnType<typeof createClient>,
  router:   ReturnType<typeof useRouter>,
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

async function pingStreak(supabase: ReturnType<typeof createClient>) {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/dashboard/streak/update`,
      { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } },
    );
  } catch { /* fire-and-forget */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON
// ─────────────────────────────────────────────────────────────────────────────

function Bone({ className = "" }: { className?: string }) {
  return <div className={`sp-bone rounded-xl ${className}`} />;
}

function PageSkeleton() {
  return (
    <div className="min-h-screen" style={{ background: "var(--sp-bg)" }}>
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
          <div className="space-y-4">
            <Bone className="h-52 rounded-2xl" />
            <Bone className="h-36 rounded-2xl" />
            <Bone className="h-44 rounded-2xl" />
          </div>
          <div className="space-y-5 lg:col-span-2">
            <Bone className="h-28 rounded-2xl" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[...Array(4)].map((_, i) => <Bone key={i} className="h-24 rounded-2xl" />)}
            </div>
            <Bone className="h-12 rounded-full" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[...Array(6)].map((_, i) => <Bone key={i} className="h-40 rounded-2xl" />)}
            </div>
          </div>
          <div className="space-y-4">
            <Bone className="h-56 rounded-2xl" />
            <Bone className="h-36 rounded-2xl" />
            <Bone className="h-28 rounded-2xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STREAK RING
// ─────────────────────────────────────────────────────────────────────────────

function StreakRing({ streak = 0, size = 72 }: { streak: number; size?: number }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  const r     = (size / 2) - 7;
  const circ  = 2 * Math.PI * r;
  const fill  = mounted ? Math.min(streak / 7, 1) * circ : 0;
  const color = streak >= 7 ? "#F59E0B" : streak >= 3 ? "#6366F1" : "#94A3B8";

  return (
    <div className="relative shrink-0 flex items-center justify-center"
      style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90" aria-hidden="true">
        <circle cx={size/2} cy={size/2} r={r}
          fill="none" stroke="var(--sp-ring-track)" strokeWidth="5.5" />
        <circle cx={size/2} cy={size/2} r={r}
          fill="none" stroke={color} strokeWidth="5.5"
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1.1s cubic-bezier(0.34,1.56,0.64,1)" }} />
      </svg>
      <div className="absolute flex flex-col items-center gap-0.5">
        <Flame className="h-3.5 w-3.5" style={{ color }} />
        <span className="text-sm font-black tabular-nums leading-none"
          style={{ color: "var(--sp-text)" }}>{streak}</span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STREAK SECTION  — Fixed overlap
// ─────────────────────────────────────────────────────────────────────────────

function StreakSection({ streak }: { streak: number }) {
  const todayJS = new Date().getDay();
  const todayMF = todayJS === 0 ? 6 : todayJS - 1; // Mon=0 … Sun=6

  return (
    <div className="rounded-2xl border p-4"
      style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>

      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold" style={{ color: "var(--sp-text)" }}>Study streak</p>
        <span className="text-[10px] font-bold text-indigo-500">Goal: 7 days</span>
      </div>

      <div className="flex items-center gap-3">
        <StreakRing size={68} streak={streak} />

        <div className="flex-1 min-w-0 space-y-2.5">

          {/* Day dots — fixed width, letter below */}
          <div className="flex items-end" style={{ gap: "3px" }}>
            {DAYS.map((d, i) => {
              const done    = i < todayMF && (todayMF - i) <= streak;
              const isToday = i === todayMF;
              return (
                <div key={i} className="flex flex-col items-center"
                  style={{ flex: "1 1 0", gap: "3px", minWidth: 0 }}>
                  {/* Dot — 20 px fixed, never shrinks */}
                  <div style={{
                    width: 20, height: 20,
                    minWidth: 20, flexShrink: 0,
                    borderRadius: "50%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: done
                      ? "#6366F1"
                      : isToday
                      ? "rgba(99,102,241,0.15)"
                      : "var(--sp-ring-track)",
                    boxShadow:   done ? "0 2px 8px rgba(99,102,241,0.38)" : "none",
                    outline:     isToday && !done ? "1.5px solid #6366F1" : "none",
                    outlineOffset: "1px",
                    transition:  "background 0.3s, box-shadow 0.3s",
                  }}>
                    {done && (
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                        <path d="M1.5 4L3.5 6L6.5 2"
                          stroke="white" strokeWidth="1.5"
                          strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {isToday && !done && (
                      <div style={{
                        width: 5, height: 5, borderRadius: "50%", background: "#6366F1",
                      }} />
                    )}
                  </div>
                  {/* Letter — always below, never inside */}
                  <span style={{
                    fontSize: 9,
                    fontWeight: isToday ? 700 : 500,
                    lineHeight: 1,
                    color: done
                      ? "#6366F1"
                      : isToday
                      ? "#6366F1"
                      : "var(--sp-text-3)",
                    userSelect: "none",
                  }}>{d}</span>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] leading-relaxed" style={{ color: "var(--sp-text-3)" }}>
            {streak === 0
              ? "Study today to start your streak!"
              : streak >= 7
              ? "🔥 Full week — incredible!"
              : `${7 - streak} more day${7 - streak !== 1 ? "s" : ""} to hit your goal`}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LEVEL BADGE
// ─────────────────────────────────────────────────────────────────────────────

function LevelBadge({ xp = 0 }: { xp: number }) {
  const level    = Math.floor(xp / 100) + 1;
  const progress = xp % 100;
  const name     = LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg
            bg-indigo-500 text-white shadow-lg shadow-indigo-500/30">
            <Zap className="h-3.5 w-3.5" fill="white" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black truncate"
              style={{ color: "var(--sp-text)" }}>
              Level {level} · {name}
            </p>
            <p className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>
              {xp} XP total
            </p>
          </div>
        </div>
        <span className="text-[10px] font-bold text-indigo-500 shrink-0">
          {100 - progress} to next
        </span>
      </div>

      {/* XP bar */}
      <div className="h-2 w-full overflow-hidden rounded-full"
        style={{ background: "var(--sp-ring-track)" }}>
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{
            width: `${progress}%`,
            background: "linear-gradient(90deg, #6366F1, #8B5CF6)",
          }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({
  icon, label, value, accent, delta,
}: {
  icon:    React.ReactNode;
  label:   string;
  value:   number;
  accent:  string;
  delta?:  string;
}) {
  const count = useCountUp(value);
  return (
    <div className="group relative overflow-hidden rounded-2xl border p-4
      transition-all hover:-translate-y-0.5 hover:shadow-lg"
      style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
      {/* Glow */}
      <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16
        rounded-full opacity-20 blur-xl transition-opacity group-hover:opacity-40"
        style={{ background: accent }} />

      <div className="mb-3 flex items-center justify-between">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl"
          style={{ background: `${accent}20` }}>
          <span style={{ color: accent }}>{icon}</span>
        </div>
        {delta && (
          <span className="flex items-center gap-0.5 rounded-full
            bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-500">
            <ChevronUp className="h-2.5 w-2.5" />{delta}
          </span>
        )}
      </div>
      <p className="text-2xl font-black tabular-nums"
        style={{ color: "var(--sp-text)" }}>{count.toLocaleString()}</p>
      <p className="mt-0.5 text-[11px] font-medium"
        style={{ color: "var(--sp-text-3)" }}>{label}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PLAN TILE  (4th stat card slot)
// ─────────────────────────────────────────────────────────────────────────────

function PlanTile({ tier }: { tier: Tier }) {
  return (
    <Link href="/dashboard/subscribe"
      className="group relative overflow-hidden rounded-2xl border p-4
        transition-all hover:-translate-y-0.5 hover:shadow-lg"
      style={{ background: "var(--sp-bg-card)", borderColor: `${tier.color}40` }}>
      <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16
        rounded-full opacity-20 blur-xl transition-opacity group-hover:opacity-50"
        style={{ background: tier.color }} />
      <div className="mb-3 flex items-center justify-between">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl"
          style={{ background: `${tier.color}20` }}>
          <Crown className="h-4 w-4" style={{ color: tier.color }} />
        </div>
        <ChevronRight className="h-3.5 w-3.5 opacity-30 transition-opacity group-hover:opacity-80"
          style={{ color: tier.color }} />
      </div>
      <p className="truncate text-xl font-black leading-tight"
        style={{ color: tier.color }}>{tier.label}</p>
      <p className="mt-0.5 truncate text-[11px] font-medium"
        style={{ color: "var(--sp-text-3)" }}>{tier.detail}</p>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COURSE CARD
// ─────────────────────────────────────────────────────────────────────────────

function CourseCard({ course, index }: { course: Course; index: number }) {
  const p        = PALETTE[index % PALETTE.length];
  const { code, title } = parseCourse(course.name);
  const initials = courseInitials(course.name);

  return (
    <Link href={`/dashboard/courses/${course.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border
        transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
      style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>

      {/* Card top — document preview */}
      <div className="relative h-24 overflow-hidden flex items-end justify-center pb-1"
        style={{ background: `linear-gradient(135deg, ${p.accent}22, ${p.accent}0a)` }}>

        {/* Mini doc */}
        <div className="relative h-[80px] w-[58px] rounded-md bg-white transition-transform
          duration-200 group-hover:-translate-y-1"
          style={{ boxShadow: `0 6px 18px ${p.accent}30` }}>
          <div className="mx-2 mt-2 h-1.5 rounded-full" style={{ background: p.accent }} />
          {[0,1,2,3,4].map(i => (
            <div key={i} className="mx-2 mt-1.5 h-[3px] rounded-full"
              style={{
                background: "rgba(0,0,0,0.10)",
                width: `${55 + ((i * 19) % 35)}%`,
              }} />
          ))}
        </div>

        {/* Course code badge */}
        <span className="absolute left-2 top-2 rounded-md px-1.5 py-0.5
          text-[9px] font-black text-white shadow-sm"
          style={{ background: p.accent }}>
          {code ?? initials}
        </span>
      </div>

      {/* Card body */}
      <div className="flex flex-1 flex-col p-3">
        <p className="min-h-[2.25rem] text-xs font-bold leading-snug"
          style={{ ...clamp2, color: "var(--sp-text)" }}>{title}</p>
        <p className="mt-1 text-[10px]" style={{ color: "var(--sp-text-3)" }}>
          Past questions · Practice
        </p>
        <div className="mt-2.5 flex items-center gap-1 text-[10px] font-bold"
          style={{ color: p.accent }}>
          Study now
          <ArrowRight className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTIVITY ITEM
// ─────────────────────────────────────────────────────────────────────────────

function ActivityItem({ q, index }: { q: RecentQuestion; index: number }) {
  const p          = PALETTE[index % PALETTE.length];
  const courseCode = q.course?.name ? parseCourse(q.course.name).code : null;

  return (
    <Link href={`/questions/${q.id}`}
      className="group block rounded-xl border p-3 transition-all
        hover:border-indigo-500/30 hover:shadow-md"
      style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center
          rounded-xl text-white"
          style={{ background: p.accent, boxShadow: `0 3px 10px ${p.accent}35` }}>
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-1.5 flex-wrap">
            <span className="rounded px-1.5 py-0.5 text-[8px] font-black
              uppercase tracking-wider"
              style={{ background: `${p.accent}18`, color: p.accent }}>
              Past question
            </span>
            <span className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>
              {fmtShort(q.created_at)}
            </span>
          </div>
          <p className="truncate text-xs font-semibold"
            style={{ color: "var(--sp-text)" }}>{q.title}</p>
          <div className="mt-0.5 flex items-center gap-2 text-[10px]"
            style={{ color: "var(--sp-text-3)" }}>
            <span className="truncate">
              {courseCode ?? q.course?.name ?? "—"}
              {q.year ? ` · ${q.year}` : ""}
            </span>
            {q.views != null && (
              <span className="flex shrink-0 items-center gap-1">
                <Users className="h-2.5 w-2.5" />{q.views.toLocaleString()} views
              </span>
            )}
          </div>
        </div>
        <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-0
          group-hover:opacity-50 transition-opacity mt-1"
          style={{ color: "var(--sp-text-3)" }} />
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UPGRADE / TIER CARDS
// ─────────────────────────────────────────────────────────────────────────────

const UPGRADE_FEATURES = [
  { icon: BookOpen,     label: "All courses unlocked"             },
  { icon: BarChart2,    label: "Unlimited read & practice mode"   },
  { icon: Sparkles,     label: "AI Cram study assistant"          },
  { icon: CheckCircle2, label: "Unlimited note uploads (Pro)"     },
  { icon: Award,        label: "YouTube & link study (Premium)"   },
] as const;

function UpgradeCard({ tier }: { tier: Tier }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 text-white"
      style={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 55%, #9333EA 100%)" }}>
      {/* Decorative blobs */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28
        rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-6 -left-6 h-20 w-20
        rounded-full bg-white/10 blur-xl" />

      <div className="relative">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center
            rounded-lg bg-white/20 backdrop-blur-sm">
            <Crown className="h-4 w-4 text-yellow-300" fill="currentColor" />
          </div>
          <div>
            <p className="text-xs font-black">
              {tier.isTrial ? "Keep full access" : "Upgrade SparkL"}
            </p>
            <p className="text-[10px] text-white/60">
              {tier.isTrial ? tier.detail : "Semester plans for students"}
            </p>
          </div>
        </div>

        <p className="text-[11px] text-white/80 leading-relaxed">
          Unlock every course and AI study tools built for Nigerian tertiary students.
        </p>

        <div className="mt-3 space-y-1.5">
          {UPGRADE_FEATURES.map(({ icon: Icon, label }) => (
            <div key={label} className="flex items-center gap-2">
              <Icon className="h-3 w-3 text-yellow-300 shrink-0" />
              <span className="text-[10px] font-medium text-white/80">{label}</span>
            </div>
          ))}
        </div>

        <Link href="/dashboard/subscribe"
          className="mt-4 flex items-center justify-center gap-1.5 rounded-xl
            bg-white py-2.5 text-[11px] font-black text-indigo-700
            transition-all hover:bg-yellow-50 hover:-translate-y-0.5">
          <Crown className="h-3 w-3 text-yellow-500" fill="currentColor" />
          See plans — from ₦2,000/semester
        </Link>
      </div>
    </div>
  );
}

function TierCard({ tier }: { tier: Tier }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border p-4"
      style={{ background: "var(--sp-bg-card)", borderColor: `${tier.color}40` }}>
      <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20
        rounded-full opacity-20 blur-xl" style={{ background: tier.color }} />

      <div className="relative">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl shadow-lg"
            style={{ background: tier.color, boxShadow: `0 6px 16px ${tier.color}40` }}>
            <Crown className="h-5 w-5 text-yellow-300" fill="currentColor" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black truncate"
              style={{ color: "var(--sp-text)" }}>SparkL {tier.label}</p>
            <p className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>
              {tier.detail}
            </p>
          </div>
        </div>

        {tier.expiringSoon && (
          <div className="mb-3 rounded-lg border border-amber-500/25
            bg-amber-500/[0.07] px-3 py-2">
            <p className="text-[10px] font-semibold text-amber-500">
              Your plan ends soon — renew to keep access.
            </p>
          </div>
        )}

        <Link href="/dashboard/subscribe"
          className="flex items-center justify-center gap-1.5 rounded-xl
            border py-2 text-[11px] font-bold transition-all hover:-translate-y-0.5"
          style={{
            background: `${tier.color}10`,
            borderColor: `${tier.color}40`,
            color: tier.color,
          }}>
          {tier.expiringSoon ? "Renew plan" : "Manage plan"}
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TODAY'S FOCUS
// ─────────────────────────────────────────────────────────────────────────────

function TodayFocus({ courses }: { courses: Course[] }) {
  const [idx] = useState(() => Math.floor(Math.random() * Math.max(courses.length, 1)));
  const c = courses[idx];
  if (!c) return null;
  const p = PALETTE[idx % PALETTE.length];

  return (
    <Link href={`/dashboard/courses/${c.id}`}
      className="group flex items-center gap-3 rounded-2xl border
        px-4 py-3 transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{ background: `${p.accent}0d`, borderColor: `${p.accent}28` }}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center
        rounded-full text-white" style={{ background: p.accent }}>
        <Target className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider"
          style={{ color: p.accent }}>Today&apos;s focus</p>
        <p className="truncate text-xs font-bold"
          style={{ color: "var(--sp-text)" }}>{c.name}</p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-0
        group-hover:opacity-100 transition-opacity" style={{ color: p.accent }} />
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QUICK ACTION
// ─────────────────────────────────────────────────────────────────────────────

function QuickAction({
  href, icon, label, sub, color,
}: {
  href:  string;
  icon:  React.ReactNode;
  label: string;
  sub:   string;
  color: string;
}) {
  return (
    <Link href={href}
      className="group flex items-center gap-3 rounded-xl border p-3
        transition-all hover:-translate-y-0.5 hover:shadow-md"
      style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center
        rounded-xl text-white transition-transform group-hover:scale-110"
        style={{ background: color, boxShadow: `0 4px 12px ${color}40` }}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold" style={{ color: "var(--sp-text)" }}>{label}</p>
        <p className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>{sub}</p>
      </div>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-20
        group-hover:opacity-60 transition-opacity" style={{ color }} />
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EMPTY STATE
// ─────────────────────────────────────────────────────────────────────────────

function EmptyState({
  icon, title, body, cta,
}: {
  icon:  React.ReactNode;
  title: string;
  body:  string;
  cta:   { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border-2 border-dashed
      px-8 py-12 text-center"
      style={{ borderColor: "var(--sp-border)" }}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center
        rounded-2xl bg-indigo-500/10 text-indigo-500">
        {icon}
      </div>
      <p className="text-sm font-bold" style={{ color: "var(--sp-text-2)" }}>{title}</p>
      <p className="mt-1.5 max-w-[200px] text-xs leading-relaxed"
        style={{ color: "var(--sp-text-3)" }}>{body}</p>
      <Link href={cta.href}
        className="mt-5 inline-flex items-center gap-1.5 rounded-xl
          bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white
          shadow-lg shadow-indigo-500/25 transition-all
          hover:bg-indigo-500 hover:-translate-y-0.5">
        {cta.label} <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SECTION HEADER
// ─────────────────────────────────────────────────────────────────────────────

function SectionHeader({
  title, sub, action,
}: {
  title:  string;
  sub?:   string;
  action?: { href: string; label: string; icon?: React.ReactNode };
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-sm font-black"
          style={{ color: "var(--sp-text)" }}>{title}</h2>
        {sub && (
          <p className="text-[10px] mt-0.5"
            style={{ color: "var(--sp-text-3)" }}>{sub}</p>
        )}
      </div>
      {action && (
        <Link href={action.href}
          className="flex items-center gap-1 rounded-full border
            px-3 py-1.5 text-[10px] font-bold transition-all
            hover:border-indigo-500/40 hover:text-indigo-500 shrink-0"
          style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}>
          {action.icon}{action.label}
        </Link>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CRAM PROMO CARD
// ─────────────────────────────────────────────────────────────────────────────

function CramCard() {
  return (
    <Link href="/study"
      className="group relative overflow-hidden rounded-2xl border p-4
        flex flex-col gap-2 transition-all hover:-translate-y-0.5 hover:shadow-lg"
      style={{ background: "var(--sp-bg-card)", borderColor: "rgba(139,92,246,0.28)" }}>
      <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20
        rounded-full opacity-15 blur-xl bg-violet-500" />
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center
          rounded-lg bg-violet-500/15">
          <Sparkles className="h-3.5 w-3.5 text-violet-500" />
        </div>
        <p className="text-xs font-black" style={{ color: "var(--sp-text)" }}>
          SparkL Cram
        </p>
        <span className="ml-auto rounded-full bg-violet-500/15 px-1.5 py-0.5
          text-[8px] font-black text-violet-500">AI</span>
      </div>
      <p className="text-[11px] leading-relaxed"
        style={{ color: "var(--sp-text-2)" }}>
        Upload notes or paste a topic — Cram turns it into flashcards,
        summaries and quiz questions instantly.
      </p>
      <div className="flex items-center gap-1 text-[11px] font-bold text-violet-500 mt-1">
        Try Cram
        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// UPLOAD NUDGE CARD
// ─────────────────────────────────────────────────────────────────────────────

function UploadNudge() {
  return (
    <div className="rounded-2xl border p-4"
      style={{ background: "rgba(245,158,11,0.07)", borderColor: "rgba(245,158,11,0.22)" }}>
      <div className="mb-2 flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20">
          <Flame className="h-3.5 w-3.5 text-amber-500" />
        </div>
        <p className="text-xs font-black" style={{ color: "var(--sp-text)" }}>
          Start contributing
        </p>
      </div>
      <p className="text-[11px] leading-relaxed" style={{ color: "var(--sp-text-2)" }}>
        Upload your first past question and earn <strong>50 XP</strong> instantly.
        Help your department grow.
      </p>
      <Link href="/dashboard/upload"
        className="mt-3 flex items-center justify-center gap-1.5 rounded-xl
          bg-amber-500 py-2.5 text-[11px] font-black text-white
          transition-all hover:bg-amber-400 hover:-translate-y-0.5">
        <Upload className="h-3 w-3" /> Upload now
      </Link>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STUDY TIP CARD
// ─────────────────────────────────────────────────────────────────────────────

function StudyTip() {
  return (
    <div className="rounded-2xl border p-4"
      style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-violet-500" />
        <p className="text-xs font-black" style={{ color: "var(--sp-text)" }}>
          Study tip
        </p>
      </div>
      <p className="text-[11px] leading-relaxed" style={{ color: "var(--sp-text-2)" }}>
        Students who practice with past questions score{" "}
        <span className="font-bold text-indigo-500">40% higher</span>{" "}
        on average. Start practice mode now.
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GREETING HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5)  return "Still up?";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function getTodayStr() {
  return new Date().toLocaleDateString("en-NG", {
    weekday: "long", day: "numeric", month: "long",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE CARD (left rail)
// ─────────────────────────────────────────────────────────────────────────────

function ProfileCard({
  profile, avatarUrl, xp, firstName,
}: {
  profile:   Profile;
  avatarUrl: string | null;
  xp:        number;
  firstName: string;
}) {
  const meta = [
    profile.institution?.name,
    profile.department?.name,
    profile.level?.name,
  ].filter(Boolean);

  return (
    <div className="relative overflow-hidden rounded-2xl border p-5"
      style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
      {/* Subtle gradient */}
      <div className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "linear-gradient(135deg, rgba(99,102,241,0.06) 0%, transparent 60%)",
        }} />

      <div className="relative space-y-4">
        {/* Avatar + name */}
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile"
              className="h-12 w-12 rounded-2xl object-cover ring-2 ring-indigo-500/20" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl
              bg-gradient-to-br from-indigo-500 to-violet-600
              text-sm font-black text-white shadow-lg shadow-indigo-500/25">
              {firstName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-black truncate"
              style={{ color: "var(--sp-text)" }}>
              {profile.full_name ?? firstName}
            </p>
            <span className="mt-0.5 flex w-fit items-center gap-1 rounded-full
              bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Active
            </span>
          </div>
        </div>

        {/* Academic info */}
        {meta.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "var(--sp-text-3)" }}>Academic</p>
            {meta.map(v => (
              <p key={v} className="flex items-center gap-1.5 text-[11px]"
                style={{ color: "var(--sp-text-2)" }}>
                <span className="h-1 w-1 rounded-full bg-indigo-500 shrink-0" />{v}
              </p>
            ))}
          </div>
        )}

        <LevelBadge xp={xp} />

        <Link href="/dashboard/profile"
          className="flex items-center justify-center gap-1.5 rounded-xl border
            py-2 text-[11px] font-bold transition-all
            hover:border-indigo-500/40 hover:bg-indigo-500/5 hover:text-indigo-500"
          style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}>
          Edit profile <ChevronRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// GREETING CARD (main column top)
// ─────────────────────────────────────────────────────────────────────────────

function GreetingCard({
  firstName, profile, tier,
}: {
  firstName: string;
  profile:   Profile;
  tier:      Tier;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border p-5"
      style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
      <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 opacity-10"
        style={{ background: "radial-gradient(circle, #6366F1 0%, transparent 70%)" }} />

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-3.5 w-3.5" style={{ color: "var(--sp-text-3)" }} />
            <span className="text-[11px]" style={{ color: "var(--sp-text-3)" }}>
              {getTodayStr()}
            </span>
          </div>
          <p className="text-sm" style={{ color: "var(--sp-text-3)" }}>{getGreeting()},</p>
          <h1 className="text-2xl font-black tracking-tight mt-0.5"
            style={{ color: "var(--sp-text)" }}>{firstName} 👋</h1>
          {profile.department?.name && (
            <p className="mt-1 text-xs" style={{ color: "var(--sp-text-3)" }}>
              {profile.department.name}
              {profile.institution?.name ? ` · ${profile.institution.name}` : ""}
            </p>
          )}
        </div>

        {!tier.isPaid && (
          <Link href="/dashboard/subscribe"
            className="shrink-0 flex items-center gap-1.5 rounded-full
              bg-indigo-600 px-3.5 py-2 text-[11px] font-black text-white
              shadow-lg shadow-indigo-500/30 transition-all
              hover:bg-indigo-500 hover:-translate-y-0.5">
            <Crown className="h-3 w-3 text-yellow-300" fill="currentColor" />Upgrade
          </Link>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// COURSES GRID
// ─────────────────────────────────────────────────────────────────────────────

function CoursesGrid({ courses }: { courses: Course[] }) {
  return (
    <>
      <SectionHeader
        title="Your courses"
        sub={`${courses.length} enrolled this semester`}
        action={{
          href:  "/onboarding",
          label: "Manage",
          icon:  <Plus className="h-3 w-3 mr-0.5" />,
        }}
      />

      {courses.length === 0 ? (
        <EmptyState
          icon={<BookOpen className="h-6 w-6" />}
          title="No courses enrolled yet"
          body="Enrol in your courses to unlock all past questions for your semester."
          cta={{ href: "/onboarding", label: "Choose courses" }}
        />
      ) : (
        /* Horizontal scroll on mobile, responsive grid on larger screens */
        <div className="
          -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2
          no-scrollbar
          sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0
        ">
          {courses.map((c, i) => (
            <div key={c.id}
              className="w-[152px] shrink-0 snap-start sm:w-auto">
              <CourseCard course={c} index={i} />
            </div>
          ))}

          {/* Add course tile */}
          <Link href="/onboarding"
            className="flex min-h-[170px] w-[152px] shrink-0 snap-start
              flex-col items-center justify-center gap-2 rounded-2xl
              border-2 border-dashed p-4 transition-all
              hover:border-indigo-500/40 hover:bg-indigo-500/[0.03]
              sm:w-auto sm:min-h-0"
            style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}>
            <Plus className="h-5 w-5" />
            <span className="text-[10px] font-bold">Add course</span>
          </Link>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRACTICE CTA BANNER
// ─────────────────────────────────────────────────────────────────────────────

function PracticeBanner() {
  return (
    <Link href="/dashboard/courses"
      className="group flex items-center gap-4 rounded-2xl border p-4
        transition-all hover:-translate-y-0.5 hover:shadow-lg"
      style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center
        rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600
        text-white shadow-lg shadow-indigo-500/25">
        <Timer className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-black" style={{ color: "var(--sp-text)" }}>
          Simulate the real exam
        </p>
        <p className="text-[11px]" style={{ color: "var(--sp-text-3)" }}>
          Pick a course and practise past questions like it&apos;s exam day.
        </p>
      </div>
      <ArrowRight className="h-4 w-4 shrink-0 text-indigo-500 opacity-50
        transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
    </Link>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RECENT UPLOADS
// ─────────────────────────────────────────────────────────────────────────────

function RecentUploads({
  questions, departmentName,
}: {
  questions:      RecentQuestion[];
  departmentName: string | undefined;
}) {
  return (
    <>
      <SectionHeader
        title="Recent uploads"
        action={
          questions.length > 0
            ? { href: "/dashboard/courses", label: "See all" }
            : undefined
        }
      />
      {questions.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="No papers yet"
          body={`Be the first to upload for ${departmentName ?? "your department"}.`}
          cta={{ href: "/dashboard/upload", label: "Upload a paper" }}
        />
      ) : (
        <div className="space-y-2">
          {questions.map((q, i) => (
            <ActivityItem key={q.id} q={q} index={i} />
          ))}
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ERROR STATE
// ─────────────────────────────────────────────────────────────────────────────

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center px-4"
      style={{ background: "var(--sp-bg)" }}>
      <div className="flex h-14 w-14 items-center justify-center
        rounded-2xl border border-red-500/20 bg-red-500/10">
        <AlertCircle className="h-6 w-6 text-red-500" />
      </div>
      <div>
        <p className="text-sm font-bold" style={{ color: "var(--sp-text-2)" }}>
          {message}
        </p>
        <p className="mt-1 text-xs" style={{ color: "var(--sp-text-3)" }}>
          Check your connection and try again.
        </p>
      </div>
      <button
        onClick={onRetry}
        className="flex items-center gap-2 rounded-xl bg-indigo-600
          px-5 py-2.5 text-xs font-bold text-white
          transition hover:bg-indigo-500">
        <RefreshCw className="h-3.5 w-3.5" /> Reload
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardHomePage() {
  const supabase = createClient();
  const router   = useRouter();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [sub, setSub]             = useState<SubStatus | null>(null);

  // ── Data fetch ──────────────────────────────────────────────────────────────
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn:  () => fetchDashboard(supabase, router),
    staleTime: 60_000,
  });

  // ── Side effects ────────────────────────────────────────────────────────────
  useEffect(() => { pingStreak(supabase); }, [supabase]);

  const loadExtras = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const base    = process.env.NEXT_PUBLIC_API_URL;
    const headers = { Authorization: `Bearer ${session.access_token}` };

    // Avatar
    try {
      const r = await fetch(`${base}/api/avatar/me`, { headers });
      if (r.ok) {
        const j = await r.json();
        if (j.avatar_url) setAvatarUrl(j.avatar_url);
      }
    } catch {}

    // Subscription
    try {
      const r = await fetch(`${base}/api/payments/subscription/status`, { headers });
      if (r.ok) {
        const j = await r.json();
        setSub({
          is_paid:         j.is_paid === true,
          is_trial:        j.is_trial === true,
          effective_plan:  j.effective_plan ?? j.plan ?? "free",
          expires_at:      j.expires_at ?? null,
          trial_days_left: j.trial_days_left,
        });
      }
    } catch {}
  }, [supabase]);

  useEffect(() => { loadExtras(); }, [loadExtras]);

  // ── Derived values ──────────────────────────────────────────────────────────
  const tier      = getTier(sub);
  const courses   = data?.profile.courses ?? [];
  const questions = data?.recent_questions ?? [];
  const stats     = data?.stats ?? { questions_in_courses: 0, my_uploads: 0 };
  const streak    = data?.profile.streak ?? 0;
  const xp        = data?.profile.xp ?? 0;
  const firstName = (data?.profile.full_name ?? "there").split(" ")[0];

  // ── Render ──────────────────────────────────────────────────────────────────
  if (isLoading) return <PageSkeleton />;
  if (error || !data) return (
    <ErrorState
      message={error instanceof Error ? error.message : "Something went wrong."}
      onRetry={() => refetch()}
    />
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--sp-bg)" }}>
      <style>{`
        @keyframes sp-fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        .sp-a1 { animation: sp-fadeUp 0.35s ease both 0.04s; }
        .sp-a2 { animation: sp-fadeUp 0.35s ease both 0.08s; }
        .sp-a3 { animation: sp-fadeUp 0.35s ease both 0.13s; }
        .sp-a4 { animation: sp-fadeUp 0.35s ease both 0.18s; }
        .sp-a5 { animation: sp-fadeUp 0.35s ease both 0.23s; }
        .sp-a6 { animation: sp-fadeUp 0.35s ease both 0.28s; }
        .no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      <div className="mx-auto max-w-7xl px-4 py-6 lg:px-6 lg:py-8">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-4 lg:items-start">

          {/* ══ LEFT RAIL ══════════════════════════════════════════════════ */}
          <aside className="space-y-4 sp-a1">
            <ProfileCard
              profile={data.profile}
              avatarUrl={avatarUrl}
              xp={xp}
              firstName={firstName}
            />
            <StreakSection streak={streak} />
            <div className="space-y-2">
              <p className="px-1 text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "var(--sp-text-3)" }}>Quick actions</p>
              <QuickAction href="/dashboard/upload"  icon={<Upload className="h-4 w-4"/>}       label="Upload paper"    sub="Earn 50 XP per upload"   color="#6366F1" />
              <QuickAction href="/dashboard/courses" icon={<BookOpen className="h-4 w-4"/>}      label="Browse courses"  sub="Find past questions"      color="#0EA5E9" />
              <QuickAction href="/study"             icon={<Sparkles className="h-4 w-4"/>}      label="SparkL Cram"     sub="AI study assistant"       color="#8B5CF6" />
              <QuickAction href="/dashboard/profile" icon={<GraduationCap className="h-4 w-4"/>} label="My profile"      sub="Account & settings"       color="#10B981" />
            </div>
          </aside>

          {/* ══ MAIN COLUMN ═════════════════════════════════════════════════ */}
          <main className="space-y-5 lg:col-span-2 min-w-0">

            {/* Greeting */}
            <div className="sp-a1">
              <GreetingCard firstName={firstName} profile={data.profile} tier={tier} />
            </div>

            {/* Stats row */}
            <div className="sp-a2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard
                icon={<BookOpen className="h-4 w-4" />}
                label="My courses"
                value={courses.length}
                accent="#6366F1"
              />
              <StatCard
                icon={<FileText className="h-4 w-4" />}
                label="Past papers"
                value={stats.questions_in_courses}
                accent="#8B5CF6"
              />
              <StatCard
                icon={<Trophy className="h-4 w-4" />}
                label="Uploads"
                value={stats.my_uploads}
                accent="#10B981"
                delta={stats.my_uploads > 0 ? `${stats.my_uploads}` : undefined}
              />
              <PlanTile tier={tier} />
            </div>

            {/* Today's focus */}
            {courses.length > 0 && (
              <div className="sp-a3">
                <TodayFocus courses={courses} />
              </div>
            )}

            {/* Courses */}
            <section className="sp-a4">
              <CoursesGrid courses={courses} />
            </section>

            {/* Practice banner */}
            {courses.length > 0 && (
              <div className="sp-a4">
                <PracticeBanner />
              </div>
            )}

            {/* Recent uploads */}
            <section className="sp-a5">
              <RecentUploads
                questions={questions}
                departmentName={data.profile.department?.name}
              />
            </section>
          </main>

          {/* ══ RIGHT RAIL ══════════════════════════════════════════════════ */}
          <aside className="space-y-4 sp-a6">
            {tier.isPaid ? <TierCard tier={tier} /> : <UpgradeCard tier={tier} />}
            {stats.my_uploads === 0 && <UploadNudge />}
            <CramCard />
            <StudyTip />
          </aside>

        </div>
      </div>
    </div>
  );
}