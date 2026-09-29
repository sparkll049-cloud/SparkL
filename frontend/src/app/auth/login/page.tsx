"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const formValid =
    email.trim() !== "" && password.trim() !== "";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setErrorMsg("");

    if (!formValid || loading || googleLoading) return;

    setLoading(true);

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (error) {
      setLoading(false);

      setErrorMsg(
        error.message === "Invalid login credentials"
          ? "Incorrect email or password."
          : error.message
      );

      return;
    }

    if (data.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", data.user.id)
        .single();

      setLoading(false);

      router.push(
        profile?.onboarding_completed
          ? "/dashboard"
          : "/onboarding"
      );
    }
  }

  async function handleGoogleLogin() {
    setErrorMsg("");
    setGoogleLoading(true);

    const { error } =
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
        },
      });

    if (error) {
      setGoogleLoading(false);
      setErrorMsg(error.message);
    }
  }

  return (
    <main className="min-h-dvh bg-slate-50">
      <div className="grid min-h-dvh lg:h-dvh lg:grid-cols-2">

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

          {/* Main content */}
          <div className="relative z-10 px-12">
            <div className="max-w-md">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-blue-50">
                <ShieldCheck className="h-3.5 w-3.5" />
                Secure authentication
              </div>

              <h2 className="text-5xl font-black leading-[1.02] tracking-[-0.04em] text-white">
                Welcome
                <br />
                back.
              </h2>

              <p className="mt-6 max-w-sm text-sm leading-7 text-blue-100">
                Pick up where you left off and keep making progress
                with your studies.
              </p>

              <div className="mt-8 grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-white/10 bg-white/10 p-4">
                  <p className="text-lg font-black text-white">
                    Past
                  </p>
                  <p className="mt-1 text-xs text-blue-100">
                    Questions
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/10 p-4">
                  <p className="text-lg font-black text-white">
                    Learn
                  </p>
                  <p className="mt-1 text-xs text-blue-100">
                    Together
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/10 p-4">
                  <p className="text-lg font-black text-white">
                    Grow
                  </p>
                  <p className="mt-1 text-xs text-blue-100">
                    Smarter
                  </p>
                </div>
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
            RIGHT FORM
        ========================================================= */}
        <section className="min-h-dvh bg-slate-50">
          <div className="mx-auto flex min-h-dvh w-full max-w-xl items-center px-5 py-8 sm:px-8 lg:px-12 lg:py-8">

            <div className="w-full">

              {/* Mobile header */}
              <div className="mb-9 flex items-center justify-between lg:hidden">
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
                  href="/auth/signup"
                  className="text-sm font-semibold text-slate-600 transition-colors hover:text-blue-600"
                >
                  Create account
                </Link>
              </div>

              {/* Heading */}
              <div className="mb-7">
                <p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-blue-600">
                  Welcome back
                </p>

                <h1 className="text-3xl font-black tracking-[-0.035em] text-slate-950 sm:text-4xl">
                  Log in to SparkL
                </h1>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Continue your learning journey.
                </p>
              </div>

              {/* Google */}
              <button
                type="button"
                onClick={handleGoogleLogin}
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
                className="space-y-5"
                autoComplete="on"
              >
                {/* Email */}
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-700">
                    Email address
                  </label>

                  <div className="flex h-12 items-center rounded-xl border border-slate-200 bg-white px-3.5 transition-all duration-200 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">
                    <Mail className="h-[18px] w-[18px] shrink-0 text-slate-400" />

                    <input
                      type="email"
                      name="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="ml-3 min-w-0 w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-semibold text-slate-700">
                      Password
                    </label>

                    <Link
                      href="/auth/forgot-password"
                      className="text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700"
                    >
                      Forgot password?
                    </Link>
                  </div>

                  <div className="flex h-12 items-center rounded-xl border border-slate-200 bg-white px-3.5 transition-all duration-200 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10">
                    <Lock className="h-[18px] w-[18px] shrink-0 text-slate-400" />

                    <input
                      type={
                        showPassword ? "text" : "password"
                      }
                      name="password"
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="ml-3 min-w-0 w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 outline-none"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword((prev) => !prev)
                      }
                      className="ml-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
                      aria-label={
                        showPassword
                          ? "Hide password"
                          : "Show password"
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-[18px] w-[18px]" />
                      ) : (
                        <Eye className="h-[18px] w-[18px]" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember */}
                <label className="flex cursor-pointer items-center gap-3 text-sm text-slate-500">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 accent-blue-600"
                  />

                  Keep me logged in
                </label>

                {/* Error */}
                {errorMsg && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                    <p className="text-sm text-red-600">
                      {errorMsg}
                    </p>
                  </div>
                )}

                {/* Submit */}
                <Button
                  type="submit"
                  disabled={!formValid || loading || googleLoading}
                  className="h-12 w-full rounded-xl bg-[#2563EB] text-sm font-bold text-white shadow-sm shadow-blue-600/20 transition-all duration-200 hover:bg-blue-700 hover:shadow-md hover:shadow-blue-600/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    "Logging in..."
                  ) : (
                    <>
                      Log in
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>

              {/* Signup */}
              <p className="mt-7 pb-3 text-center text-sm text-slate-500">
                Don't have an account?{" "}
                <Link
                  href="/auth/signup"
                  className="font-semibold text-blue-600 transition-colors hover:text-blue-700"
                >
                  Sign up free
                </Link>
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}