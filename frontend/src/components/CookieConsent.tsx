"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";

const KEY = "sparkl_cookie_consent"; // "all" | "essential"

/** Use this anywhere before loading analytics/ads/tracking scripts. */
export function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(KEY) === "all";
  } catch {
    return false;
  }
}

export default function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(KEY)) setShow(true);
    } catch {
      setShow(true);
    }
  }, []);

  function choose(value: "all" | "essential") {
    try {
      localStorage.setItem(KEY, value);
    } catch {}
    setShow(false);
    // let other code (e.g. analytics loader) react immediately
    window.dispatchEvent(new CustomEvent("sparkl:consent", { detail: value }));
  }

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed inset-x-3 bottom-3 z-[60] mx-auto max-w-lg rounded-2xl border p-4 shadow-2xl sm:bottom-5"
      style={{
        background: "var(--sp-bg-card, #fff)",
        borderColor: "var(--sp-border, #e5e7eb)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "rgba(99,102,241,0.1)" }}
        >
          <Cookie size={18} className="text-indigo-500" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color: "var(--sp-text, #111)" }}>
            We use cookies
          </p>
          <p className="mt-1 text-xs leading-5" style={{ color: "var(--sp-text-3, #6b7280)" }}>
            Essential cookies keep you logged in and your account secure. Others help us
            understand how SparkL is used so we can improve it.{" "}
            <Link href="/privacy" className="font-medium text-indigo-500 hover:underline">
              Learn more
            </Link>
          </p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={() => choose("essential")}
          className="flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition"
          style={{
            borderColor: "var(--sp-border, #e5e7eb)",
            color: "var(--sp-text-2, #374151)",
            background: "var(--sp-bg-muted, #f9fafb)",
          }}
        >
          Reject non-essential
        </button>
        <button
          onClick={() => choose("all")}
          className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-500"
        >
          Accept all
        </button>
      </div>
    </div>
  );
}
