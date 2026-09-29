// app/auth/complete-profile/page.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { User, Mail, Phone, ArrowRight } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getProfileStatus, PHONE_REGEX, safeNext } from "@/utils/profile";
import { Button } from "@/components/ui/button";

const inputClass =
  "ml-3 min-w-0 w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none";

const fieldBoxClass =
  "flex h-12 items-center rounded-xl border border-slate-200 bg-white px-3.5 transition-all duration-200 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10";

function CompleteProfileForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const next = safeNext(searchParams.get("next"));

  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Load the signed-in user and prefill whatever Google (or signup) gave us.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (cancelled) return;

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      const meta = (user.user_metadata ?? {}) as Record<string, string | undefined>;

      // Also look at the existing profile row in case it has partial data.
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      setUserId(user.id);
      setEmail(user.email ?? "");
      setFullName(
        (profile?.full_name && profile.full_name.trim().toLowerCase() !== "unnamed"
          ? profile.full_name
          : meta.full_name || meta.name) ?? ""
      );
      setPhone(profile?.phone || meta.phone || "");
      setChecking(false);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const phoneValid = PHONE_REGEX.test(phone.trim());
  const formValid = fullName.trim() !== "" && phoneValid && agreedToTerms;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg("");
    if (!formValid || saving || !userId) return;

    setSaving(true);

    const cleanName = fullName.trim();
    const cleanPhone = phone.trim();

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({ id: userId, full_name: cleanName, phone: cleanPhone }, { onConflict: "id" });

    if (profileError) {
      setSaving(false);
      setErrorMsg("Could not save your details. Please try again.");
      return;
    }

    // Keep auth metadata in sync so it matches email signups.
    await supabase.auth.updateUser({
      data: { full_name: cleanName, phone: cleanPhone },
    });

    const status = await getProfileStatus(supabase, userId);
    router.replace(status.onboardingCompleted ? next : "/onboarding");
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  if (checking) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-500">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-slate-50">
      <div className="mx-auto flex min-h-dvh w-full max-w-md items-center px-5 py-8">
        <div className="w-full">
          <Link href="/" aria-label="SparkL home" className="mb-8 inline-flex">
            <Image
              src="/images/logo.jpg"
              alt="SparkL"
              width={48}
              height={48}
              priority
              className="h-11 w-auto object-contain"
            />
          </Link>

          <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-blue-600">
            Almost there
          </p>
          <h1 className="text-3xl font-black tracking-[-0.035em] text-slate-950">
            Complete your profile
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            We need a few details to finish setting up your SparkL account.
          </p>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4" autoComplete="on">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Full name
              </label>
              <div className={fieldBoxClass}>
                <User className="h-[18px] w-[18px] shrink-0 text-slate-400" />
                <input
                  type="text"
                  name="name"
                  autoComplete="name"
                  placeholder="Your full name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Email address
              </label>
              <div className={`${fieldBoxClass} bg-slate-100`}>
                <Mail className="h-[18px] w-[18px] shrink-0 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  readOnly
                  className={`${inputClass} cursor-not-allowed text-slate-500`}
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Phone number
              </label>
              <div className={fieldBoxClass}>
                <Phone className="h-[18px] w-[18px] shrink-0 text-slate-400" />
                <input
                  type="tel"
                  name="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="08012345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={inputClass}
                />
              </div>
              {phone && !phoneValid && (
                <p className="mt-1.5 text-xs text-red-500">
                  Enter a valid Nigerian phone number.
                </p>
              )}
            </div>

            <label className="flex items-start gap-3 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600"
              />
              <span>
                I agree to the{" "}
                <Link href="/terms" className="font-semibold text-blue-600 hover:underline">
                  Terms
                </Link>{" "}
                and{" "}
                <Link
                  href="/privacy-policy"
                  className="font-semibold text-blue-600 hover:underline"
                >
                  Privacy Policy
                </Link>
                .
              </span>
            </label>

            {errorMsg && (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {errorMsg}
              </p>
            )}

            <Button
              type="submit"
              disabled={!formValid || saving}
              className="h-12 w-full rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Continue"}
              {!saving && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Not you?{" "}
            <button
              type="button"
              onClick={handleSignOut}
              className="font-semibold text-blue-600 hover:underline"
            >
              Sign out
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function CompleteProfilePage() {
  return (
    <Suspense fallback={null}>
      <CompleteProfileForm />
    </Suspense>
  );
}
