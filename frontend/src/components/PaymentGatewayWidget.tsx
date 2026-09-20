"use client";

import { Lock, Sparkles } from "lucide-react";

export function PaymentGatewayWidget() {
  return (
    <div className="rounded-2xl border border-dashed border-indigo-500/25 bg-indigo-500/[0.05] p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/15">
          <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
        </div>
        <div>
          <p className="text-xs font-bold" style={{ color: "var(--sp-text)" }}>
            SparkL Premium
          </p>
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-400 uppercase tracking-wide">
            Coming soon
          </span>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed" style={{ color: "var(--sp-text-3)" }}>
        Unlock unlimited past questions, priority access, and more. We&apos;re finalising our payment setup — check back soon.
      </p>

      <div className="mt-3 flex items-center gap-1.5 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
        <Lock className="h-3 w-3 text-indigo-400/60" />
        <span className="text-[10px] font-medium" style={{ color: "var(--sp-text-3)" }}>
          Secure payments — coming soon
        </span>
      </div>

      <button
        disabled
        className="mt-3 w-full cursor-not-allowed rounded-xl bg-indigo-600/40 py-2.5 text-[11px] font-bold text-white/40"
      >
        Subscribe — Available soon
      </button>
    </div>
  );
}