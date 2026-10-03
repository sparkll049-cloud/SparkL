// app/dashboard/layout.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  LogOut, Menu, X, BookOpen, Upload, GraduationCap,
  Crown, Sparkles, Timer, Flame, Zap, ShieldAlert,
  Home, Bell, Moon, Sun, ChevronRight,
} from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";

// ── QueryClient ────────────────────────────────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { refetchOnWindowFocus: false, staleTime: 5 * 60 * 1000, retry: 1 } },
  });
}
let browserQueryClient: QueryClient | undefined;
function getQueryClient() {
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
const WARNING_BEFORE_MS     = 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove","mousedown","keydown","touchstart","scroll","click"] as const;

// ── Inactivity hook ────────────────────────────────────────────────────────────

function useInactivityLogout(onLogout: () => Promise<void>) {
  const [showWarning, setShowWarning] = useState(false);
  const [countdown, setCountdown]    = useState(60);
  const logoutTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMounted    = useRef(true);

  const clearAll = useCallback(() => {
    if (logoutTimer.current)  clearTimeout(logoutTimer.current);
    if (warningTimer.current) clearTimeout(warningTimer.current);
    if (countdownRef.current) clearInterval(countdownRef.current);
  }, []);

  const doLogout = useCallback(async () => {
    clearAll();
    sessionStorage.removeItem("sp_last_active");
    await onLogout();
  }, [clearAll, onLogout]);

  const startCountdown = useCallback(() => {
    if (!isMounted.current) return;
    setShowWarning(true);
    setCountdown(60);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { if (countdownRef.current) clearInterval(countdownRef.current); doLogout(); return 0; }
        return prev - 1;
      });
    }, 1000);
  }, [doLogout]);

  const resetTimer = useCallback(() => {
    if (!isMounted.current) return;
    clearAll();
    setShowWarning(false);
    sessionStorage.setItem("sp_last_active", String(Date.now()));
    warningTimer.current = setTimeout(startCountdown, INACTIVITY_TIMEOUT_MS - WARNING_BEFORE_MS);
    logoutTimer.current  = setTimeout(doLogout, INACTIVITY_TIMEOUT_MS);
  }, [clearAll, startCountdown, doLogout]);

  useEffect(() => {
    const last = sessionStorage.getItem("sp_last_active");
    if (last && Date.now() - Number(last) >= INACTIVITY_TIMEOUT_MS) { doLogout(); return; }
    resetTimer();
    const h = () => resetTimer();
    ACTIVITY_EVENTS.forEach(ev => document.addEventListener(ev, h, { passive: true }));
    const vis = () => {
      if (document.visibilityState === "visible") {
        const l = sessionStorage.getItem("sp_last_active");
        if (l && Date.now() - Number(l) >= INACTIVITY_TIMEOUT_MS) doLogout(); else resetTimer();
      }
    };
    document.addEventListener("visibilitychange", vis);
    return () => {
      isMounted.current = false;
      clearAll();
      ACTIVITY_EVENTS.forEach(ev => document.removeEventListener(ev, h));
      document.removeEventListener("visibilitychange", vis);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { showWarning, countdown, stayLoggedIn: resetTimer };
}

// ── Session guard ──────────────────────────────────────────────────────────────

function useSessionGuard(supabase: ReturnType<typeof createClient>, onKick: () => void) {
  useEffect(() => {
    if (!localStorage.getItem("sp_device_id"))
      localStorage.setItem("sp_device_id", crypto.randomUUID());
    const { data: { subscription } } = supabase.auth.onAuthStateChange(ev => {
      if (ev === "SIGNED_OUT") onKick();
    });
    return () => subscription.unsubscribe();
  }, [supabase, onKick]);
}

// ── Patched fetch ──────────────────────────────────────────────────────────────

function usePatchedFetch() {
  useEffect(() => {
    const deviceId = localStorage.getItem("sp_device_id") ?? "";
    const orig = window.fetch.bind(window);
    window.fetch = function(input: RequestInfo | URL, init: RequestInit = {}) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
      if (url.includes(process.env.NEXT_PUBLIC_API_URL ?? "__API__"))
        init = { ...init, headers: { ...(init.headers ?? {}), "X-Device-Id": deviceId } };
      return orig(input, init);
    };
    return () => { window.fetch = orig; };
  }, []);
}

// ── Inactivity modal ───────────────────────────────────────────────────────────

function InactivityWarning({ countdown, onStay, onLogout }: { countdown: number; onStay: () => void; onLogout: () => void }) {
  const pct = (countdown / 60) * 100;
  const urgent = countdown <= 10;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-3xl border p-7 shadow-2xl text-center" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
        <div className="mb-4 flex justify-center">
          <div className="relative flex h-16 w-16 items-center justify-center">
            <svg className="-rotate-90 absolute inset-0" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="28" fill="none" stroke="var(--sp-ring-track)" strokeWidth="4"/>
              <circle cx="32" cy="32" r="28" fill="none" stroke={urgent ? "#EF4444" : "#F59E0B"} strokeWidth="4"
                strokeDasharray={`${(pct / 100) * 175.9} 175.9`} strokeLinecap="round"
                style={{ transition: "stroke-dasharray 1s linear" }}/>
            </svg>
            <LogOut className="h-5 w-5" style={{ color: urgent ? "#EF4444" : "#F59E0B" }}/>
          </div>
        </div>
        <h2 className="text-base font-extrabold mb-1" style={{ color: "var(--sp-text)" }}>Still there?</h2>
        <p className="text-xs mb-1" style={{ color: "var(--sp-text-3)" }}>You&apos;ve been inactive for a while.</p>
        <p className="text-sm font-bold mb-5" style={{ color: urgent ? "#EF4444" : "var(--sp-text-2)" }}>
          Logging you out in <span className="tabular-nums">{countdown}s</span>
        </p>
        <button onClick={onStay} className="w-full rounded-2xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-500 transition mb-2">Stay logged in</button>
        <button onClick={onLogout} className="w-full rounded-2xl py-3 text-xs font-semibold transition hover:bg-red-500/10" style={{ color: "var(--sp-text-3)" }}>Log out now</button>
      </div>
    </div>
  );
}

// ── Conflict banner ────────────────────────────────────────────────────────────

function ConflictBanner() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-3xl border p-7 shadow-2xl text-center" style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
        <div className="mb-4 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
            <LogOut className="h-6 w-6 text-red-500"/>
          </div>
        </div>
        <h2 className="text-base font-extrabold mb-1" style={{ color: "var(--sp-text)" }}>Signed in elsewhere</h2>
        <p className="text-xs leading-relaxed" style={{ color: "var(--sp-text-3)" }}>Your account was signed in on another device. You are being redirected to login.</p>
      </div>
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────────

interface SidebarUser {
  fullName: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  streak: number;
  xp: number;
  tier: { label: string; color: string; isPaid: boolean; isTrial: boolean; detail: string };
}

const NAV_LINKS = [
  { href: "/dashboard",         icon: Home,          label: "Home"           },
  { href: "/dashboard/courses", icon: BookOpen,      label: "Browse courses" },
  { href: "/dashboard/upload",  icon: Upload,        label: "Upload paper"   },
  { href: "/dashboard/subscribe", icon: Crown,       label: "Plans & billing"},
  { href: "/dashboard/profile", icon: GraduationCap, label: "My profile"     },
];

const LEVEL_NAMES = ["Newcomer","Explorer","Scholar","Achiever","Expert","Master","Legend"];

function Sidebar({
  open, onClose, user, onLogout, darkMode, onToggleDark,
}: {
  open: boolean;
  onClose: () => void;
  user: SidebarUser | null;
  onLogout: () => void;
  darkMode: boolean;
  onToggleDark: () => void;
}) {
  const pathname = usePathname();
  const firstName = (user?.fullName ?? "You").split(" ")[0];
  const xp        = user?.xp ?? 0;
  const streak    = user?.streak ?? 0;
  const level     = Math.floor(xp / 100) + 1;
  const progress  = xp % 100;
  const levelName = LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)];
  const tier      = user?.tier;

  // streak ring values — cap fill at full circle for streaks >= 7
  const size  = 48;
  const r     = size / 2 - 5;
  const circ  = 2 * Math.PI * r;
  const fill  = Math.min(streak / 7, 1) * circ;
  const streakColor = streak >= 7 ? "#F59E0B" : streak >= 3 ? "#6366F1" : "#94A3B8";

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden"
        style={{ opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed inset-y-0 left-0 z-[81] flex w-72 flex-col shadow-2xl transition-transform duration-300 ease-out"
        style={{
          background: "var(--sp-bg-card)",
          borderRight: "1px solid var(--sp-border)",
          transform: open ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--sp-border)" }}>
          <div className="flex items-center gap-2.5">
            <Image alt="SparkL" className="rounded-xl object-cover shadow-md" height={30} src="/images/logo.jpg" width={30}/>
            <span className="text-sm font-black tracking-tight" style={{ color: "var(--sp-text)" }}>SparkL</span>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border transition hover:bg-red-500/10"
            style={{ borderColor: "var(--sp-border)" }}
            aria-label="Close menu"
          >
            <X className="h-4 w-4" style={{ color: "var(--sp-text-3)" }}/>
          </button>
        </div>

        {/* ── Profile mini ── */}
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--sp-border)" }}>
          <div className="flex items-center gap-3 mb-3">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="Avatar" className="h-11 w-11 rounded-2xl object-cover ring-2 ring-indigo-500/20"/>
            ) : (
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-black text-white">
                {firstName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black" style={{ color: "var(--sp-text)" }}>{user?.fullName ?? firstName}</p>
              <p className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>Level {level} · {levelName}</p>
            </div>
            {user?.isAdmin && (
              <span className="flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] font-black text-red-500 shrink-0">
                <ShieldAlert className="h-2.5 w-2.5"/>Admin
              </span>
            )}
          </div>

          {/* XP bar */}
          <div className="mb-3">
            <div className="flex justify-between mb-1">
              <span className="text-[10px] font-bold" style={{ color: "var(--sp-text-3)" }}>{xp} XP</span>
              <span className="text-[10px] font-bold text-indigo-500">{100 - progress} to next level</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--sp-ring-track)" }}>
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-1000" style={{ width: `${progress}%` }}/>
            </div>
          </div>

          {/* Tier pill */}
          {tier && (
            <Link href="/dashboard/subscribe" onClick={onClose}
              className="flex items-center gap-2 rounded-xl border px-3 py-2 transition hover:opacity-80"
              style={{ background: `${tier.color}12`, borderColor: `${tier.color}38` }}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-lg text-white" style={{ background: tier.color }}>
                {tier.isPaid ? <Crown className="h-2.5 w-2.5" fill="currentColor"/> : tier.isTrial ? <Timer className="h-2.5 w-2.5"/> : <Sparkles className="h-2.5 w-2.5"/>}
              </span>
              <span className="text-[11px] font-black" style={{ color: tier.color }}>{tier.label}</span>
              <span className="ml-auto text-[9px]" style={{ color: "var(--sp-text-3)" }}>{tier.detail}</span>
              <ChevronRight className="h-3 w-3 shrink-0" style={{ color: tier.color }}/>
            </Link>
          )}
        </div>

        {/* ── Streak mini ── */}
        <div className="px-5 py-3 border-b" style={{ borderColor: "var(--sp-border)" }}>
          <div className="flex items-center gap-3">
            <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
              <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
                <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--sp-ring-track)" strokeWidth="4"/>
                <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={streakColor} strokeWidth="4"
                  strokeDasharray={`${fill} ${circ}`} strokeLinecap="round"
                  style={{ transition: "stroke-dasharray 1.2s cubic-bezier(0.34,1.56,0.64,1)" }}/>
              </svg>
              <div className="absolute flex flex-col items-center leading-none">
                <Flame className="h-3 w-3" style={{ color: streakColor }}/>
                <span className="text-[10px] font-black" style={{ color: "var(--sp-text)" }}>{streak}</span>
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-xs font-black" style={{ color: "var(--sp-text)" }}>{streak} day streak</p>
              <p className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>
                {streak === 0 ? "Start today!" : streak >= 7 ? "🔥 Full week! Amazing!" : `${7 - streak} more to hit 7`}
              </p>
              {/* Mini day dots */}
              <div className="flex gap-1 mt-1.5">
                {["M","T","W","T","F","S","S"].map((d, i) => {
                  const todayJS = new Date().getDay();
                  const todayMF = todayJS === 0 ? 6 : todayJS - 1;
                  const done    = i <= todayMF && (todayMF - i) < streak;
                  const isToday = i === todayMF;
                  return (
                    <div key={i} className="h-4 w-4 rounded-full flex items-center justify-center text-[7px] font-black"
                      style={{
                        background: done ? "#6366F1" : isToday ? "rgba(99,102,241,0.18)" : "var(--sp-ring-track)",
                        color: done ? "white" : isToday ? "#6366F1" : "var(--sp-text-3)",
                        outline: isToday && !done ? "1.5px solid rgba(99,102,241,0.45)" : "none",
                      }}
                    >{d}</div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ── Nav links ── */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          <p className="px-3 pb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--sp-text-3)" }}>Navigate</p>
          {NAV_LINKS.map(({ href, icon: Icon, label }) => {
            const active = pathname === href;
            return (
              <Link key={href} href={href} onClick={onClose}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all"
                style={{
                  background: active ? "rgba(99,102,241,0.10)" : "transparent",
                  color: active ? "#6366F1" : "var(--sp-text-2)",
                  borderLeft: active ? "3px solid #6366F1" : "3px solid transparent",
                }}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg"
                  style={{ background: active ? "rgba(99,102,241,0.15)" : "var(--sp-ring-track)" }}>
                  <Icon className="h-3.5 w-3.5"/>
                </span>
                {label}
                {active && <ChevronRight className="ml-auto h-3 w-3"/>}
              </Link>
            );
          })}

          {/* Admin link */}
          {user?.isAdmin && (
            <>
              <p className="px-3 pt-3 pb-1 text-[9px] font-black uppercase tracking-widest text-red-500">Admin</p>
              <Link href="/dashboard/admin" onClick={onClose}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all hover:bg-red-500/8"
                style={{
                  background: pathname.startsWith("/dashboard/admin") ? "rgba(239,68,68,0.10)" : "transparent",
                  color: pathname.startsWith("/dashboard/admin") ? "#EF4444" : "var(--sp-text-2)",
                  borderLeft: pathname.startsWith("/dashboard/admin") ? "3px solid #EF4444" : "3px solid transparent",
                }}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10">
                  <ShieldAlert className="h-3.5 w-3.5 text-red-500"/>
                </span>
                Admin panel
                {pathname.startsWith("/dashboard/admin") && <ChevronRight className="ml-auto h-3 w-3 text-red-500"/>}
              </Link>
            </>
          )}
        </nav>

        {/* ── Footer: theme toggle + logout ── */}
        <div className="border-t px-4 py-4 space-y-2" style={{ borderColor: "var(--sp-border)" }}>
          {/* Dark mode toggle */}
          <button
            onClick={onToggleDark}
            className="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all hover:border-indigo-500/30"
            style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-2)", background: "var(--sp-bg)" }}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "var(--sp-ring-track)" }}>
              {darkMode ? <Sun className="h-3.5 w-3.5 text-amber-400"/> : <Moon className="h-3.5 w-3.5 text-indigo-400"/>}
            </span>
            {darkMode ? "Light mode" : "Dark mode"}
            {/* Toggle pill */}
            <div className="ml-auto flex h-5 w-9 items-center rounded-full p-0.5 transition-colors duration-300"
              style={{ background: darkMode ? "#6366F1" : "var(--sp-ring-track)" }}>
              <div className="h-4 w-4 rounded-full bg-white shadow transition-transform duration-300"
                style={{ transform: darkMode ? "translateX(16px)" : "translateX(0)" }}/>
            </div>
          </button>

          {/* Logout */}
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all hover:border-red-500/30 hover:bg-red-500/5"
            style={{ borderColor: "var(--sp-border)", color: "#EF4444" }}
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10">
              <LogOut className="h-3.5 w-3.5 text-red-500"/>
            </span>
            Log out
          </button>
        </div>
      </div>
    </>
  );
}

// ── Topbar ─────────────────────────────────────────────────────────────────────

function Topbar({ onMenuOpen, avatarUrl, firstName }: { onMenuOpen: () => void; avatarUrl: string | null; firstName: string }) {
  return (
    <header className="sticky top-0 z-40 border-b backdrop-blur-xl" style={{ background: "var(--sp-header-bg)", borderColor: "var(--sp-border)" }}>
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 lg:px-6">
        <Link className="flex shrink-0 items-center gap-2.5" href="/dashboard">
          <Image alt="SparkL" className="rounded-xl object-cover shadow-md" height={32} src="/images/logo.jpg" width={32}/>
          <span className="hidden text-base font-black tracking-tight sm:block" style={{ color: "var(--sp-text)" }}>SparkL</span>
        </Link>
        <div className="flex-1"/>
        <button className="relative hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors hover:border-indigo-500/30 sm:flex"
          style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
          <Bell className="h-4 w-4" style={{ color: "var(--sp-text-2)" }}/>
          <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-indigo-500"/>
        </button>
        <Link href="/dashboard/profile" className="hidden sm:block">
          {avatarUrl ? (
            <img src={avatarUrl} alt="Profile" className="h-9 w-9 rounded-xl object-cover ring-2 ring-indigo-500/30"/>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-[11px] font-black text-white shadow-md shadow-indigo-500/30">
              {firstName.slice(0, 2).toUpperCase()}
            </div>
          )}
        </Link>
        {/* Hamburger — always visible, opens sidebar */}
        <button
          onClick={onMenuOpen}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors hover:border-indigo-500/30"
          style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4" style={{ color: "var(--sp-text-2)" }}/>
        </button>
      </div>
    </header>
  );
}

// ── Inner shell ────────────────────────────────────────────────────────────────

function DashboardShell({ children }: { children: React.ReactNode }) {
  const supabase  = createClient();
  const router    = useRouter();
  const [kicked, setKicked]       = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [darkMode, setDarkMode]   = useState(false);
  const [sidebarUser, setSidebarUser] = useState<SidebarUser | null>(null);

  usePatchedFetch();

  // Dark mode persistence
  useEffect(() => {
    const saved = localStorage.getItem("sp_dark");
    if (saved === "1") { setDarkMode(true); document.documentElement.classList.add("dark"); }
  }, []);

  const toggleDark = useCallback(() => {
    setDarkMode(prev => {
      const next = !prev;
      localStorage.setItem("sp_dark", next ? "1" : "0");
      document.documentElement.classList.toggle("dark", next);
      return next;
    });
  }, []);

  // Logout
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/auth/login?reason=timeout");
  }, [supabase, router]);

  const manualLogout = useCallback(async () => {
    setDrawerOpen(false);
    await supabase.auth.signOut();
    router.push("/auth/login");
  }, [supabase, router]);

  // Inactivity
  const { showWarning, countdown, stayLoggedIn } = useInactivityLogout(signOut);

  // Session guard
  useSessionGuard(supabase, () => {
    setKicked(true);
    setTimeout(() => router.push("/auth/login?reason=conflict"), 2000);
  });

  // Load user data for sidebar
  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const token = session.access_token;
      const h = { Authorization: `Bearer ${token}` };
      const base = process.env.NEXT_PUBLIC_API_URL ?? "";

      try {
        const [profileRes, avatarRes, subRes] = await Promise.allSettled([
          fetch(`${base}/api/dashboard/summary`, { headers: h }),
          fetch(`${base}/api/avatar/me`,         { headers: h }),
          fetch(`${base}/api/payments/subscription/status`, { headers: h }),
        ]);

        let fullName: string | null = null;
        let isAdmin  = false;
        let streak   = 0;
        let xp       = 0;
        if (profileRes.status === "fulfilled" && profileRes.value.ok) {
          const j = await profileRes.value.json();
          fullName = j.profile?.full_name ?? null;
          isAdmin  = j.profile?.is_admin === true;
          streak   = j.profile?.streak ?? 0;
          xp       = j.profile?.xp ?? 0;
        }

        let avatarUrl: string | null = null;
        if (avatarRes.status === "fulfilled" && avatarRes.value.ok) {
          const j = await avatarRes.value.json();
          avatarUrl = j.avatar_url ?? null;
        }

        const TIER_COLORS: Record<string, string> = {
          unknown: "#64748B", free: "#64748B", trial: "#F59E0B",
          basic: "#0EA5E9", pro: "#6366F1", premium: "#8B5CF6",
        };
        let tier: SidebarUser["tier"] = { label: "Free", color: TIER_COLORS.free, isPaid: false, isTrial: false, detail: "Upgrade for full access" };
        if (subRes.status === "fulfilled" && subRes.value.ok) {
          const j = await subRes.value.json();
          if (j.is_trial) {
            const d = j.trial_days_left ?? 0;
            tier = { label: "Free Trial", color: TIER_COLORS.trial, isPaid: false, isTrial: true, detail: `${d} day${d === 1 ? "" : "s"} left` };
          } else if (j.is_paid) {
            const plan = (j.effective_plan || "pro").toLowerCase();
            tier = { label: plan.charAt(0).toUpperCase() + plan.slice(1), color: TIER_COLORS[plan] ?? TIER_COLORS.pro, isPaid: true, isTrial: false, detail: "Active" };
          }
        }

        setSidebarUser({ fullName, avatarUrl, isAdmin, streak, xp, tier });
      } catch {}
    }
    load();
  }, [supabase]);

  const firstName = (sidebarUser?.fullName ?? "You").split(" ")[0];

  return (
    <>
      {kicked    && <ConflictBanner />}
      {showWarning && !kicked && (
        <InactivityWarning countdown={countdown} onStay={stayLoggedIn} onLogout={signOut}/>
      )}

      <Sidebar
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        user={sidebarUser}
        onLogout={manualLogout}
        darkMode={darkMode}
        onToggleDark={toggleDark}
      />

      <Topbar
        onMenuOpen={() => setDrawerOpen(true)}
        avatarUrl={sidebarUser?.avatarUrl ?? null}
        firstName={firstName}
      />

      {children}
    </>
  );
}

// ── Root export ────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardShell>{children}</DashboardShell>
    </QueryClientProvider>
  );
}
