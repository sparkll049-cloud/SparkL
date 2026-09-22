"use client";

import Link from "next/link";
import { Lock, Sparkles, ArrowRight } from "lucide-react";

export function PaymentGatewayWidget() {
  return (
    <div className="rounded-2xl border border-indigo-500/25 bg-indigo-500/[0.05] p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/15">
          <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
        </div>
        <div>
          <p className="text-xs font-bold" style={{ color: "var(--sp-text)" }}>
            SparkL Premium
          </p>
          <p className="text-[10px]" style={{ color: "var(--sp-text-3)" }}>
            Unlock everything
          </p>
        </div>
      </div>

      <p className="text-[11px] leading-relaxed mb-3" style={{ color: "var(--sp-text-3)" }}>
        You're on the free plan — limited to 3 courses, 10% of questions in read mode,
        and 5 questions in practice mode.
      </p>

      <div className="space-y-1.5 mb-4">
        {[
          "All courses unlocked",
          "Unlimited read & practice",
          "From ₦500/month",
        ].map((item) => (
          <div key={item} className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
            <span className="text-[11px]" style={{ color: "var(--sp-text-3)" }}>
              {item}
            </span>
          </div>
        ))}
      </div>

      <Link
        href="/dashboard/subscribe"
        className="flex items-center justify-center gap-2 w-full rounded-xl bg-indigo-600 py-2.5 text-[11px] font-bold text-white hover:bg-indigo-500 transition-colors"
      >
        <Sparkles className="h-3 w-3" />
        View plans
        <ArrowRight className="h-3 w-3" />
      </Link>
    </div>
  );
}