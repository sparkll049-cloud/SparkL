// src/app/dashboard/subscribe/page.tsx
"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Check, Sparkles, Zap, ArrowLeft, Loader2, CheckCircle2, Crown,
  ShieldCheck, CreditCard, X, Star, Clock, BookOpen, Brain, Trophy,
  FileText, MessageSquare, Infinity,
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
      "Early access to new features",
      "Premium badge",
    ],
  },
];

const PAID_PLANS = ["basic", "pro", "premium"];
const PLAN_RANK: Record<string, number> = { free: 0, basic: 1, pro: 2, premium: 3 };

const PAYVESSEL_CHANNELS = ["BANK_TRANSFER", "CARD"];

const planAccent: Record<string, { ring: string; badge: string; btn: string; glow: string; headerBg: string }> = {
  basic: {
    ring: "ring-blue-500/30",
    badge: "bg-blue-600",
    btn: "bg-blue-600 hover:bg-blue-500",
    glow: "shadow-blue-500/10",
    headerBg: "from-blue-600/10 to-transparent",
  },
  pro: {
    ring: "ring-indigo-500/40",
    badge: "bg-indigo-600",
    btn: "bg-indigo-600 hover:bg-indigo-500",
    glow: "shadow-indigo-500/25",
    headerBg: "from-indigo-600/15 to-transparent",
  },
  premium: {
    ring: "ring-violet-500/30",
    badge: "bg-violet-600",
    btn: "bg-violet-600 hover:bg-violet-500",
    glow: "shadow-violet-500/10",
    headerBg: "from-violet-600/10 to-transparent",
  },
};

// ─── Confetti ────────────────────────────────────────────────────────────────

const CONFETTI_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#10b981", "#f59e0b", "#3b82f6",
];

function ConfettiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = Array.from({ length: 160 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 8 + 4,
      d: Math.random() * 160 + 40,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      tilt: Math.random() * 10 - 10,
      tiltAngle: 0,
      tiltSpeed: Math.random() * 0.1 + 0.05,
    }));

    let angle = 0;
    let raf: number;

    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      angle += 0.01;

      for (const p of pieces) {
        p.tiltAngle += p.tiltSpeed;
        p.y += (Math.cos(angle + p.d) + 2) * 1.5;
        p.x += Math.sin(angle) * 1.2;
        p.tilt = Math.sin(p.tiltAngle - 1) * 12;

        ctx.beginPath();
        ctx.lineWidth = p.r / 2;
        ctx.strokeStyle = p.color;
        ctx.moveTo(p.x + p.tilt + p.r / 4, p.y);
        ctx.lineTo(p.x + p.tilt, p.y + p.tilt + p.r / 4);
        ctx.stroke();

        if (p.y > canvas.height) {
          p.x = Math.random() * canvas.width;
          p.y = -20;
        }
      }
      raf = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[60]"
      style={{ width: "100vw", height: "100vh" }}
    />
  );
}

// ─── Payment Success Overlay ──────────────────────────────────────────────────

interface PaymentSuccessOverlayProps {
  planName: string;
  onDone: () => void;
}

function PaymentSuccessOverlay({ planName, onDone }: PaymentSuccessOverlayProps) {
  useEffect(() => {
    const t = setTimeout(onDone, 4200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <>
      <ConfettiCanvas />
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md px-6 text-center">
        <div
          className="w-full max-w-sm rounded-3xl border border-white/10 p-8 shadow-2xl"
          style={{ background: "var(--sp-bg-card)" }}
        >
          {/* Trophy icon */}
          <div className="mb-5 flex justify-center">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-indigo-500/20">
              <Trophy className="h-9 w-9 text-indigo-400" />
              <span
                className="absolute -top-1 -right-1 text-2xl animate-bounce"
                style={{ animationDuration: "0.8s" }}
              >
                🎉
              </span>
            </div>
          </div>

          <h2
            className="text-2xl font-extrabold tracking-tight mb-2"
            style={{ color: "var(--sp-text)" }}
          >
            You&apos;re on {planName}!
          </h2>
          <p className="text-sm mb-1" style={{ color: "var(--sp-text-3)" }}>
            Subscription activated successfully.
          </p>
          <p className="text-sm font-semibold text-emerald-500 mb-6">
            Full access is yours for the semester 🚀
          </p>

          <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] py-2.5 text-xs font-semibold text-emerald-600">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Redirecting to dashboard…
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Checkout Summary ─────────────────────────────────────────────────────────

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
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm px-4 pb-4 sm:pb-0">
      <div
        className="w-full max-w-md rounded-3xl border shadow-2xl overflow-hidden"
        style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
      >
        <div
          className="flex items-center justify-between px-6 pt-6 pb-4 border-b"
          style={{ borderColor: "var(--sp-border)" }}
        >
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-semibold" style={{ color: "var(--sp-text)" }}>
              Secure Checkout
            </span>
          </div>
          <button
            onClick={onCancel}
            className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-indigo-500/10"
            style={{ background: "var(--sp-input-bg)" }}
            aria-label="Close"
          >
            <X className="h-4 w-4" style={{ color: "var(--sp-text-3)" }} />
          </button>
        </div>

        <div className="px-6 py-5">
          {isUpgrade && (
            <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-500/25 bg-amber-500/[0.08] px-3 py-2">
              <Star className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-600 font-medium">
                Upgrading plan — your remaining days carry over
              </p>
            </div>
          )}

          <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--sp-text-3)" }}>
            You&apos;re subscribing to
          </p>

          <div
            className="flex items-center justify-between rounded-2xl border px-4 py-3 mb-5"
            style={{ background: "var(--sp-input-bg)", borderColor: "var(--sp-border)" }}
          >
            <div>
              <p className="text-sm font-bold capitalize" style={{ color: "var(--sp-text)" }}>
                {plan.name} Plan
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--sp-text-3)" }}>
                {plan.description}
              </p>
            </div>
            <div className="text-right">
              <p className="text-lg font-extrabold" style={{ color: "var(--sp-text)" }}>
                ₦{plan.price.toLocaleString()}
              </p>
              <p className="text-xs" style={{ color: "var(--sp-text-3)" }}>per semester</p>
            </div>
          </div>

          <ul className="space-y-1.5 mb-5">
            {plan.perks.map((perk) => (
              <li key={perk} className="flex items-center gap-2 text-xs" style={{ color: "var(--sp-text-2)" }}>
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                {perk}
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-3 py-2 mb-5">
            <Clock className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <p className="text-xs text-emerald-600 font-medium">Valid for 3 months (one full semester)</p>
          </div>

          <div
            className="rounded-xl border px-4 py-3 mb-5 space-y-2"
            style={{ background: "var(--sp-input-bg)", borderColor: "var(--sp-border)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--sp-text-3)" }}>
              Paying as
            </p>
            <div className="flex justify-between text-xs">
              <span style={{ color: "var(--sp-text-3)" }}>Name</span>
              <span className="font-medium" style={{ color: "var(--sp-text)" }}>{user.name}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: "var(--sp-text-3)" }}>Email</span>
              <span className="font-medium" style={{ color: "var(--sp-text)" }}>{user.email}</span>
            </div>
          </div>

          <div
            className="rounded-xl border px-4 py-3 mb-6 space-y-2"
            style={{ background: "var(--sp-input-bg)", borderColor: "var(--sp-border)" }}
          >
            <div className="flex justify-between text-xs">
              <span style={{ color: "var(--sp-text-3)" }}>Plan fee</span>
              <span style={{ color: "var(--sp-text-2)" }}>₦{plan.price.toLocaleString()}</span>
            </div>
            <div className="border-t pt-2 flex justify-between text-sm font-bold" style={{ borderColor: "var(--sp-border)" }}>
              <span style={{ color: "var(--sp-text)" }}>Total</span>
              <span style={{ color: "var(--sp-text)" }}>₦{plan.price.toLocaleString()}</span>
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

          <p className="mt-3 text-center text-xs" style={{ color: "var(--sp-text-3)" }}>
            🔒 Secured by PayVessel · Your card details are never stored
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Feature comparison table ─────────────────────────────────────────────────

const FEATURES = [
  {
    icon: <BookOpen className="h-4 w-4" />,
    name: "Read Past Questions",
    desc: "Browse full past question papers by course and year",
    free: "10 questions (3 courses only)",
    paid: true,
  },
  {
    icon: <Brain className="h-4 w-4" />,
    name: "Practice Mode (Quiz)",
    desc: "Test yourself with timed, randomised question sets",
    free: "5 questions max",
    paid: true,
  },
  {
    icon: <Sparkles className="h-4 w-4" />,
    name: "AI Study Assistant",
    desc: "Upload your PDFs & notes — AI explains, drills, and teaches you",
    free: false,
    paid: true,
  },
  {
    icon: <FileText className="h-4 w-4" />,
    name: "Downloads",
    desc: "Save questions as PDF for offline study",
    free: false,
    paid: "10–unlimited/day",
  },
  {
    icon: <MessageSquare className="h-4 w-4" />,
    name: "All Institutions",
    desc: "Access questions from other polytechnics & universities",
    free: false,
    paid: "Pro & Premium",
  },
  {
    icon: <Infinity className="h-4 w-4" />,
    name: "All Courses",
    desc: "Every department and course unlocked",
    free: false,
    paid: true,
  },
];

function FeaturesSection() {
  return (
    <div
      className="mb-10 rounded-2xl border overflow-hidden"
      style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
    >
      <div className="px-5 pt-5 pb-3">
        <p className="text-sm font-bold" style={{ color: "var(--sp-text)" }}>What you get with SparkL</p>
        <p className="text-xs mt-0.5" style={{ color: "var(--sp-text-3)" }}>
          Three core tools to help you study smarter
        </p>
      </div>

      <div className="divide-y" style={{ borderColor: "var(--sp-border)" }}>
        {FEATURES.map((f) => (
          <div
            key={f.name}
            className="flex items-start gap-3 px-5 py-3.5"
          >
            <div
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500"
            >
              {f.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold" style={{ color: "var(--sp-text)" }}>
                {f.name}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--sp-text-3)" }}>
                {f.desc}
              </p>
            </div>
            <div className="shrink-0 flex flex-col items-end gap-1 ml-3">
              <div className="flex items-center gap-1">
                {f.free === false ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-500">
                    <X className="h-2.5 w-2.5" /> Free
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/10 px-2 py-0.5 text-[10px] font-medium" style={{ color: "var(--sp-text-3)" }}>
                    {f.free}
                  </span>
                )}
              </div>
              <div>
                {f.paid === true ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">
                    <Check className="h-2.5 w-2.5" /> Paid
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-500">
                    {f.paid}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

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
  const [successPlan, setSuccessPlan] = useState<string | null>(null);

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

  function handleConfirmCheckout() {
    if (!user || !checkoutPlan) return;
    setError("");
    setProcessingPlan(checkoutPlan.slug);

    const plan = checkoutPlan;
    setCheckoutPlan(null);

    supabase.auth.refreshSession().then(({ data: { session } }) => {
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
          const originalFetch = window.fetch.bind(window);
          window.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
            if (typeof input === "string" && input.includes("form.html")) {
              input = "/payvessel-form.html";
            }
            return originalFetch(input, init);
          };

          const init = Checkout({
            api_key: process.env.NEXT_PUBLIC_PAYVESSEL_PUBLIC_KEY!,
          });

          init.initializeCheckout({
            amount: String(plan.price),
            currency: "NGN",
            customer_name: userName,
            customer_email: userEmail,
            ...(userPhone ? { customer_phone_number: userPhone } : {}),
            reference: ourReference,
            channels: PAYVESSEL_CHANNELS,
            metadata: { plan: planSlug, name: userName },

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            onSuccessfulOrder: (response: any) => {
              window.fetch = originalFetch;

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
                    const planName =
                      PLANS.find((p) => p.slug === planSlug)?.name ?? planSlug;
                    setCurrentPlan(planSlug);
                    setSuccessPlan(planName);
                  } else {
                    setError(data.detail ?? "Verification failed. Please contact support.");
                  }
                })
                .catch(() => setError("Network error during verification. Please contact support."))
                .finally(() => setProcessingPlan(null));
            },

            onError: (err: unknown) => {
              window.fetch = originalFetch;
              console.error("[PayVessel error]", err);
              setError("Payment failed. Please try again.");
              setProcessingPlan(null);
            },

            onClose: () => {
              window.fetch = originalFetch;
              setProcessingPlan(null);
            },
          });
        })
        .catch((err: Error) => {
          setError(err.message ?? "Something went wrong.");
          setProcessingPlan(null);
        });
    });
  }

  // Success overlay redirect handler
  function handleSuccessRedirect() {
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
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return null;
    }
  };

  return (
    <div className="min-h-screen px-5 pb-20 pt-8" style={{ background: "var(--sp-bg)" }}>

      {/* Payment success celebration overlay */}
      {successPlan && (
        <PaymentSuccessOverlay
          planName={successPlan}
          onDone={handleSuccessRedirect}
        />
      )}

      {/* Checkout confirmation sheet */}
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

      <div className="mx-auto max-w-4xl">

        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm transition-colors mb-8 hover:text-indigo-500"
          style={{ color: "var(--sp-text-3)" }}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        {/* Old URL-based success banner (fallback, e.g. from webhook redirect) */}
        {justSubscribed && !successPlan && (
          <div className="mb-8 flex items-center gap-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.08] px-5 py-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
            <div>
              <p className="text-sm font-semibold text-emerald-600">You&apos;re now subscribed!</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--sp-text-3)" }}>
                Your plan is active — enjoy full access to all courses this semester.
              </p>
            </div>
          </div>
        )}

        {/* Page header */}
        <div className="text-center mb-10">
          <div className="flex justify-center mb-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/15">
              <Sparkles className="h-5 w-5 text-indigo-500" />
            </div>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight" style={{ color: "var(--sp-text)" }}>
            {isPaid ? "Manage Your Plan" : "Unlock SparkL Premium"}
          </h1>
          <p className="mt-2 text-sm max-w-sm mx-auto" style={{ color: "var(--sp-text-3)" }}>
            {isPaid
              ? `You're on the ${currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} plan. Upgrade anytime for more access.`
              : "Past questions, practice mode, and AI study tools — all for less than a textbook."}
          </p>
        </div>

        {/* Current plan banner (paid users) */}
        {isPaid && (
          <div className="mb-8 flex items-center gap-4 rounded-2xl border border-indigo-500/25 bg-indigo-500/[0.07] px-5 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15">
              <Crown className="h-5 w-5 text-indigo-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-indigo-600 capitalize">
                {currentPlan} Plan — Active
              </p>
              {expiresAt && (
                <p className="text-xs mt-0.5" style={{ color: "var(--sp-text-3)" }}>
                  Expires {formatExpiry(expiresAt)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/[0.10] px-3 py-1">
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-semibold text-emerald-600">Active</span>
            </div>
          </div>
        )}

        {/* Features comparison */}
        <FeaturesSection />

        {/* Free tier limits (only for free users) */}
        {!isPaid && (
          <div
            className="mb-8 rounded-2xl border p-5"
            style={{ background: "var(--sp-bg-card)", borderColor: "var(--sp-border)" }}
          >
            <p className="text-xs font-semibold mb-4" style={{ color: "var(--sp-text-3)" }}>
              Your current limits on Free
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { icon: <BookOpen className="h-3.5 w-3.5" />, label: "3 courses only", sub: "Rest locked behind paywall" },
                { icon: <FileText className="h-3.5 w-3.5" />, label: "10 questions", sub: "Read mode per course" },
                { icon: <Brain className="h-3.5 w-3.5" />, label: "5 practice questions", sub: "Practice mode per session" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-start gap-2.5 rounded-xl border px-4 py-3"
                  style={{ background: "var(--sp-input-bg)", borderColor: "var(--sp-border)" }}
                >
                  <span className="mt-0.5 shrink-0 text-amber-500">{item.icon}</span>
                  <div>
                    <p className="text-xs font-semibold" style={{ color: "var(--sp-text-2)" }}>
                      {item.label}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--sp-text-3)" }}>{item.sub}</p>
                  </div>
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
                className={`relative flex flex-col rounded-2xl border overflow-hidden transition-all shadow-lg ${
                  plan.popular ? `border-indigo-500/40 ${accent.glow}` : ""
                } ${isCurrentPlan ? `ring-2 ${accent.ring}` : ""}`}
                style={{
                  background: plan.popular ? "rgba(99,102,241,0.07)" : "var(--sp-bg-card)",
                  borderColor: plan.popular ? undefined : "var(--sp-border)",
                }}
              >
                {/* Gradient header stripe */}
                <div className={`h-1.5 w-full bg-gradient-to-r ${accent.headerBg.replace("from-", "from-").replace("to-transparent", "to-transparent")}`}
                  style={{
                    background: plan.slug === "basic"
                      ? "linear-gradient(90deg, #3b82f6 0%, transparent 100%)"
                      : plan.slug === "pro"
                      ? "linear-gradient(90deg, #6366f1 0%, transparent 100%)"
                      : "linear-gradient(90deg, #8b5cf6 0%, transparent 100%)",
                  }}
                />

                <div className="p-5 flex flex-col flex-1">
                  {plan.popular && !isCurrentPlan && (
                    <div className="absolute -top-0 right-4 mt-2">
                      <span className={`inline-flex items-center gap-1 rounded-full ${accent.badge} px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide`}>
                        <Zap className="h-2.5 w-2.5" fill="white" />
                        Most popular
                      </span>
                    </div>
                  )}
                  {isCurrentPlan && (
                    <div className="absolute top-3 right-4">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wide">
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        Active
                      </span>
                    </div>
                  )}

                  <div className="mb-4 mt-1">
                    <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--sp-text-3)" }}>
                      {plan.name}
                    </p>
                    <p className="mt-1 text-3xl font-extrabold" style={{ color: "var(--sp-text)" }}>
                      {plan.priceLabel}
                      <span className="text-sm font-normal" style={{ color: "var(--sp-text-3)" }}>/sem</span>
                    </p>
                    <p className="mt-1 text-xs" style={{ color: "var(--sp-text-3)" }}>{plan.description}</p>
                    <p className="mt-1 text-xs text-emerald-600 font-medium flex items-center gap-1">
                      <Clock className="h-3 w-3" /> 3 months access
                    </p>
                  </div>

                  <ul className="flex-1 space-y-2 mb-5">
                    {plan.perks.map((perk) => (
                      <li key={perk} className="flex items-start gap-2 text-xs" style={{ color: "var(--sp-text-2)" }}>
                        <Check className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-500" />
                        {perk}
                      </li>
                    ))}
                  </ul>

                  {isCurrentPlan ? (
                    <div className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.08] py-2.5 text-xs font-semibold text-emerald-600">
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
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs" style={{ color: "var(--sp-text-3)" }}>
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
        <div className="flex min-h-[60vh] items-center justify-center" style={{ background: "var(--sp-bg)" }}>
          <Loader2 className="h-7 w-7 animate-spin text-indigo-500" />
        </div>
      }
    >
      <SubscribePageInner />
    </Suspense>
  );
}
