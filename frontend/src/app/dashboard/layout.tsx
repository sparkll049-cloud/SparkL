// app/dashboard/layout.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Two responsibilities:
//   1. Wrap all dashboard pages in QueryClientProvider (fixes the build error).
//   2. Run inactivity logout + single-device session guard for every page.
//
// File structure expected:
//   app/
//     dashboard/
//       layout.tsx   ← this file
//       page.tsx
//       courses/
//         page.tsx
//         ...

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/client";

// ── QueryClient (one per browser session) ─────────────────────────────────────

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Don't refetch on window focus in a student app — less jarring
        refetchOnWindowFocus: false,
        // Keep data fresh for 5 minutes
        staleTime: 5 * 60 * 1000,
        retry: 1,
      },
    },
  });
}

// Singleton so navigating between pages doesn't throw away cached data.
let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always create a new client (never reuse across requests)
    return makeQueryClient();
  }
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const WARNING_BEFORE_MS     = 60 * 1000;       // show warning 60 s before logout

const ACTIVITY_EVENTS = [
  "mousemove", "mousedown", "keydown", "touchstart", "scroll", "click",
] as const;

// ── Inactivity logout hook ─────────────────────────────────────────────────────

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

  useEffect(() => {
    const lastActive = sessionStorage.getItem("sp_last_active");
    if (lastActive && Date.now() - Number(lastActive) >= INACTIVITY_TIMEOUT_MS) {
      doLogout();
      return;
    }

    resetTimer();

    const handler = () => resetTimer();
    ACTIVITY_EVENTS.forEach(ev =>
      document.addEventListener(ev, handler, { passive: true }),
    );

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

// ── Session guard hook ─────────────────────────────────────────────────────────

function useSessionGuard(
  supabase: ReturnType<typeof createClient>,
  onKick: () => void,
) {
  useEffect(() => {
    if (!localStorage.getItem("sp_device_id")) {
      localStorage.setItem("sp_device_id", crypto.randomUUID());
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(event => {
      if (event === "SIGNED_OUT") onKick();
    });

    return () => subscription.unsubscribe();
  }, [supabase, onKick]);
}

// ── Patched fetch ──────────────────────────────────────────────────────────────

function usePatchedFetch() {
  useEffect(() => {
    const deviceId = localStorage.getItem("sp_device_id") ?? "";
    const orig = window.fetch.bind(window);

    window.fetch = function (input: RequestInfo | URL, init: RequestInit = {}) {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.href
          : (input as Request).url;

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

// ── Inactivity warning modal ───────────────────────────────────────────────────

function InactivityWarning({
  countdown,
  onStay,
  onLogout,
}: {
  countdown: number;
  onStay: () => void;
  onLogout: () => void;
}) {
  const pct      = (countdown / 60) * 100;
  const isUrgent = countdown <= 10;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
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
                stroke={isUrgent ? "#EF4444" : "#F59E0B"}
                strokeWidth="4"
                strokeDasharray={`${(pct / 100) * 175.9} 175.9`}
                strokeLinecap="round"
                style={{ transition: "stroke-dasharray 1s linear" }}
              />
            </svg>
            <LogOut className="h-5 w-5" style={{ color: isUrgent ? "#EF4444" : "#F59E0B" }}/>
          </div>
        </div>

        <h2 className="text-base font-extrabold mb-1" style={{ color: "var(--sp-text)" }}>
          Still there?
        </h2>
        <p className="text-xs mb-1" style={{ color: "var(--sp-text-3)" }}>
          You&apos;ve been inactive for a while.
        </p>
        <p className="text-sm font-bold mb-5" style={{ color: isUrgent ? "#EF4444" : "var(--sp-text-2)" }}>
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

// ── Session-conflict banner ────────────────────────────────────────────────────

function ConflictBanner() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div
        className="w-full max-w-sm rounded-3xl border p-7 shadow-2xl text-center"
        style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
      >
        <div className="mb-4 flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
            <LogOut className="h-6 w-6 text-red-500"/>
          </div>
        </div>
        <h2 className="text-base font-extrabold mb-1" style={{ color: "var(--sp-text)" }}>
          Signed in elsewhere
        </h2>
        <p className="text-xs leading-relaxed" style={{ color: "var(--sp-text-3)" }}>
          Your account was signed in on another device. Only one active session
          is allowed. You are being redirected to login.
        </p>
      </div>
    </div>
  );
}

// ── Inner layout (needs QueryClient already in context) ───────────────────────

function DashboardGuard({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const router   = useRouter();
  const [kicked, setKicked] = useState(false);

  usePatchedFetch();

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    router.push("/auth/login?reason=timeout");
  }, [supabase, router]);

  const { showWarning, countdown, stayLoggedIn } = useInactivityLogout(signOut);

  useSessionGuard(supabase, () => {
    setKicked(true);
    setTimeout(() => router.push("/auth/login?reason=conflict"), 2000);
  });

  return (
    <>
      {kicked && <ConflictBanner />}
      {showWarning && !kicked && (
        <InactivityWarning
          countdown={countdown}
          onStay={stayLoggedIn}
          onLogout={signOut}
        />
      )}
      {children}
    </>
  );
}

// ── Root layout export ─────────────────────────────────────────────────────────

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <DashboardGuard>{children}</DashboardGuard>
    </QueryClientProvider>
  );
}
