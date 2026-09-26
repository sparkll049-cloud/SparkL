"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check, Sparkles, Zap, ArrowLeft, Loader2, CheckCircle2, Crown,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";

const PLANS = [
  {
    slug: "basic",
    name: "Basic",
    price: 500,
    priceLabel: "₦500",
    duration: "month",
    description: "Perfect for a single semester",
    perks: [
      "All courses unlocked",
      "Unlimited read mode",
      "Unlimited practice mode",
      "10 downloads/day",
    ],
    popular: false,
  },
  {
    slug: "pro",
    name: "Pro",
    price: 1000,
    priceLabel: "₦1,000",
    duration: "month",
    description: "Best for serious students",
    popular: true,
    perks: [
      "Everything in Basic",
      "All institutions access",
      "50 downloads/day",
      "Priority support",
    ],
  },
  {
    slug: "premium",
    name: "Premium",
    price: 2000,
    priceLabel: "₦2,000",
    duration: "month",
    description: "Full unlimited access",
    popular: false,
    perks: [
      "Everything in Pro",
      "Unlimited downloads",
      "Early access to new features",
      "Premium badge",
    ],
  },
];

const PAID_PLANS = ["basic", "pro", "premium"];

function SubscribePageInner() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const justSubscribed = searchParams.get("subscribed") === "true";

  const [user, setUser] = useState<{
    name: string;
    email: string;
    phone: string;
  } | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [loadingUser, setLoadingUser] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { session } } = await supabase.auth.refreshSession();
        if (!session) { router.push("/auth/login"); return; }

        const [profileRes, subRes] = await Promise.all([
          supabase
            .from("profiles")
            .select("full_name, phone, subscription_plan")
            .eq("id", session.user.id)
            .single(),
          fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/payments/subscription/status`,
            { headers: { Authorization: `Bearer ${session.access_token}` } }
          ),
        ]);

        setUser({
          name: profileRes.data?.full_name ?? "Student",
          email: session.user.email ?? "",
          phone: profileRes.data?.phone ?? "",
        });

        if (subRes.ok) {
          const subData = await subRes.json();
          setCurrentPlan(
            subData.is_paid ? (subData.effective_plan ?? subData.plan ?? "free") : "free"
          );
        } else {
          setCurrentPlan(profileRes.data?.subscription_plan ?? "free");
        }
      } catch (err) {
        console.error("[loadUser error]", err);
        setUser({ name: "Student", email: "", phone: "" });
      } finally {
        setLoadingUser(false);
      }
    }
    loadUser();
  }, []);

  async function handleSubscribe(planSlug: string, amount: number) {
    if (!user) return;
    setError("");
    setProcessingPlan(planSlug);

    try {
      const { data: { session } } = await supabase.auth.refreshSession();
      if (!session) { router.push("/auth/login"); return; }

      // Step 1 — create transaction reference on our backend
      const initiateRes = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/payments/initiate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ plan: planSlug }),
        }
      );

      if (!initiateRes.ok) {
        const err = await initiateRes.json();
        throw new Error(err.detail ?? "Failed to initiate payment");
      }

      const { reference: ourReference } = await initiateRes.json();

      // Step 2 — initialize checkout via our proxy (avoids CORS)
      const checkoutRes = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_email: user.email,
          customer_name: user.name,
          customer_phone_number: user.phone || "08000000000",
          amount: String(amount),
          currency: "NGN",
          reference: ourReference,
          channels: ["BANK_TRANSFER", "CARD"],
          metadata: { plan: planSlug, user_email: user.email },
        }),
      });

      if (!checkoutRes.ok) {
        const err = await checkoutRes.json();
        throw new Error(err.detail ?? err.message ?? "Checkout initialization failed");
      }

      const checkoutData = await checkoutRes.json();
      console.log("[Checkout init]", checkoutData);

      // Step 3 — redirect to PayVessel checkout URL
      const checkoutUrl =
        checkoutData?.data?.checkout_url ||
        checkoutData?.checkout_url ||
        checkoutData?.url;

      if (!checkoutUrl) {
        throw new Error("No checkout URL returned from PayVessel");
      }

      // Store reference in sessionStorage so we can verify after redirect
      sessionStorage.setItem("pv_reference", ourReference);
      sessionStorage.setItem("pv_plan", planSlug);
      sessionStorage.setItem("pv_access_token", session.access_token);

      // Redirect to PayVessel hosted checkout page
      window.location.href = checkoutUrl;

    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setProcessingPlan(null);
    }
  }

  if (loadingUser) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#07091A]">
        <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
      </div>
    );
  }

  const isPaid = PAID_PLANS.includes(currentPlan);

  return (
    <div className="min-h-screen bg-[#07091A] px-5 pb-16 pt-8">
      <div className="mx-auto max-w-4xl">

        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-300 transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        {justSubscribed && (
          <div className="mb-8 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-5 py-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
            <div>
              <p className="text-sm font-semibold text-emerald-300">You're now subscribed!</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Your plan is active — enjoy full access to all courses.
              </p>
            </div>
          </div>
        )}

        <div className="text-center mb-10">
          <div className="flex justify-center mb-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15">
              <Sparkles className="h-5 w-5 text-indigo-400" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            {isPaid ? "Manage Your Plan" : "Unlock SparkL Premium"}
          </h1>
          <p className="mt-2 text-sm text-slate-500 max-w-sm mx-auto">
            {isPaid
              ? `You're on the ${currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} plan. Upgrade anytime for more access.`
              : "Get unlimited access to all past questions, practice mode, and more across every course"}
          </p>
        </div>

        {isPaid ? (
          <div className="mb-8 flex items-center gap-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.06] px-5 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15">
              <Crown className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-indigo-300 capitalize">
                {currentPlan} Plan — Active
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                You have full access. Upgrade to a higher tier anytime below.
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-8 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
              Free plan (current)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: "3 courses only", sub: "Rest locked" },
                { label: "10 questions", sub: "Read mode" },
                { label: "5 questions max", sub: "Practice mode" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3"
                >
                  <p className="text-sm font-semibold text-slate-400">{item.label}</p>
                  <p className="text-xs text-slate-600 mt-0.5">{item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrentPlan = currentPlan === plan.slug;
            const isProcessing = processingPlan === plan.slug;

            return (
              <div
                key={plan.slug}
                className={`relative flex flex-col rounded-2xl border p-5 transition-all ${
                  plan.popular
                    ? "border-indigo-500/40 bg-indigo-500/[0.06]"
                    : "border-white/[0.07] bg-white/[0.02]"
                } ${isCurrentPlan ? "ring-2 ring-emerald-500/30" : ""}`}
              >
                {plan.popular && !isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-bold text-white uppercase tracking-wide">
                      <Zap className="h-2.5 w-2.5" fill="white" />
                      Most popular
                    </span>
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-bold text-white uppercase tracking-wide">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      Your plan
                    </span>
                  </div>
                )}

                <div className="mb-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {plan.name}
                  </p>
                  <p className="mt-1 text-3xl font-extrabold text-white">
                    {plan.priceLabel}
                    <span className="text-sm font-normal text-slate-500">/{plan.duration}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-600">{plan.description}</p>
                </div>

                <ul className="flex-1 space-y-2 mb-5">
                  {plan.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2 text-xs text-slate-400">
                      <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-400" />
                      {perk}
                    </li>
                  ))}
                </ul>

                {isCurrentPlan ? (
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 py-2.5 text-xs font-semibold text-emerald-400">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Current plan
                  </div>
                ) : (
                  <button
                    onClick={() => handleSubscribe(plan.slug, plan.price)}
                    disabled={!!processingPlan}
                    className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                      plan.popular
                        ? "bg-indigo-600 hover:bg-indigo-500"
                        : "bg-blue-600 hover:bg-blue-500"
                    }`}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Processing…
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-3.5 w-3.5" />
                        {isPaid ? `Switch to ${plan.name}` : `Get ${plan.name}`}
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-slate-600">
          Secure payments via PayVessel · Cancel anytime · NGN only
        </p>

      </div>
    </div>
  );
}

export default function SubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center bg-[#07091A]">
          <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
        </div>
      }
    >
      <SubscribePageInner />
    </Suspense>
  );
}