import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  LogIn,
  UserPlus,
  ShieldCheck,
} from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";

export default function AuthPage() {
  return (
    <AuthLayout>
      <div className="w-full">
        {/* Brand */}
        <div className="mb-5 flex justify-center">
          <Link
            href="/"
            className="group inline-flex items-center gap-3"
            aria-label="SparkL home"
          >
            <Image
              src="/images/logo.jpg"
              alt="SparkL"
              width={48}
              height={48}
              priority
              className="h-11 w-11 rounded-xl object-cover transition-transform duration-200 group-hover:scale-[1.03]"
            />

            <span className="text-xl font-extrabold tracking-[-0.03em] text-slate-900">
              SparkL
            </span>
          </Link>
        </div>

        {/* Main Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_18px_50px_-30px_rgba(15,23,42,0.25)] sm:p-6">
          {/* Secure Badge */}
          <div className="flex justify-center">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-3 py-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />

              <span className="text-[11px] font-semibold text-blue-600">
                Secure authentication
              </span>
            </div>
          </div>

          {/* Heading */}
          <div className="mt-4 text-center">
            <h1 className="text-2xl font-black tracking-[-0.035em] text-slate-950 sm:text-[27px]">
              Welcome back
            </h1>

            <p className="mt-1.5 text-sm leading-6 text-slate-500">
              Your learning journey continues here.
            </p>
          </div>

          {/* Authentication Options */}
          <div className="mt-6 space-y-3">
            {/* Login */}
            <Link
              href="/auth/login"
              className="group flex items-center gap-3.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/60"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors duration-200 group-hover:bg-blue-100">
                <LogIn className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">
                  Log in to your account
                </p>

                <p className="mt-0.5 text-xs leading-5 text-slate-500">
                  Continue where you left off
                </p>
              </div>

              <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-all duration-200 group-hover:translate-x-1 group-hover:text-blue-600" />
            </Link>

            {/* Divider */}
            <div className="flex items-center gap-3 py-0.5">
              <div className="h-px flex-1 bg-slate-200" />

              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                or
              </span>

              <div className="h-px flex-1 bg-slate-200" />
            </div>

            {/* Sign Up */}
            <Link
              href="/auth/signup"
              className="group flex items-center gap-3.5 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/60"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors duration-200 group-hover:bg-blue-100">
                <UserPlus className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900">
                  Create a new account
                </p>

                <p className="mt-0.5 text-xs leading-5 text-slate-500">
                  Join SparkL and start learning
                </p>
              </div>

              <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-all duration-200 group-hover:translate-x-1 group-hover:text-blue-600" />
            </Link>
          </div>

          {/* Terms */}
          <p className="mt-5 text-center text-[11px] leading-5 text-slate-400">
            By continuing, you agree to our{" "}
            <Link
              href="/terms"
              className="font-medium text-blue-600 transition-colors hover:text-blue-700 hover:underline"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy-policy"
              className="font-medium text-blue-600 transition-colors hover:text-blue-700 hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        {/* Bottom note */}
        <p className="mt-4 text-center text-[11px] text-slate-400">
          Built for students, by students.
        </p>
      </div>
    </AuthLayout>
  );
}