"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Check,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";

const inputClass =
  "ml-3 min-w-0 w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none";

const fieldBoxClass =
  "flex h-12 items-center rounded-xl border border-slate-200 bg-white px-3.5 transition-all duration-200 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10";

/* Defined OUTSIDE SignupPage so inputs keep focus while typing */
function Field({
  label,
  icon,
  children,
  hint,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </label>

      <div className={fieldBoxClass}>
        {icon}
        {children}
      </div>

      {hint}
    </div>
  );
}

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const phoneValid = /^(\+234|0)?[789][01]\d{8}$/.test(phone);

  const hasMinLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);

  const passwordsMatch =
    password === confirmPassword && confirmPassword !== "";

  const formValid =
    fullName.trim() !== "" &&
    phoneValid &&
    emailValid &&
    hasMinLength &&
    hasUpperCase &&
    hasNumber &&
    hasSpecial &&
    passwordsMatch &&
    agreedToTerms;

  const strengthScore = [
    hasMinLength,
    hasUpperCase,
    hasNumber,
    hasSpecial,
  ].filter(Boolean).length;

  const strength =
    strengthScore <= 1
      ? { label: "Weak", color: "bg-red-500", width: "w-1/4" }
      : strengthScore <= 3
      ? { label: "Fair", color: "bg-amber-400", width: "w-2/4" }
      : { label: "Strong", color: "bg-emerald-500", width: "w-full" };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setErrorMsg("");

    if (!formValid || loading || googleLoading) return;

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
        },
      },
    });

    setLoading(false);

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    if (data.user) {
      router.push("/onboarding");
    }
  };

  const handleGoogleSignup = async () => {
    setErrorMsg("");
    setGoogleLoading(true);

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });

    if (error) {
      setGoogleLoading(false);
      setErrorMsg(error.message);
    }
  };

  return (
    <main className="min-h-dvh bg-slate-50">
      <div className="grid min-h-dvh lg:h-dvh lg:grid-cols-[42%_58%]">
        {/* =========================================================
            LEFT BRAND PANEL
        ========================================================= */}
        <aside className="relative hidden overflow-hidden bg-[#2563EB] lg:flex lg:flex-col lg:justify-between">
          {/* Decorative background */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/10 blur-3xl" />

            <div className="absolute -bottom-40 -left-32 h-[500px] w-[500px] rounded-full bg-blue-900/20 blur-3xl" />

            <div
              className="absolute inset-0 opacity-[0.06]"
              style={{
                backgroundImage:
                  "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
                backgroundSize: "56px 56px",
              }}
            />
          </div>

          {/* Logo */}
          <div className="relative z-10 px-12 pt-10">
            <Link
              href="/"
              className="inline-flex items-center"
              aria-label="SparkL home"
            >
              <Image
                src="/images/logo-white.png"
                alt="SparkL"
                width={120}
                height={44}
                priority
                className="h-10 w-auto object-contain"
              />
            </Link>
          </div>

          {/* Main message */}
          <div className="relative z-10 px-12">
            <div className="max-w-md">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-blue-50">
                <ShieldCheck className="h-3.5 w-3.5" />
                Built for Nigerian students
              </div>

              <h2 className="text-5xl font-black leading-[1.02] tracking-[-0.04em] text-white">
                Study smarter.
                <br />
                Prepare better.
              </h2>

              <p className="mt-6 max-w-sm text-sm leading-7 text-blue-100">
                Create your SparkL account and get access to past questions,
                academic resources, and a community built around learning.
              </p>

              <div className="mt-8 space-y-3">
                {[
                  "Find past questions by course",
                  "Ask and answer academic questions",
                  "Build a better study routine",
                ].map((item) => (
                  <div
                    key={item}
                    className="flex items-center gap-3 text-sm text-blue-50"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/15">
                      <Check className="h-3 w-3" />
                    </span>

                    {item}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="relative z-10 px-12 pb-8">
            <p className="text-xs text-blue-100/60">
              © {new Date().getFullYear()} SparkL. All rights reserved.
            </p>
          </div>
        </aside>

        {/* =========================================================
            RIGHT FORM PANEL
        ========================================================= */}
        <section className="min-h-dvh overflow-y-auto bg-slate-50">
          <div className="mx-auto flex w-full max-w-xl px-5 py-8 sm:px-8 sm:py-10 lg:min-h-dvh lg:items-center lg:px-12 lg:py-8">
            <div className="w-full">
              {/* Mobile logo */}
              <div className="mb-7 flex items-center justify-between lg:hidden">
                <Link
                  href="/"
                  aria-label="SparkL home"
                  className="flex items-center"
                >
                  <Image
                    src="/images/logo.jpg"
                    alt="SparkL"
                    width={48}
                    height={48}
                    priority
                    className="h-11 w-auto object-contain"
                  />
                </Link>

                <Link
                  href="/auth/login"
                  className="text-sm font-semibold text-slate-600 transition-colors hover:text-blue-600"
                >
                  Log in
                </Link>
              </div>

              {/* Heading */}
              <div className="mb-7">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-blue-600">
                  Get started
                </p>

                <h1 className="text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl">
                  Create your account
                </h1>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Join SparkL and start preparing smarter.
                </p>
              </div>

              {/* Google */}
              <button
                type="button"
                onClick={handleGoogleSignup}
                disabled={loading || googleLoading}
                className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Image
                  src="/images/google.png"
                  alt="Google"
                  width={18}
                  height={18}
                  className="h-[18px] w-[18px] object-contain"
                />

                {googleLoading
                  ? "Connecting to Google..."
                  : "Continue with Google"}
              </button>

              {/* Divider */}
              <div className="my-6 flex items-center gap-4">
                <div className="h-px flex-1 bg-slate-200" />

                <span className="text-xs font-medium text-slate-400">
                  or continue with email
                </span>

                <div className="h-px flex-1 bg-slate-200" />
              </div>

              {/* Form */}
              <form
                onSubmit={handleSubmit}
                className="space-y-4"
                autoComplete="on"
              >
                {/* Full name */}
                <Field
                  label="Full name"
                  icon={
                    <User className="h-[18px] w-[18px] shrink-0 text-slate-400" />
                  }
                >
                  <input
                    type="text"
                    name="name"
                    autoComplete="name"
                    placeholder="Your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className={inputClass}
                  />
                </Field>

                {/* Phone */}
                <Field
                  label="Phone number"
                  icon={
                    <Phone className="h-[18px] w-[18px] shrink-0 text-slate-400" />
                  }
                  hint={
                    phone && !phoneValid ? (
                      <p className="mt-1.5 text-xs text-red-500">
                        Enter a valid Nigerian phone number.
                      </p>
                    ) : null
                  }
                >
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
                </Field>

                {/* Email */}
                <Field
                  label="Email address"
                  icon={
                    <Mail className="h-[18px] w-[18px] shrink-0 text-slate-400" />
                  }
                  hint={
                    email && !emailValid ? (
                      <p className="mt-1.5 text-xs text-red-500">
                        Enter a valid email address.
                      </p>
                    ) : null
                  }
                >
                  <input
                    type="email"
                    name="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                </Field>

                {/* Password */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Password
                  </label>

                  <div className={fieldBoxClass}>
                    <Lock className="h-[18px] w-[18px] shrink-0 text-slate-400" />

                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      autoComplete="new-password"
                      placeholder="Create a password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={inputClass}
                    />

                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-[18px] w-[18px]" />
                      ) : (
                        <Eye className="h-[18px] w-[18px]" />
                      )}
                    </button>
                  </div>

                  {/* Password strength */}
                  {password && (
                    <div className="mt-3">
                      <div className="mb-2 flex items-center gap-3">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${strength.width} ${strength.color}`}
                          />
                        </div>

                        <span className="w-10 text-right text-xs font-medium text-slate-500">
                          {strength.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                        {[
                          { met: hasMinLength, label: "8+ characters" },
                          { met: hasUpperCase, label: "Uppercase letter" },
                          { met: hasNumber, label: "Number" },
                          { met: hasSpecial, label: "Special character" },
                        ].map(({ met, label }) => (
                          <div
                            key={label}
                            className={`flex items-center gap-1.5 text-xs ${
                              met ? "text-emerald-600" : "text-slate-400"
                            }`}
                          >
                            <Check
                              className={`h-3 w-3 ${
                                met ? "opacity-100" : "opacity-40"
                              }`}
                              strokeWidth={3}
                            />

                            {label}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Confirm password
                  </label>

                  <div className={fieldBoxClass}>
                    <Lock className="h-[18px] w-[18px] shrink-0 text-slate-400" />

                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      name="confirm-password"
                      autoComplete="new-password"
                      placeholder="Repeat your password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={inputClass}
                    />

                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      aria-label={
                        showConfirmPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="h-[18px] w-[18px]" />
                      ) : (
                        <Eye className="h-[18px] w-[18px]" />
                      )}
                    </button>
                  </div>

                  {confirmPassword && !passwordsMatch && (
                    <p className="mt-1.5 text-xs text-red-500">
                      Passwords do not match.
                    </p>
                  )}
                </div>

                {/* Terms */}
                <label className="flex items-start gap-3 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={agreedToTerms}
                    onChange={(e) => setAgreedToTerms(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600"
                  />
                  <span>
                    I agree to the{" "}
                    <Link
                      href="/terms"
                      className="font-semibold text-blue-600 hover:underline"
                    >
                      Terms
                    </Link>{" "}
                    and{" "}
                    <Link
                      href="/privacy"
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
                  disabled={!formValid || loading || googleLoading}
                  className="h-12 w-full rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {loading ? "Creating account..." : "Create account"}
                  {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </form>

              <p className="mt-6 text-center text-sm text-slate-500">
                Already have an account?{" "}
                <Link
                  href="/auth/login"
                  className="font-semibold text-blue-600 hover:underline"
                >
                  Log in
                </Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
