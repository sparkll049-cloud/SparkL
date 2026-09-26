import Link from "next/link";
import Image from "next/image";
import { ArrowRight, LogIn, UserPlus, ShieldCheck } from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";

export default function AuthPage() {
  return (
    <AuthLayout>
      <main className="relative flex min-h-dvh w-full items-center justify-center overflow-hidden bg-[#07091A] px-5 py-6 sm:px-8">
        {/* Subtle background details */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -left-40 top-1/2 h-80 w-80 -translate-y-1/2 rounded-full bg-blue-600/10 blur-3xl" />

          <div className="absolute -right-40 top-0 h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />

          <div className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
        </div>

        {/* Main content */}
        <div className="relative z-10 w-full max-w-[440px]">
          {/* Brand */}
          <div className="mb-7 flex items-center justify-center">
            <Link
              href="/"
              className="group flex items-center gap-3"
              aria-label="SparkL home"
            >
              <Image
                src="/images/logo.jpg"
                alt="SparkL"
                width={44}
                height={44}
                priority
                className="h-11 w-11 rounded-xl object-cover transition-transform duration-200 group-hover:scale-[1.03]"
              />

              <span className="text-xl font-extrabold tracking-[-0.03em] text-white">
                SparkL
              </span>
            </Link>
          </div>

          {/* Auth card */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#0D1230] p-5 shadow-[0_25px_70px_-30px_rgba(0,0,0,0.7)] sm:p-6">
            {/* Secure badge */}
            <div className="mb-5 flex justify-center">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/20 bg-blue-500/10 px-3 py-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />

                <span className="text-[11px] font-semibold text-blue-300">
                  Secure authentication
                </span>
              </div>
            </div>

            {/* Heading */}
            <div className="text-center">
              <h1 className="text-2xl font-black tracking-[-0.035em] text-white sm:text-[27px]">
                Welcome back
              </h1>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Your learning journey continues here.
              </p>
            </div>

            {/* Options */}
            <div className="mt-7 space-y-3">
              {/* Login */}
              <Link
                href="/auth/login"
                className="group flex items-center gap-3.5 rounded-xl border border-white/[0.08] bg-white/[0.035] p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-500/40 hover:bg-blue-500/[0.06]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 transition-colors duration-200 group-hover:bg-blue-500/15">
                  <LogIn className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-200">
                    Log in to your account
                  </p>

                  <p className="mt-0.5 text-xs leading-5 text-slate-500">
                    Continue where you left off
                  </p>
                </div>

                <ArrowRight className="h-4 w-4 shrink-0 text-slate-600 transition-all duration-200 group-hover:translate-x-1 group-hover:text-blue-400" />
              </Link>

              {/* Divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="h-px flex-1 bg-white/[0.07]" />

                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-600">
                  or
                </span>

                <div className="h-px flex-1 bg-white/[0.07]" />
              </div>

              {/* Sign up */}
              <Link
                href="/auth/signup"
                className="group flex items-center gap-3.5 rounded-xl border border-white/[0.08] bg-white/[0.035] p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-500/40 hover:bg-blue-500/[0.06]"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 transition-colors duration-200 group-hover:bg-blue-500/15">
                  <UserPlus className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-slate-200">
                    Create a new account
                  </p>

                  <p className="mt-0.5 text-xs leading-5 text-slate-500">
                    Join SparkL and start learning
                  </p>
                </div>

                <ArrowRight className="h-4 w-4 shrink-0 text-slate-600 transition-all duration-200 group-hover:translate-x-1 group-hover:text-blue-400" />
              </Link>
            </div>

            {/* Terms */}
            <p className="mt-6 text-center text-[11px] leading-5 text-slate-600">
              By continuing, you agree to our{" "}
              <Link
                href="/terms"
                className="text-blue-500 transition-colors hover:text-blue-400 hover:underline"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="/privacy-policy"
                className="text-blue-500 transition-colors hover:text-blue-400 hover:underline"
              >
                Privacy Policy
              </Link>
              .
            </p>
          </div>

          {/* Bottom message */}
          <p className="mt-5 text-center text-[11px] text-slate-600">
            Built for students, by students.
          </p>
        </div>
      </main>
    </AuthLayout>
  );
}