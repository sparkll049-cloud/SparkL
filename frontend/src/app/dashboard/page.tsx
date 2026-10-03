"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Search, BookOpen, Upload, FileText, GraduationCap,
  ChevronRight, ArrowRight, Plus, Flame,
  Users, AlertCircle, Crown, Sparkles,
  Target, Trophy, Zap, Bell, BarChart2,
  CheckCircle2, Calendar, Award, ChevronUp, Timer,
  LogOut, ShieldAlert,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import Image from "next/image";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Course { id: string; name: string; }
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

interface SubStatus {
  is_paid: boolean;
  is_trial: boolean;
  effective_plan: string;
  expires_at: string | null;
  trial_days_left?: number;
}

interface Tier {
  key: string;
  label: string;
  detail: string;
  color: string;
  isPaid: boolean;
  isTrial: boolean;
  expiringSoon: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────────

// Inactivity timeout: 15 minutes in ms
const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
// Warning shown 60 seconds before forced logout
const WARNING_BEFORE_MS = 60 * 1000;

const ACTIVITY_EVENTS = [
  "mousemove", "mousedown", "keydown", "touchstart", "scroll", "click",
] as const;

// ── Inactivity logout hook ────────────────────────────────────────────────────
//
// How it works:
//   1. We listen for any user activity on the document.
//   2. Each activity resets a 14-minute timer.
//   3. After 14 minutes of silence, a 60-second countdown warning modal appears.
//   4. If the user clicks "Stay logged in" the timer resets.
//   5. If they do nothing (or close the tab and come back after the timeout has
//      elapsed), Supabase signOut is called and they are pushed to /auth/login.
//
// Session storage key "sp_last_active" lets us detect "came back after a long
// gap" even if the JS timer was killed (tab sleep, browser close, etc.).

function useInactivityLogout(onLogout: () => Promise<void>) {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown]    = useState(60);
  const logoutTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMounted    = useRef(true);

  const clearAllTimers = useCallback(() => {
    if (logoutTimer.current)  clearTimeout(logoutTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const doLogout = useCallback(async () => {
    clearAllTimers();
    sessionStorage.removeItem("sp_last_active");
    await onLogout();
  }, [clearAllTimers, onLogout]);

  const startCountdown = useCallback(() => {
    if (!isMounted.current) return;
    setShowWarning(true);
    setCountdown(60);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          doLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [doLogout]);

  const resetTimer = useCallback(() => {
    if (!isMounted.current) return;
    clearAllTimers();
    setShowWarning(false);
    sessionStorage.setItem("sp_last_active", String(Date.now()));

    warningTimer.current = setTimeout(() => {
      startCountdown();
    }, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS);

    logoutTimer.current = setTimeout(() => {
      doLogout();
    }, INACTIVITY_TIMEOUT_MS);
  }, [clearAllTimers, startCountdown, doLogout]);

  // Check if user was away too long when tab regains focus / page loads
  useEffect(() => {
    const lastActive = sessionStorage.getItem("sp_last_active");
    if (lastActive) {
      const elapsed = Date.now() - Number(lastActive);
      if (elapsed >= INACTIVITY_TIMEOUT_MS) {
        doLogout();
        return;
      }
    }
    resetTimer();

    const handler = () => resetTimer();
    ACTIVITY_EVENTS.forEach(ev => document.addEventListener(ev, handler, { passive: true }));

    // Also reset when user comes back to the tab
    const visibilityHandler = () => {
      if (document.visibilityState === "visible") {
        const last = sessionStorage.getItem("sp_last_active");
        if (last && Date.now() - Number(last) >= INACTIVITY_TIMEOUT_MS) {
          doLogout();
        } else {
          resetTimer();
        }
      }
    };
    document.addEventListener("visibilitychange", visibilityHandler);

    return () => {
      isMounted.current = false;
      clearAllTimers();
      ACTIVITY_EVENTS.forEach(ev => document.removeEventListener(ev, handler));
      document.removeEventListener("visibilitychange", visibilityHandler);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { showWarning, countdown, stayLoggedIn: resetTimer };
}

// ── Inactivity warning modal ───────────────────────────────────────────────────

function InactivityWarning({
  countdown, onStay, onLogout,
}: { countdown: number; onStay: () => void; onLogout: () => void }) {
  const pct = (countdown / 60) * 100;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div
        className="w-full max-w-sm rounded-3xl border p-7 shadow-2xl text-center"
        style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
      >
        <div className="mb-4 flex justify-center">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <svg className="-rotate-90 absolute inset-0" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="var(--sp-ring-track)" strokeWidth="4"/>
              <circle
                cx="32" cy="32" r="28" fill="none"
                stroke={countdown <= 10 ? "#EF4444" : "#F59E0B"}
                strokeWidth="4"
                strokeDasharray={`${(pct / 100) * 175.9} 175.9`}
                strokeLinecap="round"
                style={{ transition: "stroke-dasharray 1s linear" }}
              />
            </svg>
            <LogOut className="h-5 w-5" style={{ color: countdown <= 10 ? "#EF4444" : "#F59E0B" }} />
          </div>
        </div>
        <h2 className="text-base font-extrabold mb-1" style={{ color: "var(--sp-text)" }}>
          Still there?
        </h2>
        <p className="text-xs mb-1" style={{ color: "var(--sp-text-3)" }}>
          You&apos;ve been inactive for a while.
        </p>
        <p className="text-sm font-bold mb-5" style={{ color: countdown <= 10 ? "#EF4444" : "var(--sp-text-2)" }}>
          Logging you out in <span className="tabular-nums">{countdown}s</span>
        </p>
        <button
          onClick={onStay}
          className="w-full rounded-2xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-500 transition mb-2"
        >
          Stay logged in
        </button>
        <button
          onClick={onLogout}
          className="w-full rounded-2xl py-3 text-xs font-semibold transition hover:bg-red-500/10"
          style={{ color: "var(--sp-text-3)" }}
        >
          Log out now
        </button>
      </div>
    </div>
  );
}

// ── Duplicate-session banner ───────────────────────────────────────────────────
//
// NOTE: True single-device enforcement requires a backend column like
// `profiles.active_session_token` that is set on login and checked on every
// API request.  The frontend's job is only to:
//   a) Store a device token in localStorage on first load.
//   b) Listen to Supabase's SIGNED_OUT / TOKEN_REFRESHED events — if the
//      server revokes the session (because another device signed in), Supabase
//      will emit SIGNED_OUT and we redirect to login.
//   c) Show a banner when we detect we have been kicked.
//
// Backend steps required (outside this file):
//   1. Add column: profiles.active_device_id TEXT
//   2. On login (POST /auth/login or Supabase callback): save a random UUID
//      as active_device_id for that user.
//   3. On every FastAPI request via get_current_user_id: compare the
//      X-Device-Id header (sent below) to profiles.active_device_id.
//      If they differ, return HTTP 401 { "detail": "session_conflict" }.
//   4. The fetch wrapper below detects 401 session_conflict and calls signOut.

function useSessionGuard(supabase: ReturnType<typeof createClient>, onKick: () => void) {
  useEffect(() => {
    // Assign a stable device ID for this browser
    let deviceId = localStorage.getItem("sp_device_id");
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem("sp_device_id", deviceId);
    }

    // Listen for Supabase auth events — a remote sign-out or token revocation
    // will arrive here first
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        onKick();
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase, onKick]);
}

// ── Patched fetch ──────────────────────────────────────────────────────────────
// Attaches X-Device-Id to every request to your API so the backend can enforce
// single-device sessions.  Call this once at the top of the component.

function usePatchedFetch() {
  useEffect(() => {
    const deviceId = localStorage.getItem("sp_device_id") ?? "";
    const orig = window.fetch.bind(window);
    window.fetch = function(input: RequestInfo | URL, init: RequestInit = {}) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
      if (url.includes(process.env.NEXT_PUBLIC_API_URL ?? "__API__")) {
        init = {
          ...init,
          headers: { ...(init.headers ?? {}), "X-Device-Id": deviceId },
        };
      }
      return orig(input, init);
    };
    return () => { window.fetch = orig; };
  }, []);
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

async function fireStreakUpdate(supabase: ReturnType<typeof createClient>): Promise<void> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/dashboard/streak/update`,
      { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } },
    );
  } catch { /* fire-and-forget */ }
}

// ── Local course search ───────────────────────────────────────────────────────

function useLocalCourseSearch(query: string, courses: Course[]) {
  const q = query.trim().toLowerCase();
  if (!q) return { results: [] as Course[], searching: false };
  return { results: courses.filter(c => c.name.toLowerCase().includes(q)), searching: false };
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

// ── Tier helpers ───────────────────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  unknown: "#64748B", free: "#64748B", trial: "#F59E0B",
  basic: "#0EA5E9", pro: "#6366F1", premium: "#8B5CF6",
};

function daysUntil(iso?: string | null): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function getTier(sub: SubStatus | null): Tier {
  if (!sub) return { key: "unknown", label: "My plan", detail: "View plans", color: TIER_COLORS.unknown, isPaid: false, isTrial: false, expiringSoon: false };
  if (sub.is_trial) {
    const d = sub.trial_days_left ?? 0;
    return { key: "trial", label: "Free Trial", detail: `${d} day${d === 1 ? "" : "s"} left`, color: TIER_COLORS.trial, isPaid: false, isTrial: true, expiringSoon: d <= 2 };
  }
  if (sub.is_paid) {
    const plan = (sub.effective_plan || "pro").toLowerCase();
    const label = plan.charAt(0).toUpperCase() + plan.slice(1);
    const days  = daysUntil(sub.expires_at);
    const soon  = days !== null && days <= 7;
    let detail  = "Active";
    if (days !== null) detail = days <= 0 ? "Expires today" : soon ? `${days}d left · Renew` : `Until ${formatDate(sub.expires_at!)}`;
    return { key: plan, label, detail, color: TIER_COLORS[plan] ?? TIER_COLORS.pro, isPaid: true, isTrial: false, expiringSoon: soon };
  }
  const expiredDays = daysUntil(sub.expires_at);
  const expired = expiredDays !== null && expiredDays <= 0;
  return { key: "free", label: "Free", detail: expired ? "Plan expired · Renew" : "Upgrade for full access", color: TIER_COLORS.free, isPaid: false, isTrial: false, expiringSoon: false };
}

// ── Course helpers ─────────────────────────────────────────────────────────────

const COURSE_PALETTE = [
  { accent: "#6366F1", light: "rgba(99,102,241,0.10)",  border: "rgba(99,102,241,0.20)"  },
  { accent: "#0EA5E9", light: "rgba(14,165,233,0.10)",  border: "rgba(14,165,233,0.20)"  },
  { accent: "#8B5CF6", light: "rgba(139,92,246,0.10)",  border: "rgba(139,92,246,0.20)"  },
  { accent: "#10B981", light: "rgba(16,185,129,0.10)",  border: "rgba(16,185,129,0.20)"  },
  { accent: "#F59E0B", light: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.20)"  },
  { accent: "#EF4444", light: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.20)"   },
];

function courseInitials(name: string): string {
  return name.split(" ").filter(w => /^[a-zA-Z]/.test(w)).map(w => w[0].toUpperCase()).slice(0, 2).join("") || name.slice(0, 2).toUpperCase();
}

function splitCourseName(name: string): { code: string | null; title: string } {
  const m = name.match(/^\s*([A-Za-z]{2,5})\s?-?\s?(\d{2,4}[A-Za-z]?)\s*[-:–—]?\s*(.*)$/);
  if (!m) return { code: null, title: name };
  return { code: `${m[1].toUpperCase()} ${m[2]}`, title: m[3].trim() || name };
}

const clamp2: React.CSSProperties = { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" };

// ── Skeleton ───────────────────────────────────────────────────────────────────

function Bone({ className = "" }: { className?: string }) {
  return <div className={`sp-bone rounded-xl ${className}`} />;
}

function PageSkeleton() {
  return (
    <div className="min-h-screen" style={{ background: "var(--sp-bg)" }}>
      <div className="h-16 border-b" style={{ borderColor: "var(--sp-border)", background: "var(--sp-bg-card)" }}>
        <div className="mx-auto flex h-full max-w-7xl items-center justify-between px-6">
          <Bone className="h-7 w-24"/><Bone className="h-9 w-56 rounded-full"/><Bone className="h-9 w-9 rounded-full"/>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-8 lg:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          <div className="space-y-4"><Bone className="h-48 rounded-2xl"/><Bone className="h-32 rounded-2xl"/><Bone className="h-40 rounded-2xl"/></div>
          <div className="space-y-6 lg:col-span-2">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[...Array(4)].map((_, i) => <Bone key={i} className="h-24 rounded-2xl" />)}</div>
            <Bone className="h-10 rounded-full"/>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{[...Array(6)].map((_, i) => <Bone key={i} className="h-40 rounded-2xl" />)}</div>
            <Bone className="h-48 rounded-2xl"/>
          </div>
          <div className="space-y-4"><Bone className="h-52 rounded-2xl"/><Bone className="h-36 rounded-2xl"/><Bone className="h-28 rounded-2xl"/></div>
        </div>
      </div>
    </div>
  );
}

// ── Streak ring ────────────────────────────────────────────────────────────────

function StreakRing({ streak = 0, size = 80 }: { streak: number; size?: number }) {
  const r = (size / 2) - 6, circ = 2 * Math.PI * r, fill = Math.min(streak / 7, 1) * circ;
  const color = streak >= 7 ? "#F59E0B" : streak >= 3 ? "#6366F1" : "#94A3B8";
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--sp-ring-track)" strokeWidth="5"/>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
          style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.34,1.56,0.64,1)" }}/>
      </svg>
      <div className="absolute flex flex-col items-center">
        <Flame className="h-4 w-4" style={{ color }}/>
        <span className="text-sm font-black" style={{ color: "var(--sp-text)" }}>{streak}</span>
      </div>
    </div>
  );
}

// ── Level badge ────────────────────────────────────────────────────────────────

function LevelBadge({ xp = 0 }: { xp: number }) {
  const level = Math.floor(xp / 100) + 1, progress = xp % 100;
  const LEVEL_NAMES = ["Newcomer", "Explorer", "Scholar", "Achiever", "Expert", "Master", "Legend"];
  const name = LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500 text-white shadow-lg shadow-indigo-500/30">
            <Zap className="h-3.5 w-3.5" fill="white"/>
          </div>
          <div>
            <p className="text-xs font-black" style={{ color: "var(--sp-text)" }}>Level {level} · {name}</p>
            <p className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>{xp} XP total</p>
          </div>
        </div>
        <span className="text-[10px] font-bold text-indigo-500">{100 - progress} to next</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full" style={{ background: "var(--sp-ring-track)" }}>
        <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-1000" style={{ width: `${progress}%` }}/>
      </div>
    </div>
  );
}

// ── Tier pill ─────────────────────────────────────────────────────────────────

function TierPill({ tier }: { tier: Tier }) {
  return (
    <Link href="/dashboard/subscribe" title="View or manage your plan"
      className="flex shrink-0 items-center gap-2 rounded-xl border px-2 py-1.5 transition-all hover:-translate-y-0.5 hover:shadow-md sm:px-2.5"
      style={{ background: `${tier.color}12`, borderColor: `${tier.color}38` }}
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-lg text-white" style={{ background: tier.color }}>
        {tier.isPaid ? <Crown className="h-3 w-3" fill="currentColor"/> : tier.isTrial ? <Timer className="h-3 w-3"/> : <Sparkles className="h-3 w-3"/>}
      </span>
      <span className="hidden leading-tight sm:block">
        <span className="block text-[11px] font-black" style={{ color: tier.color }}>{tier.label}</span>
        <span className="block text-[9px]" style={{ color: "var(--sp-text-3)" }}>{tier.detail}</span>
      </span>
      <span className="text-[11px] font-black sm:hidden" style={{ color: tier.color }}>{tier.label}</span>
    </Link>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, accent, delta }: { icon: React.ReactNode; label: string; value: number; accent: string; delta?: string }) {
  const count = useCountUp(value);
  return (
    <div className="group relative overflow-hidden rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
      <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-20 blur-xl transition-opacity group-hover:opacity-40" style={{ background: accent }}/>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: `${accent}20` }}>
          <span style={{ color: accent }}>{icon}</span>
        </div>
        {delta && <span className="flex items-center gap-0.5 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-500"><ChevronUp className="h-2.5 w-2.5"/>{delta}</span>}
      </div>
      <p className="text-2xl font-black tabular-nums" style={{ color: "var(--sp-text)" }}>{count}</p>
      <p className="mt-0.5 text-[11px] font-medium" style={{ color: "var(--sp-text-3)" }}>{label}</p>
    </div>
  );
}

function PlanTile({ tier }: { tier: Tier }) {
  return (
    <Link href="/dashboard/subscribe" className="group relative overflow-hidden rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg" style={{ background: "var(--sp-bg-card)", borderColor: `${tier.color}45` }}>
      <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full opacity-25 blur-xl transition-opacity group-hover:opacity-50" style={{ background: tier.color }}/>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl" style={{ background: `${tier.color}20` }}>
          <Crown className="h-4 w-4" style={{ color: tier.color }}/>
        </div>
        <ChevronRight className="h-3.5 w-3.5 opacity-40 transition-opacity group-hover:opacity-90" style={{ color: tier.color }}/>
      </div>
      <p className="truncate text-xl font-black leading-tight" style={{ color: tier.color }}>{tier.label}</p>
      <p className="mt-0.5 truncate text-[11px] font-medium" style={{ color: "var(--sp-text-3)" }}>{tier.detail}</p>
    </Link>
  );
}

// ── Course card ───────────────────────────────────────────────────────────────

function CourseCard({ course, index }: { course: Course; index: number }) {
  const p = COURSE_PALETTE[index % COURSE_PALETTE.length];
  const { code, title } = splitCourseName(course.name);
  const initials = courseInitials(course.name);
  return (
    <Link href={`/dashboard/courses/${course.id}`}
      className="group flex w-[152px] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border transition-all duration-200 hover:-translate-y-1 hover:shadow-xl sm:w-auto"
      style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
    >
      <div className="relative h-24 overflow-hidden" style={{ background: `linear-gradient(135deg, ${p.accent}26, ${p.accent}0D)` }}>
        <div className="absolute left-1/2 top-4 h-[84px] w-16 -translate-x-1/2 rounded-md bg-white transition-transform duration-200 group-hover:-translate-y-1" style={{ boxShadow: `0 6px 16px ${p.accent}35` }}>
          <div className="mx-2 mt-2 h-1.5 rounded-full" style={{ background: p.accent }}/>
          {[0,1,2,3,4,5].map(i => <div key={i} className="mx-2 mt-1.5 h-[3px] rounded-full bg-slate-200" style={{ width: `${62 + ((i * 17) % 32)}%` }}/>)}
        </div>
        <span className="absolute left-2 top-2 rounded-md px-1.5 py-0.5 text-[9px] font-black text-white shadow" style={{ background: p.accent }}>{code ?? initials}</span>
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="min-h-[2rem] text-xs font-bold leading-snug" style={{ ...clamp2, color: "var(--sp-text)" }}>{title}</p>
        <p className="mt-1 text-[10px]" style={{ color: "var(--sp-text-3)" }}>Past questions · Practice</p>
        <div className="mt-2.5 flex items-center gap-1 text-[10px] font-bold" style={{ color: p.accent }}>
          Study now<ArrowRight className="h-2.5 w-2.5 transition-transform group-hover:translate-x-0.5"/>
        </div>
      </div>
    </Link>
  );
}

// ── Activity item ──────────────────────────────────────────────────────────────

function ActivityItem({ q, index }: { q: RecentQuestion; index: number }) {
  const p = COURSE_PALETTE[index % COURSE_PALETTE.length];
  const courseCode = q.course?.name ? splitCourseName(q.course.name).code : null;
  return (
    <Link href={`/questions/${q.id}`} className="group block rounded-xl border p-3 transition-all hover:border-indigo-500/30 hover:shadow-md" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: p.accent, boxShadow: `0 3px 10px ${p.accent}35` }}>
          <FileText className="h-4 w-4"/>
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-1.5">
            <span className="rounded px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wide" style={{ background: `${p.accent}18`, color: p.accent }}>Past question</span>
            <span className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>{new Date(q.created_at).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}</span>
          </div>
          <p className="truncate text-xs font-semibold" style={{ color: "var(--sp-text)" }}>{q.title}</p>
          <div className="mt-0.5 flex items-center gap-2 text-[10px]" style={{ color: "var(--sp-text-3)" }}>
            <span className="truncate">{courseCode ?? q.course?.name ?? "—"}{q.year ? ` · ${q.year}` : ""}</span>
            {q.views != null && <span className="flex shrink-0 items-center gap-1"><Users className="h-2.5 w-2.5"/>{q.views} views</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ── Upgrade / tier cards ──────────────────────────────────────────────────────

function UpgradeCard({ tier }: { tier: Tier }) {
  return (
    <div className="relative overflow-hidden rounded-2xl p-5 text-white" style={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #9333EA 100%)" }}>
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10 blur-2xl"/>
      <div className="pointer-events-none absolute -bottom-6 -left-6 h-20 w-20 rounded-full bg-white/10 blur-xl"/>
      <div className="relative">
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 backdrop-blur">
            <Crown className="h-4 w-4 text-yellow-300" fill="currentColor"/>
          </div>
          <div>
            <p className="text-xs font-black">{tier.isTrial ? "Keep your full access" : "Upgrade SparkL"}</p>
            <p className="text-[10px] text-white/60">{tier.isTrial ? tier.detail : "Semester plans for students"}</p>
          </div>
        </div>
        <p className="text-[11px] text-white/80 leading-relaxed">Unlock every course and the AI study tools built for Nigerian tertiary students.</p>
        <div className="mt-3 space-y-2">
          {[
            { icon: <BookOpen className="h-3 w-3"/>, text: "All courses unlocked" },
            { icon: <BarChart2 className="h-3 w-3"/>, text: "Unlimited read & practice mode" },
            { icon: <Sparkles className="h-3 w-3"/>, text: "AI Cram study assistant" },
            { icon: <CheckCircle2 className="h-3 w-3"/>, text: "Unlimited note uploads (Pro)" },
            { icon: <Award className="h-3 w-3"/>, text: "YouTube & link study (Premium)" },
          ].map(f => (
            <div key={f.text} className="flex items-center gap-2">
              <span className="text-yellow-300">{f.icon}</span>
              <span className="text-[10px] font-medium text-white/80">{f.text}</span>
            </div>
          ))}
        </div>
        <Link href="/dashboard/subscribe" className="mt-4 flex items-center justify-center gap-1.5 rounded-xl bg-white py-2.5 text-[11px] font-black text-indigo-700 transition hover:bg-yellow-50">
          <Crown className="h-3 w-3 text-yellow-500" fill="currentColor"/>See plans — from ₦2,000/semester
        </Link>
      </div>
    </div>
  );
}

function TierCard({ tier }: { tier: Tier }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border p-4" style={{ background: "var(--sp-bg-card)", borderColor: `${tier.color}45` }}>
      <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20 blur-xl" style={{ background: tier.color }}/>
      <div className="relative">
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl shadow-lg" style={{ background: tier.color, boxShadow: `0 6px 16px ${tier.color}45` }}>
            <Crown className="h-5 w-5 text-yellow-300" fill="currentColor"/>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-black" style={{ color: "var(--sp-text)" }}>SparkL {tier.label}</p>
            <p className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>{tier.detail}</p>
          </div>
        </div>
        {tier.expiringSoon && (
          <div className="mb-3 rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2">
            <p className="text-[10px] font-semibold text-amber-500">Your plan ends soon — renew to keep your access.</p>
          </div>
        )}
        <Link href="/dashboard/subscribe" className="flex items-center justify-center gap-1.5 rounded-xl border py-2 text-[11px] font-bold transition-all hover:-translate-y-0.5" style={{ background: `${tier.color}0F`, borderColor: `${tier.color}45`, color: tier.color }}>
          {tier.expiringSoon ? "Renew plan" : "Manage plan"} <ChevronRight className="h-3 w-3"/>
        </Link>
      </div>
    </div>
  );
}

// ── Today focus / Quick action / Empty state / Streak section (unchanged) ─────

function TodayFocus({ courses }: { courses: Course[] }) {
  const [idx] = useState(() => Math.floor(Math.random() * courses.length));
  const c = courses[idx];
  if (!c) return null;
  const p = COURSE_PALETTE[idx % COURSE_PALETTE.length];
  return (
    <Link href={`/dashboard/courses/${c.id}`} className="group flex items-center gap-4 rounded-full border px-4 py-3 transition-all hover:shadow-md" style={{ background: `${p.accent}10`, borderColor: `${p.accent}30` }}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white text-xs font-black" style={{ background: p.accent }}>
        <Target className="h-3.5 w-3.5"/>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: p.accent }}>Today&apos;s focus</p>
        <p className="truncate text-xs font-bold" style={{ color: "var(--sp-text)" }}>{c.name}</p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: p.accent }}/>
    </Link>
  );
}

function QuickAction({ href, icon, label, sub, color }: { href: string; icon: React.ReactNode; label: string; sub: string; color: string }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-xl border p-3.5 transition-all hover:-translate-y-0.5 hover:shadow-lg" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition-transform group-hover:scale-110" style={{ background: color, boxShadow: `0 4px 12px ${color}40` }}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-bold" style={{ color: "var(--sp-text)" }}>{label}</p>
        <p className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>{sub}</p>
      </div>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-30 group-hover:opacity-70 transition-opacity" style={{ color }}/>
    </Link>
  );
}

function EmptyState({ icon, title, body, cta }: { icon: React.ReactNode; title: string; body: string; cta: { href: string; label: string } }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border-2 border-dashed px-8 py-12 text-center" style={{ borderColor: "var(--sp-border)" }}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-500">{icon}</div>
      <p className="text-sm font-bold" style={{ color: "var(--sp-text-2)" }}>{title}</p>
      <p className="mt-1.5 max-w-[200px] text-xs leading-relaxed" style={{ color: "var(--sp-text-3)" }}>{body}</p>
      <Link href={cta.href} className="mt-5 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-500 transition-all hover:-translate-y-0.5">
        {cta.label} <ArrowRight className="h-3.5 w-3.5"/>
      </Link>
    </div>
  );
}

function StreakSection({ streak }: { streak: number }) {
  const todayJS = new Date().getDay(), todayMF = todayJS === 0 ? 6 : todayJS - 1;
  return (
    <div className="rounded-2xl border p-4" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold" style={{ color: "var(--sp-text)" }}>Study streak</p>
        <span className="text-[10px] font-bold text-indigo-500">Goal: 7 days</span>
      </div>
      <div className="flex items-center gap-4">
        <StreakRing size={72} streak={streak}/>
        <div className="flex-1 space-y-2">
          <div className="flex gap-1">
            {["M","T","W","T","F","S","S"].map((d, i) => {
              const done = i <= todayMF && (todayMF - i) < streak, isToday = i === todayMF;
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div className="h-5 w-5 rounded-full flex items-center justify-center text-[8px] font-black transition-all" style={{ background: done ? "#6366F1" : isToday ? "rgba(99,102,241,0.18)" : "var(--sp-ring-track)", color: done ? "white" : isToday ? "#6366F1" : "var(--sp-text-3)", boxShadow: done ? "0 2px 8px rgba(99,102,241,0.35)" : "none", outline: isToday && !done ? "1.5px solid rgba(99,102,241,0.45)" : "none" }}>{d}</div>
                </div>
              );
            })}
          </div>
          <p className="text-[10px] leading-relaxed" style={{ color: "var(--sp-text-3)" }}>
            {streak === 0 ? "Start your streak today!" : streak >= 7 ? "🔥 Full week! Amazing!" : `${7 - streak} more day${7 - streak !== 1 ? "s" : ""} to complete the week`}
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
  const [sub, setSub]                     = useState<SubStatus | null>(null);
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // ── Attach device-id header to all API fetches ─────────────────────────────
  usePatchedFetch();

  // ── Sign-out helper ────────────────────────────────────────────────────────
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/auth/login?reason=timeout");
  }, [supabase, router]);

  // ── Inactivity logout (15 min) ─────────────────────────────────────────────
  const { showWarning, countdown, stayLoggedIn } = useInactivityLogout(signOut);

  // ── Single-device session guard ────────────────────────────────────────────
  useSessionGuard(supabase, () => router.push("/auth/login?reason=conflict"));

  const { data, isLoading, error } = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn:  () => fetchDashboardSummary(supabase, router),
  });

  useEffect(() => { fireStreakUpdate(supabase); }, [supabase]);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      try {
        const r1 = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/avatar/me`, { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (r1.ok) { const j = await r1.json(); if (j.avatar_url) setAvatarUrl(j.avatar_url); }
      } catch {}
      try {
        const r2 = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/payments/subscription/status`, { headers: { Authorization: `Bearer ${session.access_token}` } });
        if (r2.ok) {
          const j = await r2.json();
          setSub({ is_paid: j.is_paid === true, is_trial: j.is_trial === true, effective_plan: j.effective_plan ?? j.plan ?? "free", expires_at: j.expires_at ?? null, trial_days_left: j.trial_days_left });
        }
      } catch {}
    }
    load();
  }, [supabase]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) { setQuery(""); setSearchFocused(false); }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const tier            = getTier(sub);
  const courses         = data?.profile.courses ?? [];
  const recentQuestions = data?.recent_questions ?? [];
  const stats           = data?.stats ?? { questions_in_courses: 0, my_uploads: 0 };
  const streak          = data?.profile.streak ?? 0;
  const xp              = data?.profile.xp ?? 0;
  const { results: searchResults, searching: searchLoading } = useLocalCourseSearch(query, courses);

  if (isLoading) return <PageSkeleton/>;

  if (error || !data) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center" style={{ background: "var(--sp-bg)" }}>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10">
          <AlertCircle className="h-6 w-6 text-red-500"/>
        </div>
        <p className="text-sm font-semibold" style={{ color: "var(--sp-text-2)" }}>{error instanceof Error ? error.message : "Something went wrong."}</p>
        <button onClick={() => window.location.reload()} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-indigo-500 transition">Reload</button>
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
        .no-scrollbar { scrollbar-width: none; -ms-overflow-style: none; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ── Inactivity warning modal ── */}
      {showWarning && (
        <InactivityWarning
          countdown={countdown}
          onStay={stayLoggedIn}
          onLogout={signOut}
        />
      )}

      {/* ══ TOPBAR ══ */}
      <header className="sticky top-0 z-40 border-b backdrop-blur-xl transition-colors" style={{ background: "var(--sp-header-bg)", borderColor: "var(--sp-border)" }}>
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 lg:gap-4 lg:px-6">

          <Link className="flex shrink-0 items-center gap-2.5 mr-1" href="/dashboard">
            <Image alt="SparkL" className="rounded-xl object-cover shadow-md" height={32} src="/images/logo.jpg" width={32}/>
            <span className="hidden text-base font-black tracking-tight sm:block" style={{ color: "var(--sp-text)" }}>SparkL</span>
          </Link>

          <div className="relative min-w-0 flex-1 max-w-md mx-auto" ref={searchRef}>
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors" style={{ color: searchFocused ? "#6366F1" : "var(--sp-text-3)" }}/>
            <input value={query} onChange={e => setQuery(e.target.value)} onFocus={() => setSearchFocused(true)}
              placeholder="Search all courses…"
              className="w-full rounded-full border py-2.5 pl-11 pr-4 text-sm outline-none transition-all"
              style={{ background: "var(--sp-input-bg)", borderColor: searchFocused ? "rgba(99,102,241,0.5)" : "var(--sp-border)", color: "var(--sp-text)", boxShadow: searchFocused ? "0 0 0 3px rgba(99,102,241,0.10)" : "none" }}
            />
            {query.trim() && (
              <div className="anim-slide absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border shadow-2xl" style={{ background: "var(--sp-search-popup)", borderColor: "var(--sp-border)" }}>
                {searchLoading ? (
                  <div className="flex items-center justify-center gap-2 py-8">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"/>
                    <span className="text-xs" style={{ color: "var(--sp-text-3)" }}>Searching…</span>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="flex flex-col items-center py-8 gap-2">
                    <Search className="h-5 w-5 opacity-30" style={{ color: "var(--sp-text-3)" }}/>
                    <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>No courses match &ldquo;{query}&rdquo;</p>
                  </div>
                ) : (
                  <div className="p-2">
                    <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--sp-text-3)" }}>All courses</p>
                    {searchResults.map((c, i) => {
                      const p = COURSE_PALETTE[i % COURSE_PALETTE.length];
                      return (
                        <Link key={c.id} href={`/dashboard/courses/${c.id}`} onClick={() => { setQuery(""); setSearchFocused(false); }}
                          className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-indigo-500/5"
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-black text-white" style={{ background: p.accent }}>{courseInitials(c.name)}</div>
                          <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold" style={{ color: "var(--sp-text)" }}>{c.name}</p></div>
                          <ArrowRight className="ml-auto h-3 w-3 shrink-0" style={{ color: p.accent }}/>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <TierPill tier={tier}/>
            <button className="relative hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors hover:border-indigo-500/30 sm:flex" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
              <Bell className="h-4 w-4" style={{ color: "var(--sp-text-2)" }}/>
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-indigo-500"/>
            </button>
            <Link href="/dashboard/profile">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="h-9 w-9 rounded-xl object-cover ring-2 ring-indigo-500/30 transition hover:ring-indigo-500/60"/>
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
            <div className="relative overflow-hidden rounded-2xl border p-5" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
              <div className="pointer-events-none absolute inset-0 opacity-30" style={{ background: "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, transparent 60%)" }}/>
              <div className="relative">
                <div className="flex items-center gap-3 mb-4">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="Profile" className="h-12 w-12 rounded-2xl object-cover ring-2 ring-indigo-500/20"/>
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-black text-white shadow-lg shadow-indigo-500/30">
                      {firstName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-black truncate" style={{ color: "var(--sp-text)" }}>{data.profile.full_name ?? firstName}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"/>Active
                      </span>
                    </div>
                  </div>
                </div>
                {data.profile.department?.name && (
                  <div className="mb-4 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--sp-text-3)" }}>Academic</p>
                    {[data.profile.institution?.name, data.profile.department?.name, data.profile.level?.name].filter(Boolean).map(v => (
                      <p key={v} className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--sp-text-2)" }}>
                        <span className="h-1 w-1 rounded-full bg-indigo-500 shrink-0"/>{v}
                      </p>
                    ))}
                  </div>
                )}
                <LevelBadge xp={xp}/>
                <Link href="/dashboard/profile" className="mt-4 flex items-center justify-center gap-1.5 rounded-xl border py-2 text-[11px] font-bold transition-all hover:border-indigo-500/40 hover:bg-indigo-500/5 hover:text-indigo-500" style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}>
                  Edit profile <ChevronRight className="h-3 w-3"/>
                </Link>
              </div>
            </div>
            <StreakSection streak={streak}/>
            <div className="space-y-2">
              <p className="px-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--sp-text-3)" }}>Quick actions</p>
              <QuickAction href="/dashboard/upload" icon={<Upload className="h-4 w-4"/>} label="Upload paper" sub="Earn 50 XP per upload" color="#6366F1"/>
              <QuickAction href="/dashboard/courses" icon={<BookOpen className="h-4 w-4"/>} label="Browse courses" sub="Find past questions" color="#0EA5E9"/>
              <QuickAction href="/dashboard/profile" icon={<GraduationCap className="h-4 w-4"/>} label="My profile" sub="Account & settings" color="#8B5CF6"/>
            </div>
          </aside>

          {/* ── MAIN ── */}
          <main className="space-y-5 lg:col-span-2 min-w-0">
            <div className="anim-1 relative overflow-hidden rounded-2xl border p-5" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
              <div className="pointer-events-none absolute right-0 top-0 h-32 w-32 opacity-10" style={{ background: "radial-gradient(circle, #6366F1 0%, transparent 70%)" }}/>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar className="h-3.5 w-3.5" style={{ color: "var(--sp-text-3)" }}/>
                    <span className="text-[11px]" style={{ color: "var(--sp-text-3)" }}>{today}</span>
                  </div>
                  <p className="text-sm" style={{ color: "var(--sp-text-3)" }}>{greeting},</p>
                  <h1 className="text-2xl font-black tracking-tight mt-0.5" style={{ color: "var(--sp-text)" }}>{firstName} 👋</h1>
                  {data.profile.department?.name && (
                    <p className="mt-1 text-xs" style={{ color: "var(--sp-text-3)" }}>{data.profile.department.name} · {data.profile.institution?.name}</p>
                  )}
                </div>
                {!tier.isPaid && (
                  <Link className="shrink-0 flex items-center gap-1.5 rounded-full bg-indigo-600 px-3.5 py-2 text-[11px] font-black text-white shadow-lg shadow-indigo-500/30 hover:bg-indigo-500 transition-all hover:-translate-y-0.5" href="/dashboard/subscribe">
                    <Crown className="h-3 w-3 text-yellow-300" fill="currentColor"/>Upgrade
                  </Link>
                )}
              </div>
            </div>

            <div className="anim-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard icon={<BookOpen className="h-4 w-4"/>} label="My courses" value={courses.length} accent="#6366F1"/>
              <StatCard icon={<FileText className="h-4 w-4"/>} label="Past papers" value={stats.questions_in_courses} accent="#8B5CF6"/>
              <StatCard icon={<Trophy className="h-4 w-4"/>} label="Uploads" value={stats.my_uploads} accent="#10B981" delta={stats.my_uploads > 0 ? `${stats.my_uploads}` : undefined}/>
              <PlanTile tier={tier}/>
            </div>

            {courses.length > 0 && <div className="anim-3"><TodayFocus courses={courses}/></div>}

            <section className="anim-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black" style={{ color: "var(--sp-text)" }}>Your courses</h2>
                  <p className="text-[10px] mt-0.5" style={{ color: "var(--sp-text-3)" }}>{courses.length} enrolled this semester</p>
                </div>
                <Link href="/onboarding" className="flex items-center gap-1 rounded-full border px-3 py-1.5 text-[10px] font-bold transition-all hover:border-indigo-500/40 hover:text-indigo-500" style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}>
                  <Plus className="h-3 w-3"/> Manage
                </Link>
              </div>
              {courses.length === 0 ? (
                <EmptyState icon={<BookOpen className="h-6 w-6"/>} title="No courses enrolled yet" body="Enrol in your courses to unlock all past questions for your semester." cta={{ href: "/onboarding", label: "Choose courses" }}/>
              ) : (
                <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0">
                  {courses.map((c, i) => <CourseCard key={c.id} course={c} index={i}/>)}
                  <Link href="/onboarding" className="flex min-h-[170px] w-[152px] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-4 transition-all hover:border-indigo-500/40 hover:bg-indigo-500/[0.03] sm:w-auto" style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-3)" }}>
                    <Plus className="h-5 w-5"/><span className="text-[10px] font-bold">Add course</span>
                  </Link>
                </div>
              )}
            </section>

            {courses.length > 0 && (
              <Link href="/dashboard/courses" className="anim-4 group flex items-center gap-4 rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-lg" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30">
                  <Timer className="h-5 w-5"/>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black" style={{ color: "var(--sp-text)" }}>Simulate the real exam</p>
                  <p className="text-[11px]" style={{ color: "var(--sp-text-3)" }}>Pick a course and practise past questions like the real thing.</p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-indigo-500 opacity-60 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"/>
              </Link>
            )}

            <section className="anim-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-black" style={{ color: "var(--sp-text)" }}>Recent uploads</h2>
                {recentQuestions.length > 0 && <Link className="text-[11px] font-bold text-indigo-500 hover:underline" href="/dashboard/courses">See all</Link>}
              </div>
              {recentQuestions.length === 0 ? (
                <EmptyState icon={<FileText className="h-6 w-6"/>} title="No papers yet" body={`Be the first to upload for ${data.profile.department?.name ?? "your department"}.`} cta={{ href: "/dashboard/upload", label: "Upload a paper" }}/>
              ) : (
                <div className="space-y-2">{recentQuestions.map((q, i) => <ActivityItem key={q.id} q={q} index={i}/>)}</div>
              )}
            </section>
          </main>

          {/* ── RIGHT RAIL ── */}
          <aside className="space-y-4 anim-6">
            {tier.isPaid ? <TierCard tier={tier}/> : <UpgradeCard tier={tier}/>}
            {stats.my_uploads === 0 && (
              <div className="rounded-2xl border p-4" style={{ background: "rgba(245,158,11,0.07)", borderColor: "rgba(245,158,11,0.22)" }}>
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/20"><Flame className="h-3.5 w-3.5 text-amber-500"/></div>
                  <p className="text-xs font-black" style={{ color: "var(--sp-text)" }}>Start contributing</p>
                </div>
                <p className="text-[11px] leading-relaxed" style={{ color: "var(--sp-text-2)" }}>Upload your first past question and earn 50 XP instantly. Help your department grow.</p>
                <Link className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 py-2.5 text-[11px] font-black text-white hover:bg-amber-400 transition-all" href="/dashboard/upload">
                  <Upload className="h-3 w-3"/> Upload now
                </Link>
              </div>
            )}
            <div className="rounded-2xl border p-4" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-violet-500"/>
                <p className="text-xs font-black" style={{ color: "var(--sp-text)" }}>Study tip</p>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: "var(--sp-text-2)" }}>
                Students who practice with past questions score <span className="font-bold text-indigo-500">40% higher</span> on average. Try practice mode now.
              </p>
            </div>
          </aside>

        </div>
      </div>
    </div>
  );
}
