"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  LogOut, Menu, X, BookOpen, Upload, GraduationCap,
  Crown, Sparkles, Timer, Flame, Zap, ShieldAlert,
  Home, Bell, Moon, Sun, ChevronRight, Search,
  FileText, ArrowRight,
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

// ── Types ──────────────────────────────────────────────────────────────────────

interface Course { id: string; name: string; }
interface ApiCourse { id: string; name: string; department?: string; institution?: string; }
interface QuestionResult {
  id: string; title: string; course: { name: string } | null; year: number | null;
}
interface SidebarUser {
  fullName: string | null; avatarUrl: string | null; isAdmin: boolean;
  streak: number; xp: number; department: string | null;
  tier: { label: string; color: string; isPaid: boolean; isTrial: boolean; detail: string };
}

// ── Constants ──────────────────────────────────────────────────────────────────

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000;
const WARNING_BEFORE_MS     = 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove","mousedown","keydown","touchstart","scroll","click"] as const;

const COURSE_PALETTE = ["#6366F1","#0EA5E9","#8B5CF6","#10B981","#F59E0B","#EF4444"];

const TIER_COLORS: Record<string, string> = {
  unknown: "#64748B", free: "#64748B", trial: "#F59E0B",
  basic: "#0EA5E9", pro: "#6366F1", premium: "#8B5CF6",
};

const LEVEL_NAMES = ["Newcomer","Explorer","Scholar","Achiever","Expert","Master","Legend"];

const NAV_LINKS = [
  { href: "/dashboard",           icon: Home,          label: "Home"            },
  { href: "/dashboard/courses",   icon: BookOpen,      label: "Browse courses"  },
  { href: "/study",               icon: Sparkles,      label: "SparkL Cram"     },
  { href: "/dashboard/upload",    icon: Upload,        label: "Upload paper"    },
  { href: "/dashboard/subscribe", icon: Crown,         label: "Plans & billing" },
  { href: "/dashboard/profile",   icon: GraduationCap, label: "My profile"      },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function courseInitials(name: string): string {
  return name.split(" ").filter(w => /^[a-zA-Z]/.test(w)).map(w => w[0].toUpperCase()).slice(0, 2).join("") || name.slice(0, 2).toUpperCase();
}

function splitCourseName(name: string): { code: string | null; title: string } {
  const m = name.match(/^\s*([A-Za-z]{2,5})\s?-?\s?(\d{2,4}[A-Za-z]?)\s*[-:–—]?\s*(.*)$/);
  if (!m) return { code: null, title: name };
  return { code: `${m[1].toUpperCase()} ${m[2]}`, title: m[3].trim() || name };
}

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
      <div className="w-full max-w-sm rounded-3xl border p-7 shadow-2xl text-center"
        style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
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
        <button onClick={onStay} className="w-full rounded-2xl bg-indigo-600 py-3 text-sm font-bold text-white hover:bg-indigo-500 transition mb-2">
          Stay logged in
        </button>
        <button onClick={onLogout} className="w-full rounded-2xl py-3 text-xs font-semibold transition hover:bg-red-500/10"
          style={{ color: "var(--sp-text-3)" }}>
          Log out now
        </button>
      </div>
    </div>
  );
}

// ── Conflict banner ────────────────────────────────────────────────────────────

function ConflictBanner() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-sm rounded-3xl border p-7 shadow-2xl text-center"
        style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
        <div className="mb-4 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
            <LogOut className="h-6 w-6 text-red-500"/>
          </div>
        </div>
        <h2 className="text-base font-extrabold mb-1" style={{ color: "var(--sp-text)" }}>Signed in elsewhere</h2>
        <p className="text-xs leading-relaxed" style={{ color: "var(--sp-text-3)" }}>
          Your account was signed in on another device. You are being redirected to login.
        </p>
      </div>
    </div>
  );
}

// ── Search dropdown ────────────────────────────────────────────────────────────

function SearchDropdown({
  query, courses, questionResults, searching, onSelect,
}: {
  query: string;
  courses: ApiCourse[];
  questionResults: QuestionResult[];
  searching: boolean;
  onSelect: () => void;
}) {
  const hasResults = courses.length > 0 || questionResults.length > 0;

  if (searching && !hasResults) {
    return (
      <div className="flex items-center justify-center gap-2 py-8">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"/>
        <span className="text-xs" style={{ color: "var(--sp-text-3)" }}>Searching…</span>
      </div>
    );
  }

  if (!hasResults) {
    return (
      <div className="flex flex-col items-center py-8 gap-2">
        <Search className="h-5 w-5 opacity-30" style={{ color: "var(--sp-text-3)" }}/>
        <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>No results for &ldquo;{query}&rdquo;</p>
        <p className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>Try a different keyword</p>
      </div>
    );
  }

  return (
    <div className="p-2 max-h-[420px] overflow-y-auto">
      {courses.length > 0 && (
        <>
          <p className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--sp-text-3)" }}>
            Courses ({courses.length})
          </p>
          {courses.map((c, i) => {
            const accent = COURSE_PALETTE[i % COURSE_PALETTE.length];
            const { code } = splitCourseName(c.name);
            return (
              <Link key={c.id} href={`/dashboard/courses/${c.id}`} onClick={onSelect}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-indigo-500/5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-black text-white"
                  style={{ background: accent }}>
                  {code?.split(" ")[0] ?? courseInitials(c.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold" style={{ color: "var(--sp-text)" }}>{c.name}</p>
                  <p className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>
                    {c.department && c.institution
                      ? `${c.department} · ${c.institution}`
                      : c.department ?? c.institution ?? "Course · Past questions & practice"}
                  </p>
                </div>
                <ArrowRight className="ml-auto h-3 w-3 shrink-0" style={{ color: accent }}/>
              </Link>
            );
          })}
        </>
      )}

      {questionResults.length > 0 && (
        <>
          <p className="px-2 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--sp-text-3)" }}>
            Past Questions ({questionResults.length})
          </p>
          {questionResults.map((q, i) => {
            const accent = COURSE_PALETTE[(courses.length + i) % COURSE_PALETTE.length];
            const courseCode = q.course?.name ? splitCourseName(q.course.name).code : null;
            return (
              <Link key={q.id} href={`/questions/${q.id}`} onClick={onSelect}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-indigo-500/5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white"
                  style={{ background: accent }}>
                  <FileText className="h-3.5 w-3.5"/>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold" style={{ color: "var(--sp-text)" }}>{q.title}</p>
                  <p className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>
                    {courseCode ?? q.course?.name ?? "Past question"}{q.year ? ` · ${q.year}` : ""}
                  </p>
                </div>
                <ArrowRight className="ml-auto h-3 w-3 shrink-0" style={{ color: accent }}/>
              </Link>
            );
          })}
        </>
      )}

      <div className="border-t mt-2 pt-2" style={{ borderColor: "var(--sp-border)" }}>
        <Link href={`/dashboard/courses?q=${encodeURIComponent(query)}`} onClick={onSelect}
          className="flex items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-bold text-indigo-500 hover:bg-indigo-500/5 transition-colors">
          See all results for &ldquo;{query}&rdquo; <ArrowRight className="h-3 w-3"/>
        </Link>
      </div>
    </div>
  );
}

// ── Topbar ─────────────────────────────────────────────────────────────────────

function Topbar({
  onMenuOpen, avatarUrl, firstName, getToken, department,
}: {
  onMenuOpen: () => void;
  avatarUrl: string | null;
  firstName: string;
  getToken: () => Promise<string | null>;
  department: string | null;
}) {
  const supabase = createClient();

  const [query, setQuery]              = useState("");
  const [focused, setFocused]          = useState(false);
  const [questionResults, setQResults] = useState<QuestionResult[]>([]);
  const [apiCourses, setApiCourses]    = useState<ApiCourse[]>([]);
  const [searching, setSearching]      = useState(false);

  const searchRef   = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ── NEW: tracks the active AbortController so we can cancel stale requests ──
  const abortRef    = useRef<AbortController | null>(null);

  const searchPlaceholder = department
    ? `Search ${department}…`
    : "Search courses or past questions…";

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const q = query.trim();

    // Require at least 2 characters before firing — prevents single-char
    // queries from hammering Supabase and triggering the Cloudflare 1101.
    if (!q || q.length < 2) {
      // Cancel any in-flight request immediately
      if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
      setQResults([]);
      setApiCourses([]);
      setSearching(false);
      return;
    }

    setSearching(true);

    debounceRef.current = setTimeout(async () => {
      // ── Cancel the previous in-flight request before starting a new one ────
      if (abortRef.current) abortRef.current.abort();
      const controller  = new AbortController();
      abortRef.current  = controller;
      const { signal }  = controller;

      try {
        // ── Supabase course search (client-side, no AbortController support
        //    in the JS SDK, but we guard with signal.aborted before setState) ──
        const { data: courseData, error } = await supabase
          .from("courses")
          .select("id, name, department:departments(name, institution:institutions(name))")
          .ilike("name", `%${q}%`)
          .order("name")
          .limit(20);

        // If a newer request already started, discard this result entirely
        if (signal.aborted) return;

        if (error) {
          console.error("[search] Supabase error:", error.message, error.code);
          setApiCourses([]);
        } else {
          const mapped: ApiCourse[] = (courseData ?? []).map((r: any) => {
            const dept = r.department || {};
            const inst = dept.institution || {};
            return {
              id:          r.id,
              name:        r.name,
              department:  dept.name ?? undefined,
              institution: inst.name ?? undefined,
            };
          });
          setApiCourses(mapped);
        }

        // ── Backend question search — pass signal so fetch is truly cancelled ──
        const token = await getToken();

        if (signal.aborted) return;

        if (token) {
          try {
            const res = await fetch(
              `${process.env.NEXT_PUBLIC_API_URL}/api/questions/search?q=${encodeURIComponent(q)}&limit=6`,
              { headers: { Authorization: `Bearer ${token}` }, signal },
            );

            if (signal.aborted) return;

            if (res.ok) {
              const j = await res.json();
              if (!signal.aborted) setQResults(j.results ?? []);
            } else {
              // Backend returned an error (e.g. 500 from Cloudflare/Supabase)
              // — silently keep whatever course results we already have; don't
              // flip to "no results".
              console.warn("[search] questions endpoint returned", res.status);
            }
          } catch (fetchErr: any) {
            if (fetchErr?.name === "AbortError") return; // expected — ignore
            console.error("[search] questions fetch error:", fetchErr);
            // Don't clear apiCourses — leave courses visible even if questions fail
          }
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return; // expected — ignore
        console.error("[search] unexpected error:", err);
        // Only clear results on a genuine unexpected error, not on cancellation
        setQResults([]);
        setApiCourses([]);
      } finally {
        // Only stop the spinner if this request wasn't superseded
        if (!signal.aborted) setSearching(false);
      }
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, getToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup abort on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  // Close dropdown on outside click (pointerdown so mobile taps work before blur)
  useEffect(() => {
    const h = (e: PointerEvent) => {
      const target = e.target as Node;
      if (searchRef.current && searchRef.current.contains(target)) return;
      const sidebar = document.querySelector("[data-sidebar]");
      if (sidebar && sidebar.contains(target)) return;
      setFocused(false);
      setQuery("");
      setQResults([]);
      setApiCourses([]);
      // Cancel any pending request when the user dismisses the search
      if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
    };
    document.addEventListener("pointerdown", h);
    return () => document.removeEventListener("pointerdown", h);
  }, []);

  const showDropdown = focused && query.trim().length >= 2;

  const handleSelect = () => {
    setQuery("");
    setFocused(false);
    setQResults([]);
    setApiCourses([]);
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
  };

  const handleClear = () => {
    setQuery("");
    setQResults([]);
    setApiCourses([]);
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null; }
  };

  return (
    <header className="sticky top-0 z-40 border-b backdrop-blur-xl"
      style={{ background: "var(--sp-header-bg)", borderColor: "var(--sp-border)" }}>
      <div className="flex h-16 items-center gap-3 px-4 lg:px-6">

        {/* Logo — hidden on lg when sidebar is visible */}
        <Link className="flex shrink-0 items-center gap-2.5 lg:hidden" href="/dashboard">
          <Image alt="SparkL" className="rounded-xl object-cover shadow-md" height={32} src="/images/logo.jpg" width={32}/>
        </Link>

        {/* Search */}
        <div className="relative min-w-0 flex-1 max-w-xl mx-auto" ref={searchRef}>
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 transition-colors"
            style={{ color: focused ? "#6366F1" : "var(--sp-text-3)" }}/>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            placeholder={searchPlaceholder}
            className="w-full rounded-full border py-2.5 pl-11 pr-4 text-sm outline-none transition-all"
            style={{
              background: "var(--sp-input-bg)",
              borderColor: focused ? "rgba(99,102,241,0.5)" : "var(--sp-border)",
              color: "var(--sp-text)",
              boxShadow: focused ? "0 0 0 3px rgba(99,102,241,0.10)" : "none",
            }}
          />
          {query && (
            <button onClick={handleClear}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold px-1.5 py-0.5 rounded-full hover:bg-indigo-500/10 transition-colors"
              style={{ color: "var(--sp-text-3)" }}>
              ✕
            </button>
          )}
          {showDropdown && (
            <div
              className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border shadow-2xl"
              style={{ background: "var(--sp-search-popup, var(--sp-bg-card))", borderColor: "var(--sp-border)" }}
              onPointerDown={e => e.stopPropagation()}
            >
              <SearchDropdown
                query={query.trim()}
                courses={apiCourses}
                questionResults={questionResults}
                searching={searching}
                onSelect={handleSelect}
              />
            </div>
          )}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button className="relative hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors hover:border-indigo-500/30 sm:flex"
            style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}>
            <Bell className="h-4 w-4" style={{ color: "var(--sp-text-2)" }}/>
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-indigo-500"/>
          </button>
          <Link href="/dashboard/profile" className="hidden sm:block">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Profile" className="h-9 w-9 rounded-xl object-cover ring-2 ring-indigo-500/30 transition hover:ring-indigo-500/60"/>
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-[11px] font-black text-white shadow-md shadow-indigo-500/30">
                {firstName.slice(0, 2).toUpperCase()}
              </div>
            )}
          </Link>
          {/* Hamburger — only on mobile */}
          <button onClick={onMenuOpen}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors hover:border-indigo-500/30 lg:hidden"
            style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
            aria-label="Open menu">
            <Menu className="h-4 w-4" style={{ color: "var(--sp-text-2)" }}/>
          </button>
        </div>
      </div>
    </header>
  );
}

// ── Sidebar inner content ──────────────────────────────────────────────────────

function SidebarContent({
  user, onLogout, darkMode, onToggleDark, onClose,
}: {
  user: SidebarUser | null;
  onLogout: () => void;
  darkMode: boolean;
  onToggleDark: () => void;
  onClose?: () => void;
}) {
  const pathname  = usePathname();
  const firstName = (user?.fullName ?? "You").split(" ")[0];
  const xp        = user?.xp ?? 0;
  const streak    = user?.streak ?? 0;
  const level     = Math.floor(xp / 100) + 1;
  const progress  = xp % 100;
  const levelName = LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)];
  const tier      = user?.tier;

  const size        = 48;
  const r           = size / 2 - 5;
  const circ        = 2 * Math.PI * r;
  const fill        = Math.min(streak / 7, 1) * circ;
  const streakColor = streak >= 7 ? "#F59E0B" : streak >= 3 ? "#6366F1" : "#94A3B8";

  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === href : pathname.startsWith(href);

  const handleNav = () => { onClose?.(); };

  return (
    <div className="flex h-full flex-col" style={{ background: "var(--sp-bg-card)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "var(--sp-border)" }}>
        <div className="flex items-center gap-2.5">
          <Image alt="SparkL" className="rounded-xl object-cover shadow-md" height={30} src="/images/logo.jpg" width={30}/>
          <span className="text-sm font-black tracking-tight" style={{ color: "var(--sp-text)" }}>SparkL</span>
        </div>
        {onClose && (
          <button onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border transition hover:bg-red-500/10 lg:hidden"
            style={{ borderColor: "var(--sp-border)" }} aria-label="Close menu">
            <X className="h-4 w-4" style={{ color: "var(--sp-text-3)" }}/>
          </button>
        )}
      </div>

      {/* Profile mini */}
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
            <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: "var(--sp-text-3)" }}>
              <Zap className="h-2.5 w-2.5 text-indigo-500"/>{xp} XP
            </span>
            <span className="text-[10px] font-bold text-indigo-500">{100 - progress} to next</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: "var(--sp-ring-track)" }}>
            <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-1000"
              style={{ width: `${progress}%` }}/>
          </div>
        </div>

        {/* Tier pill */}
        {tier && (
          <Link href="/dashboard/subscribe" onClick={handleNav}
            className="flex items-center gap-2 rounded-xl border px-3 py-2 transition hover:opacity-80"
            style={{ background: `${tier.color}12`, borderColor: `${tier.color}38` }}>
            <span className="flex h-5 w-5 items-center justify-center rounded-lg text-white" style={{ background: tier.color }}>
              {tier.isPaid ? <Crown className="h-2.5 w-2.5" fill="currentColor"/> : tier.isTrial ? <Timer className="h-2.5 w-2.5"/> : <Sparkles className="h-2.5 w-2.5"/>}
            </span>
            <span className="text-[11px] font-black" style={{ color: tier.color }}>{tier.label}</span>
            <span className="ml-auto text-[9px]" style={{ color: "var(--sp-text-3)" }}>{tier.detail}</span>
            <ChevronRight className="h-3 w-3 shrink-0" style={{ color: tier.color }}/>
          </Link>
        )}
      </div>

      {/* Streak mini */}
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
            <div className="flex gap-1 mt-1.5">
              {["M","T","W","T","F","S","S"].map((d, i) => {
                const todayMF = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
                const done    = i <= todayMF && (todayMF - i) < streak;
                const isToday = i === todayMF;
                return (
                  <div key={i} className="h-4 w-4 rounded-full flex items-center justify-center text-[7px] font-black"
                    style={{
                      background: done ? "#6366F1" : isToday ? "rgba(99,102,241,0.18)" : "var(--sp-ring-track)",
                      color: done ? "white" : isToday ? "#6366F1" : "var(--sp-text-3)",
                      outline: isToday && !done ? "1.5px solid rgba(99,102,241,0.45)" : "none",
                    }}>{d}</div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Nav links */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        <p className="px-3 pb-1 text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--sp-text-3)" }}>Navigate</p>
        {NAV_LINKS.map(({ href, icon: Icon, label }) => {
          const active = isActive(href);
          return (
            <Link key={href} href={href} onClick={handleNav}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all"
              style={{
                background: active ? "rgba(99,102,241,0.10)" : "transparent",
                color: active ? "#6366F1" : "var(--sp-text-2)",
                borderLeft: active ? "3px solid #6366F1" : "3px solid transparent",
              }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg"
                style={{ background: active ? "rgba(99,102,241,0.15)" : "var(--sp-ring-track)" }}>
                <Icon className="h-3.5 w-3.5"/>
              </span>
              {label}
              {href === "/study" && (
                <span className="ml-1 rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[8px] font-black text-violet-500">AI</span>
              )}
              {active && <ChevronRight className="ml-auto h-3 w-3"/>}
            </Link>
          );
        })}

        {user?.isAdmin && (
          <>
            <p className="px-3 pt-3 pb-1 text-[9px] font-black uppercase tracking-widest text-red-500">Admin</p>
            <Link href="/admin" onClick={handleNav}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all"
              style={{
                background: pathname.startsWith("/admin") ? "rgba(239,68,68,0.10)" : "transparent",
                color: pathname.startsWith("/admin") ? "#EF4444" : "var(--sp-text-2)",
                borderLeft: pathname.startsWith("/admin") ? "3px solid #EF4444" : "3px solid transparent",
              }}>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10">
                <ShieldAlert className="h-3.5 w-3.5 text-red-500"/>
              </span>
              Admin panel
              {pathname.startsWith("/admin") && <ChevronRight className="ml-auto h-3 w-3 text-red-500"/>}
            </Link>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t px-4 py-4 space-y-2" style={{ borderColor: "var(--sp-border)" }}>
        <button onClick={onToggleDark}
          className="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all hover:border-indigo-500/30"
          style={{ borderColor: "var(--sp-border)", color: "var(--sp-text-2)", background: "var(--sp-bg)" }}>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "var(--sp-ring-track)" }}>
            {darkMode ? <Sun className="h-3.5 w-3.5 text-amber-400"/> : <Moon className="h-3.5 w-3.5 text-indigo-400"/>}
          </span>
          {darkMode ? "Light mode" : "Dark mode"}
          <div className="ml-auto flex h-5 w-9 items-center rounded-full p-0.5 transition-colors duration-300"
            style={{ background: darkMode ? "#6366F1" : "var(--sp-ring-track)" }}>
            <div className="h-4 w-4 rounded-full bg-white shadow transition-transform duration-300"
              style={{ transform: darkMode ? "translateX(16px)" : "translateX(0)" }}/>
          </div>
        </button>
        <button onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all hover:border-red-500/30 hover:bg-red-500/5"
          style={{ borderColor: "var(--sp-border)", color: "#EF4444" }}>
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10">
            <LogOut className="h-3.5 w-3.5 text-red-500"/>
          </span>
          Log out
        </button>
      </div>
    </div>
  );
}

// ── Mobile drawer ──────────────────────────────────────────────────────────────

function MobileDrawer({
  open, onClose, user, onLogout, darkMode, onToggleDark,
}: {
  open: boolean; onClose: () => void; user: SidebarUser | null;
  onLogout: () => void; darkMode: boolean; onToggleDark: () => void;
}) {
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <div
        className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden"
        style={{ opacity: open ? 1 : 0, pointerEvents: open ? "auto" : "none" }}
        onClick={onClose}
      />
      <div
        data-sidebar
        className="fixed inset-y-0 left-0 z-[81] w-72 shadow-2xl transition-transform duration-300 ease-out lg:hidden"
        style={{
          borderRight: "1px solid var(--sp-border)",
          transform: open ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        <SidebarContent
          user={user}
          onLogout={onLogout}
          darkMode={darkMode}
          onToggleDark={onToggleDark}
          onClose={onClose}
        />
      </div>
    </>
  );
}

// ── Dashboard Shell ────────────────────────────────────────────────────────────

function DashboardShell({ children }: { children: React.ReactNode }) {
  const supabase  = createClient();
  const router    = useRouter();
  const [kicked, setKicked]           = useState(false);
  const [drawerOpen, setDrawerOpen]   = useState(false);
  const [darkMode, setDarkMode]       = useState(false);
  const [sidebarUser, setSidebarUser] = useState<SidebarUser | null>(null);

  usePatchedFetch();

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

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/auth/login?reason=timeout");
  }, [supabase, router]);

  const manualLogout = useCallback(async () => {
    setDrawerOpen(false);
    await supabase.auth.signOut();
    router.push("/auth/login");
  }, [supabase, router]);

  const { showWarning, countdown, stayLoggedIn } = useInactivityLogout(signOut);
  useSessionGuard(supabase, () => {
    setKicked(true);
    setTimeout(() => router.push("/auth/login?reason=conflict"), 2000);
  });

  const getToken = useCallback(async (): Promise<string | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, [supabase]);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const token = session.access_token;
      const h    = { Authorization: `Bearer ${token}` };
      const base = process.env.NEXT_PUBLIC_API_URL ?? "";

      try {
        const [profileRes, avatarRes, subRes] = await Promise.allSettled([
          fetch(`${base}/api/dashboard/summary`,              { headers: h }),
          fetch(`${base}/api/avatar/me`,                      { headers: h }),
          fetch(`${base}/api/payments/subscription/status`,   { headers: h }),
        ]);

        let fullName: string | null   = null;
        let isAdmin                   = false;
        let streak                    = 0;
        let xp                        = 0;
        let department: string | null = null;

        if (profileRes.status === "fulfilled" && profileRes.value.ok) {
          const j = await profileRes.value.json();
          fullName   = j.profile?.full_name ?? null;
          isAdmin    = j.profile?.is_admin === true;
          streak     = j.profile?.streak ?? 0;
          xp         = j.profile?.xp ?? 0;
          department = j.profile?.department?.name ?? null;
        }

        let avatarUrl: string | null = null;
        if (avatarRes.status === "fulfilled" && avatarRes.value.ok) {
          const j = await avatarRes.value.json();
          avatarUrl = j.avatar_url ?? null;
        }

        let tier: SidebarUser["tier"] = {
          label: "Free", color: TIER_COLORS.free,
          isPaid: false, isTrial: false, detail: "Upgrade for full access",
        };
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

        setSidebarUser({ fullName, avatarUrl, isAdmin, streak, xp, tier, department });
      } catch {}
    }
    load();
  }, [supabase]);

  const firstName = (sidebarUser?.fullName ?? "You").split(" ")[0];

  return (
    <>
      {kicked && <ConflictBanner />}
      {showWarning && !kicked && (
        <InactivityWarning countdown={countdown} onStay={stayLoggedIn} onLogout={signOut}/>
      )}

      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        user={sidebarUser}
        onLogout={manualLogout}
        darkMode={darkMode}
        onToggleDark={toggleDark}
      />

      <div
        data-sidebar
        className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:flex lg:w-64 lg:flex-col"
        style={{ borderRight: "1px solid var(--sp-border)" }}
      >
        <SidebarContent
          user={sidebarUser}
          onLogout={manualLogout}
          darkMode={darkMode}
          onToggleDark={toggleDark}
        />
      </div>

      <div className="flex flex-col lg:pl-64">
        <Topbar
          onMenuOpen={() => setDrawerOpen(true)}
          avatarUrl={sidebarUser?.avatarUrl ?? null}
          firstName={firstName}
          getToken={getToken}
          department={sidebarUser?.department ?? null}
        />
        <main className="flex-1">
          {children}
        </main>
      </div>
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
