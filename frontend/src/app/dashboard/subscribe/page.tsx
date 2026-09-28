// src/app/dashboard/subscribe/page.tsx
"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check, Sparkles, Zap, ArrowLeft, Loader2, CheckCircle2, Crown,
  ShieldCheck, CreditCard, X, Star, Clock,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Checkout } from "payvessel-checkout";

const PLANS = [
  {
    slug: "basic",
    name: "Basic",
    price: 2000,
    priceLabel: "₦2,000",
    duration: "semester",
    durationLabel: "3 months",
    description: "Perfect for a single semester",
    color: "blue",
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
    price: 3500,
    priceLabel: "₦3,500",
    duration: "semester",
    durationLabel: "3 months",
    description: "Best for serious students",
    color: "indigo",
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
    price: 5000,
    priceLabel: "₦5,000",
    duration: "semester",
    durationLabel: "3 months",
    description: "Full unlimited access",
    color: "violet",
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
const PLAN_RANK: Record<string, number> = { free: 0, basic: 1, pro: 2, premium: 3 };

// PayVessel channels must be UPPERCASE. Valid values: "BANK_TRANSFER", "CARD".
// Add "CARD" here once card payments are enabled on your PayVessel account.
const PAYVESSEL_CHANNELS = ["BANK_TRANSFER","CARD"];

const planAccent: Record<string, { ring: string; badge: string; btn: string; glow: string }> = {
  basic: {
    ring: "ring-blue-500/30",
    badge: "bg-blue-600",
    btn: "bg-blue-600 hover:bg-blue-500",
    glow: "shadow-blue-500/10",
  },
  pro: {
    ring: "ring-indigo-500/30",
    badge: "bg-indigo-600",
    btn: "bg-indigo-600 hover:bg-indigo-500",
    glow: "shadow-indigo-500/20",
  },
  premium: {
    ring: "ring-violet-500/30",
    badge: "bg-violet-600",
    btn: "bg-violet-600 hover:bg-violet-500",
    glow: "shadow-violet-500/10",
  },
};

interface CheckoutSummaryProps {
  plan: typeof PLANS[0];
  user: { name: string; email: string; phone: string };
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  isUpgrade: boolean;
}

function CheckoutSummary({
  plan,
  user,
  onConfirm,
  onCancel,
  loading,
  isUpgrade,
}: CheckoutSummaryProps) {
  const accent = planAccent[plan.slug];
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm px-4 pb-4 sm:pb-0">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0D1130] shadow-2xl overflow-hidden">

        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-semibold text-white">Secure Checkout</span>
          </div>
          <button
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/[0.06] hover:bg-white/10 transition-colors"
          >
            <X className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        <div className="px-6 py-5">
          {isUpgrade && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2">
              <Star className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <p className="text-xs text-amber-300 font-medium">
                Upgrading plan — your remaining days carry over
              </p>
            </div>
          )}

          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            You&apos;re subscribing to
          </p>

          <div className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 mb-5">
            <div>
              <p className="text-sm font-bold text-white capitalize">{plan.name} Plan</p>
              <p className="text-xs text-slate-500 mt-0.5">{plan.description}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-extrabold text-white">₦{plan.price.toLocaleString()}</p>
              <p className="text-xs text-slate-500">per semester</p>
            </div>
          </div>

          <ul className="space-y-1.5 mb-5">
            {plan.perks.map((perk) => (
              <li key={perk} className="flex items-center gap-2 text-xs text-slate-400">
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                {perk}
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/15 bg-emerald-500/[0.05] px-3 py-2 mb-5">
            <Clock className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <p className="text-xs text-emerald-300 font-medium">
              Valid for 3 months (one full semester)
            </p>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 mb-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
              Paying as
            </p>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Name</span>
              <span className="text-slate-300 font-medium">{user.name}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Email</span>
              <span className="text-slate-300 font-medium">{user.email}</span>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 mb-6 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-slate-500">Plan fee</span>
              <span className="text-slate-300">₦{plan.price.toLocaleString()}</span>
            </div>
            <div className="border-t border-white/[0.06] pt-2 flex justify-between text-sm font-bold">
              <span className="text-white">Total</span>
              <span className="text-white">₦{plan.price.toLocaleString()}</span>
            </div>
          </div>

          <button
            onClick={onConfirm}
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${accent.btn}`}
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Opening payment…</>
            ) : (
              <><CreditCard className="h-4 w-4" />Pay ₦{plan.price.toLocaleString()} with PayVessel</>
            )}
          </button>

          <p className="mt-3 text-center text-xs text-slate-600">
            🔒 Secured by PayVessel · Your card details are never stored
          </p>
        </div>
      </div>
    </div>
  );
}

function SubscribePageInner() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const justSubscribed = searchParams.get("subscribed") === "true";

  const [user, setUser] = useState<{ name: string; email: string; phone: string } | null>(null);
  const [currentPlan, setCurrentPlan] = useState<string>("free");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [checkoutPlan, setCheckoutPlan] = useState<typeof PLANS[0] | null>(null);

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
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/payments/subscription/status`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
        ]);

        setUser({
          name: profileRes.data?.full_name ?? "Student",
          email: session.user.email ?? "",
          phone: profileRes.data?.phone ?? "",
        });

        if (subRes.ok) {
          const subData = await subRes.json();
          setCurrentPlan(
            subData.is_paid
              ? (subData.effective_plan ?? subData.plan ?? "free")
              : "free"
          );
          setExpiresAt(subData.expires_at ?? null);
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

  // Plain function — NOT async, NO await on initializeCheckout
  function handleConfirmCheckout() {
    if (!user || !checkoutPlan) return;
    setError("");
    setProcessingPlan(checkoutPlan.slug);

    const plan = checkoutPlan;
    setCheckoutPlan(null);

    supabase.auth.refreshSession().then(({ data: { session } }) => {
      if (!session) {
        router.push("/auth/login");
        return;
      }

      const accessToken = session.access_token;
      const planSlug = plan.slug;
      const userName = user.name;
      const userEmail = user.email;
      const userPhone = user.phone;

      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/payments/initiate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ plan: planSlug }),
      })
        .then((res) => {
          if (!res.ok) {
            return res.json().then((e) =>
              Promise.reject(new Error(e.detail ?? "Failed to initiate payment"))
            );
          }
          return res.json();
        })
        .then(({ reference: ourReference }) => {
          const init = Checkout({
            api_key: process.env.NEXT_PUBLIC_PAYVESSEL_PUBLIC_KEY!,
          });

          // NOT awaited — initializeCheckout is callback-based, not a Promise
          init.initializeCheckout({
            amount: String(plan.price),
            currency: "NGN",
            customer_name: userName,
            customer_email: userEmail,
            // Only send phone if we have one (remove this line if PayVessel rejects it)
            ...(userPhone ? { customer_phone_number: userPhone } : {}),
            reference: ourReference,
            channels: PAYVESSEL_CHANNELS, // UPPERCASE: "BANK_TRANSFER" | "CARD"
            metadata: { plan: planSlug, name: userName },

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onSuccessfulOrder: (response: any) => {
              const ref =
                response.reference ??
                response.transactionReference ??
                response.data?.reference ??
                ourReference;

              fetch("/api/payments/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  reference: ref,
                  our_reference: ourReference,
                  access_token: accessToken,
                }),
              })
                .then((r) => r.json())
                .then((data) => {
                  if (
                    data.status === "success" ||
                    data.status === "already_verified"
                  ) {
                    setCurrentPlan(planSlug);
                    router.push("/dashboard/subscribe?subscribed=true");
                  } else {
                    setError(
                      data.detail ?? "Verification failed. Please contact support."
                    );
                  }
                })
                .catch(() =>
                  setError(
                    "Network error during verification. Please contact support."
                  )
                )
                .finally(() => setProcessingPlan(null));
            },

            onError: (err: unknown) => {
              console.error("[PayVessel error]", err);
              setError("Payment failed. Please try again.");
              setProcessingPlan(null);
            },

            onClose: () => setProcessingPlan(null),
          });
        })
        .catch((err: Error) => {
          setError(err.message ?? "Something went wrong.");
          setProcessingPlan(null);
        });
    });
  }

  if (loadingUser) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#07091A]">
        <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
      </div>
    );
  }

  const isPaid = PAID_PLANS.includes(currentPlan);
  const currentRank = PLAN_RANK[currentPlan] ?? 0;

  const formatExpiry = (iso: string | null) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString("en-NG", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return null;
    }
  };

  return (
    <div className="min-h-screen bg-[#07091A] px-5 pb-20 pt-8">

      {checkoutPlan && user && (
        <CheckoutSummary
          plan={checkoutPlan}
          user={user}
          onConfirm={handleConfirmCheckout}
          onCancel={() => {
            setCheckoutPlan(null);
            setProcessingPlan(null);
          }}
          loading={!!processingPlan}
          isUpgrade={isPaid && PLAN_RANK[checkoutPlan.slug] > currentRank}
        />
      )}

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
              <p className="text-sm font-semibold text-emerald-300">
                You&apos;re now subscribed!
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                Your plan is active — enjoy full access to all courses this semester.
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
              : "Get unlimited access to all past questions, practice mode, and more — valid for a full semester."}
          </p>
        </div>

        {isPaid && (
          <div className="mb-8 flex items-center gap-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/[0.06] px-5 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15">
              <Crown className="h-5 w-5 text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-indigo-300 capitalize">
                {currentPlan} Plan — Active
              </p>
              {expiresAt && (
                <p className="text-xs text-slate-500 mt-0.5">
                  Expires {formatExpiry(expiresAt)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.08] px-3 py-1">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-400">Active</span>
            </div>
          </div>
        )}

        {!isPaid && (
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

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrentPlan = currentPlan === plan.slug;
            const isProcessing = processingPlan === plan.slug;
            const isUpgrade = isPaid && PLAN_RANK[plan.slug] > currentRank;
            const isDowngrade = isPaid && PLAN_RANK[plan.slug] < currentRank;
            const accent = planAccent[plan.slug];

            return (
              <div
                key={plan.slug}
                className={`relative flex flex-col rounded-2xl border p-5 transition-all shadow-lg ${
                  plan.popular
                    ? `border-indigo-500/40 bg-indigo-500/[0.06] ${accent.glow}`
                    : "border-white/[0.07] bg-white/[0.02]"
                } ${isCurrentPlan ? `ring-2 ${accent.ring}` : ""}`}
              >
                {plan.popular && !isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full ${accent.badge} px-3 py-1 text-[10px] font-bold text-white uppercase tracking-wide`}
                    >
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

                <div className="mb-4 mt-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {plan.name}
                  </p>
                  <p className="mt-1 text-3xl font-extrabold text-white">
                    {plan.priceLabel}
                    <span className="text-sm font-normal text-slate-500">/sem</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-600">{plan.description}</p>
                  <p className="mt-1 text-xs text-emerald-400 font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3" /> 3 months access
                  </p>
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
                    onClick={() => { setError(""); setCheckoutPlan(plan); }}
                    disabled={!!processingPlan}
                    className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${accent.btn}`}
                  >
                    {isProcessing ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />Processing…</>
                    ) : isUpgrade ? (
                      <><Star className="h-3.5 w-3.5" />Upgrade to {plan.name}</>
                    ) : isDowngrade ? (
                      <><Sparkles className="h-3.5 w-3.5" />Switch to {plan.name}</>
                    ) : (
                      <><Sparkles className="h-3.5 w-3.5" />Get {plan.name}</>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-slate-600">
          Secure payments via PayVessel · NGN only · 3-month access per subscription
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
