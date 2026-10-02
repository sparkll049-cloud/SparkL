// src/app/dashboard/subscribe/page.tsx
"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check, Sparkles, Zap, ArrowLeft, Loader2, CheckCircle2, Crown,
  ShieldCheck, CreditCard, X, Star, Clock, PartyPopper, BookOpen,
  Trophy, Infinity,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Checkout } from "payvessel-checkout";

const SERVICE_FEE = 100; // ₦100 flat service fee added to all plans

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
    icon: BookOpen,
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
    icon: Trophy,
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
    icon: Infinity,
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
const PAYVESSEL_CHANNELS = ["BANK_TRANSFER", "CARD"];

const planAccent: Record<string, {
  ring: string; badge: string; btn: string; glow: string;
  gradient: string; light: string; text: string;
}> = {
  basic: {
    ring: "ring-blue-500/40",
    badge: "bg-blue-600",
    btn: "bg-blue-600 hover:bg-blue-500",
    glow: "shadow-blue-500/15",
    gradient: "from-blue-600 to-blue-400",
    light: "bg-blue-500/10",
    text: "text-blue-500",
  },
  pro: {
    ring: "ring-indigo-500/40",
    badge: "bg-indigo-600",
    btn: "bg-indigo-600 hover:bg-indigo-500",
    glow: "shadow-indigo-500/25",
    gradient: "from-indigo-600 to-violet-500",
    light: "bg-indigo-500/10",
    text: "text-indigo-500",
  },
  premium: {
    ring: "ring-violet-500/40",
    badge: "bg-violet-600",
    btn: "bg-violet-600 hover:bg-violet-500",
    glow: "shadow-violet-500/15",
    gradient: "from-violet-600 to-fuchsia-500",
    light: "bg-violet-500/10",
    text: "text-violet-500",
  },
};

// ─── Congratulations modal ───────────────────────────────────────────────────

interface CongratsModalProps {
  planName: string;
  planSlug: string;
  expiresAt: string | null;
  onDone: () => void;
}

function CongratsModal({ planName, planSlug, expiresAt, onDone }: CongratsModalProps) {
  const [countdown, setCountdown] = useState(4);
  const accent = planAccent[planSlug] ?? planAccent.pro;

  const formatExpiry = (iso: string | null) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString("en-NG", {
        day: "numeric", month: "long", year: "numeric",
      });
    } catch { return null; }
  };

  useEffect(() => {
    const t = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearInterval(t); onDone(); return 0; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 backdrop-blur-md px-5">
      <div
        className="w-full max-w-sm rounded-3xl border overflow-hidden shadow-2xl"
        style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
      >
        <div className={`h-1 w-full bg-gradient-to-r ${accent.gradient}`} />

        <div className="px-7 py-8 text-center">
          <div className="flex justify-center mb-5">
            <div className={`relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br ${accent.gradient}`}>
              <PartyPopper className="h-9 w-9 text-white" />
              <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-emerald-500 border-2 border-[var(--sp-bg-card)] animate-bounce" />
            </div>
          </div>

          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-emerald-500 mb-2">
            Payment Confirmed
          </p>
          <h2 className="text-2xl font-extrabold tracking-tight mb-2" style={{ color: "var(--sp-text)" }}>
            You&apos;re on SparkL {planName}! 🎉
          </h2>
          <p className="text-sm mb-5 leading-relaxed" style={{ color: "var(--sp-text-3)" }}>
            Full access is now active for this semester. Go ace those exams.
          </p>

          <div
            className="inline-flex items-center gap-2.5 rounded-2xl border px-4 py-2.5 mb-4"
            style={{ background: "var(--sp-bg-muted)", borderColor: "var(--sp-border)" }}
          >
            <Crown className="h-4 w-4 text-amber-500" />
            <span className="text-sm font-bold capitalize" style={{ color: "var(--sp-text)" }}>
              {planName} Plan — Active
            </span>
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>

          {expiresAt && (
            <p className="text-xs mb-5" style={{ color: "var(--sp-text-3)" }}>
              Valid until{" "}
              <span className="font-semibold" style={{ color: "var(--sp-text-2)" }}>
                {formatExpiry(expiresAt)}
              </span>
            </p>
          )}

          <div
            className="rounded-2xl border p-4 mb-6 text-left space-y-2.5"
            style={{ background: "var(--sp-bg-muted)", borderColor: "var(--sp-border)" }}
          >
            {(PLANS.find((p) => p.slug === planSlug)?.perks ?? []).map((perk) => (
              <div key={perk} className="flex items-center gap-2.5">
                <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                  <Check className="h-2.5 w-2.5 text-emerald-500" />
                </div>
                <span className="text-xs" style={{ color: "var(--sp-text-2)" }}>{perk}</span>
              </div>
            ))}
          </div>

          <button
            onClick={onDone}
            className={`w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white bg-gradient-to-r ${accent.gradient} transition-opacity hover:opacity-90 active:scale-[0.98]`}
          >
            Go to Dashboard
          </button>
          <p className="mt-3 text-xs" style={{ color: "var(--sp-text-3)" }}>
            Redirecting in {countdown}s…
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Checkout summary modal ──────────────────────────────────────────────────

interface CheckoutSummaryProps {
  plan: typeof PLANS[0];
  user: { name: string; email: string; phone: string };
  onConfirm: () => void;
  onCancel: () => void;
  loading: boolean;
  isUpgrade: boolean;
}

function CheckoutSummary({ plan, user, onConfirm, onCancel, loading, isUpgrade }: CheckoutSummaryProps) {
  const accent = planAccent[plan.slug];
  const total = plan.price + SERVICE_FEE;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0">
      <div
        className="w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden"
        style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 pt-5 pb-4 border-b"
          style={{ borderColor: "var(--sp-border)" }}
        >
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <span className="text-sm font-bold" style={{ color: "var(--sp-text)" }}>
              Order Summary
            </span>
          </div>
          <button
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-red-500/10"
            style={{ background: "var(--sp-input-bg)" }}
            aria-label="Close"
          >
            <X className="h-4 w-4" style={{ color: "var(--sp-text-3)" }} />
          </button>
        </div>

        <div className="px-6 py-5">
          {isUpgrade && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-3 py-2.5">
              <Star className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-600 font-medium">
                Upgrading — your remaining days carry over
              </p>
            </div>
          )}

          {/* Plan card */}
          <div
            className={`flex items-center justify-between rounded-2xl border px-4 py-3.5 mb-4 ring-1 ${accent.ring}`}
            style={{ background: "var(--sp-input-bg)", borderColor: "var(--sp-border)" }}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${accent.light}`}>
                <plan.icon className={`h-4 w-4 ${accent.text}`} />
              </div>
              <div>
                <p className="text-sm font-bold capitalize" style={{ color: "var(--sp-text)" }}>
                  {plan.name} Plan
                </p>
                <p className="text-xs mt-0.5 flex items-center gap-1 text-emerald-600 font-medium">
                  <Clock className="h-3 w-3" /> 3 months access
                </p>
              </div>
            </div>
            <p className="text-lg font-extrabold" style={{ color: "var(--sp-text)" }}>
              ₦{plan.price.toLocaleString()}
            </p>
          </div>

          {/* Perks */}
          <div className="space-y-1.5 mb-5">
            {plan.perks.map((perk) => (
              <div key={perk} className="flex items-center gap-2">
                <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                  <Check className="h-2.5 w-2.5 text-emerald-500" />
                </div>
                <span className="text-xs" style={{ color: "var(--sp-text-2)" }}>{perk}</span>
              </div>
            ))}
          </div>

          {/* Paying as */}
          <div
            className="rounded-xl border px-4 py-3 mb-4"
            style={{ background: "var(--sp-input-bg)", borderColor: "var(--sp-border)" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--sp-text-3)" }}>
              Paying as
            </p>
            <div className="flex justify-between text-xs mb-1.5">
              <span style={{ color: "var(--sp-text-3)" }}>Name</span>
              <span className="font-semibold" style={{ color: "var(--sp-text)" }}>{user.name}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: "var(--sp-text-3)" }}>Email</span>
              <span className="font-semibold" style={{ color: "var(--sp-text)" }}>{user.email}</span>
            </div>
          </div>

          {/* Fee breakdown — the important bit */}
          <div
            className="rounded-xl border px-4 py-3 mb-5"
            style={{ background: "var(--sp-input-bg)", borderColor: "var(--sp-border)" }}
          >
            <div className="flex justify-between text-xs mb-2">
              <span style={{ color: "var(--sp-text-3)" }}>Plan fee</span>
              <span style={{ color: "var(--sp-text-2)" }}>₦{plan.price.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-xs mb-3">
              <span style={{ color: "var(--sp-text-3)" }}>
                Service fee
                <span className="ml-1 text-[10px] opacity-60">(processing)</span>
              </span>
              <span style={{ color: "var(--sp-text-2)" }}>₦{SERVICE_FEE.toLocaleString()}</span>
            </div>
            <div
              className="border-t pt-2.5 flex justify-between items-center"
              style={{ borderColor: "var(--sp-border)" }}
            >
              <span className="text-sm font-bold" style={{ color: "var(--sp-text)" }}>Total</span>
              <span className="text-xl font-extrabold" style={{ color: "var(--sp-text)" }}>
                ₦{total.toLocaleString()}
              </span>
            </div>
          </div>

          <button
            onClick={onConfirm}
            disabled={loading}
            className={`w-full flex items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${accent.btn}`}
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Opening payment…</>
            ) : (
              <><CreditCard className="h-4 w-4" />Pay ₦{total.toLocaleString()} with PayVessel</>
            )}
          </button>

          <p className="mt-3 text-center text-xs" style={{ color: "var(--sp-text-3)" }}>
            🔒 Secured by PayVessel · Card details never stored
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

function SubscribePageInner() {
  const supabaseClient = createClient();
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
  const [congratsData, setCongratsData] = useState<{
    planName: string; planSlug: string; expiresAt: string | null;
  } | null>(null);

  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { session } } = await supabaseClient.auth.refreshSession();
        if (!session) { router.push("/auth/login"); return; }

        const [profileRes, subRes] = await Promise.all([
          supabaseClient
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
          setCurrentPlan(subData.is_paid ? (subData.effective_plan ?? subData.plan ?? "free") : "free");
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

  function handleConfirmCheckout() {
    if (!user || !checkoutPlan) return;
    setError("");
    setProcessingPlan(checkoutPlan.slug);

    const plan = checkoutPlan;
    setCheckoutPlan(null);

    // Total charged = plan price + service fee
    const chargeAmount = plan.price + SERVICE_FEE;

    supabaseClient.auth.refreshSession().then(({ data: { session } }) => {
      if (!session) { router.push("/auth/login"); return; }

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
          const init = Checkout({ api_key: process.env.NEXT_PUBLIC_PAYVESSEL_PUBLIC_KEY! });

          init.initializeCheckout({
            amount: String(chargeAmount), // ← total with service fee
            currency: "NGN",
            customer_name: userName,
            customer_email: userEmail,
            ...(userPhone ? { customer_phone_number: userPhone } : {}),
            reference: ourReference,
            channels: PAYVESSEL_CHANNELS,
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
                  if (data.status === "success" || data.status === "already_verified") {
                    const planInfo = PLANS.find((p) => p.slug === planSlug);
                    setCurrentPlan(planSlug);
                    setCongratsData({
                      planName: planInfo?.name ?? planSlug,
                      planSlug,
                      expiresAt: data.expires_at ?? null,
                    });
                  } else {
                    setError(data.detail ?? "Verification failed. Please contact support.");
                  }
                })
                .catch(() => setError("Network error during verification. Please contact support."))
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

  function handleCongratsClose() {
    setCongratsData(null);
    router.push("/dashboard");
  }

  if (loadingUser) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" style={{ background: "var(--sp-bg)" }}>
        <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
      </div>
    );
  }

  const isPaid = PAID_PLANS.includes(currentPlan);
  const currentRank = PLAN_RANK[currentPlan] ?? 0;

  const formatExpiry = (iso: string | null) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString("en-NG", {
        day: "numeric", month: "long", year: "numeric",
      });
    } catch { return null; }
  };

  return (
    <div className="min-h-screen pb-20" style={{ background: "var(--sp-bg)" }}>

      {congratsData && (
        <CongratsModal
          planName={congratsData.planName}
          planSlug={congratsData.planSlug}
          expiresAt={congratsData.expiresAt}
          onDone={handleCongratsClose}
        />
      )}

      {checkoutPlan && user && (
        <CheckoutSummary
          plan={checkoutPlan}
          user={user}
          onConfirm={handleConfirmCheckout}
          onCancel={() => { setCheckoutPlan(null); setProcessingPlan(null); }}
          loading={!!processingPlan}
          isUpgrade={isPaid && PLAN_RANK[checkoutPlan.slug] > currentRank}
        />
      )}

      {/* ── Hero section ── */}
      <div
        className="relative px-5 pt-8 pb-10 border-b overflow-hidden"
        style={{ borderColor: "var(--sp-border)" }}
      >
        {/* Subtle background glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-4xl">
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 text-sm transition-colors mb-7 hover:text-indigo-500"
            style={{ color: "var(--sp-text-3)" }}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          {justSubscribed && !congratsData && (
            <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.08] px-5 py-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
              <div>
                <p className="text-sm font-semibold text-emerald-600">You&apos;re now subscribed!</p>
                <p className="text-xs mt-0.5" style={{ color: "var(--sp-text-3)" }}>
                  Your plan is active — enjoy full access this semester.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/15">
                  <Sparkles className="h-4 w-4 text-indigo-500" />
                </div>
                <span className="text-xs font-semibold text-indigo-500 tracking-wide">SparkL Premium</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight leading-tight" style={{ color: "var(--sp-text)" }}>
                {isPaid ? "Manage your plan" : "Unlock full access"}
              </h1>
              <p className="mt-2 text-sm max-w-md leading-relaxed" style={{ color: "var(--sp-text-3)" }}>
                {isPaid
                  ? `You're on ${currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}. Upgrade anytime for more.`
                  : "One payment covers a full semester — all courses, unlimited practice, instant access."}
              </p>
            </div>

            {isPaid && (
              <div
                className="shrink-0 flex items-center gap-3 rounded-2xl border border-indigo-500/25 bg-indigo-500/[0.07] px-4 py-3"
              >
                <Crown className="h-5 w-5 text-amber-500 shrink-0" />
                <div>
                  <p className="text-sm font-bold capitalize text-indigo-500">{currentPlan} Plan</p>
                  {expiresAt && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--sp-text-3)" }}>
                      Until {formatExpiry(expiresAt)}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 ml-1 rounded-full border border-emerald-500/25 bg-emerald-500/[0.10] px-2.5 py-1">
                  <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[11px] font-semibold text-emerald-600">Active</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-5 pt-8">

        {/* Free plan current limits */}
        {!isPaid && (
          <div
            className="mb-8 rounded-2xl border p-5"
            style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
          >
            <p className="text-xs font-semibold mb-4" style={{ color: "var(--sp-text-3)" }}>
              You&apos;re on the free plan — here&apos;s what&apos;s limited
            </p>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "3 courses", sub: "locked after that" },
                { label: "10 questions", sub: "read mode cap" },
                { label: "5 questions", sub: "practice mode cap" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border px-3 py-2.5 text-center"
                  style={{ background: "var(--sp-input-bg)", borderColor: "var(--sp-border)" }}
                >
                  <p className="text-sm font-bold" style={{ color: "var(--sp-text-2)" }}>{item.label}</p>
                  <p className="text-[11px] mt-0.5" style={{ color: "var(--sp-text-3)" }}>{item.sub}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/25 bg-red-500/[0.07] px-4 py-3">
            <p className="text-sm text-red-500">{error}</p>
          </div>
        )}

        {/* Plan cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => {
            const isCurrentPlan = currentPlan === plan.slug;
            const isProcessing = processingPlan === plan.slug;
            const isUpgrade = isPaid && PLAN_RANK[plan.slug] > currentRank;
            const isDowngrade = isPaid && PLAN_RANK[plan.slug] < currentRank;
            const accent = planAccent[plan.slug];
            const PlanIcon = plan.icon;
            const total = plan.price + SERVICE_FEE;

            return (
              <div
                key={plan.slug}
                className={`relative flex flex-col rounded-2xl border p-5 transition-all ${
                  plan.popular
                    ? `border-indigo-500/40 shadow-xl ${accent.glow}`
                    : "shadow-md"
                } ${isCurrentPlan ? `ring-2 ${accent.ring}` : ""}`}
                style={{
                  background: plan.popular
                    ? "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.05) 100%)"
                    : "var(--sp-bg-card)",
                  borderColor: plan.popular ? undefined : "var(--sp-border)",
                }}
              >
                {/* Badge */}
                {(plan.popular && !isCurrentPlan) && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className={`inline-flex items-center gap-1 rounded-full ${accent.badge} px-3 py-1 text-[10px] font-bold text-white uppercase tracking-wide shadow-lg`}>
                      <Zap className="h-2.5 w-2.5" fill="white" />
                      Most popular
                    </span>
                  </div>
                )}
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-[10px] font-bold text-white uppercase tracking-wide shadow-lg">
                      <CheckCircle2 className="h-2.5 w-2.5" />
                      Current
                    </span>
                  </div>
                )}

                {/* Plan header */}
                <div className="flex items-start justify-between mb-4 mt-2">
                  <div>
                    <div className={`flex h-9 w-9 items-center justify-center rounded-xl mb-3 ${accent.light}`}>
                      <PlanIcon className={`h-4 w-4 ${accent.text}`} />
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--sp-text-3)" }}>
                      {plan.name}
                    </p>
                    <p className="mt-0.5 text-[11px]" style={{ color: "var(--sp-text-3)" }}>
                      {plan.description}
                    </p>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-1">
                  <p className="text-3xl font-extrabold tracking-tight" style={{ color: "var(--sp-text)" }}>
                    {plan.priceLabel}
                    <span className="text-sm font-normal ml-1" style={{ color: "var(--sp-text-3)" }}>/sem</span>
                  </p>
                  <p className="text-[11px] mt-1 text-emerald-600 font-medium flex items-center gap-1">
                    <Clock className="h-3 w-3" /> 3 months · ₦{SERVICE_FEE} service fee applies
                  </p>
                </div>

                {/* Divider */}
                <div className="my-4 border-t" style={{ borderColor: "var(--sp-border)" }} />

                {/* Perks */}
                <ul className="flex-1 space-y-2.5 mb-5">
                  {plan.perks.map((perk) => (
                    <li key={perk} className="flex items-start gap-2.5 text-xs" style={{ color: "var(--sp-text-2)" }}>
                      <div className="flex h-4 w-4 shrink-0 mt-0.5 items-center justify-center rounded-full bg-emerald-500/15">
                        <Check className="h-2.5 w-2.5 text-emerald-500" />
                      </div>
                      {perk}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {isCurrentPlan ? (
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] py-2.5 text-xs font-semibold text-emerald-600">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Current plan
                  </div>
                ) : (
                  <button
                    onClick={() => { setError(""); setCheckoutPlan(plan); }}
                    disabled={!!processingPlan}
                    className={`flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] ${accent.btn}`}
                  >
                    {isProcessing ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />Processing…</>
                    ) : isUpgrade ? (
                      <><Star className="h-3.5 w-3.5" />Upgrade · ₦{total.toLocaleString()}</>
                    ) : isDowngrade ? (
                      <><Sparkles className="h-3.5 w-3.5" />Switch · ₦{total.toLocaleString()}</>
                    ) : (
                      <><Sparkles className="h-3.5 w-3.5" />Get {plan.name} · ₦{total.toLocaleString()}</>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 text-xs" style={{ color: "var(--sp-text-3)" }}>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            Secured by PayVessel
          </span>
          <span className="hidden sm:block opacity-40">·</span>
          <span>NGN only</span>
          <span className="hidden sm:block opacity-40">·</span>
          <span>₦{SERVICE_FEE} service fee per transaction</span>
          <span className="hidden sm:block opacity-40">·</span>
          <span>3-month access per plan</span>
        </div>
      </div>
    </div>
  );
}

export default function SubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center" style={{ background: "var(--sp-bg)" }}>
          <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
        </div>
      }
    >
      <SubscribePageInner />
    </Suspense>
  );
}
