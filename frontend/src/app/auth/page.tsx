import Link from "next/link";
import Image from "next/image";
import { ArrowRight, LogIn, UserPlus, ShieldCheck } from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";

export default function AuthPage() {
  return (
    <AuthLayout>
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#07091A] px-5 py-10">
        <div className="w-full max-w-sm animate-fade-up">

          {/* Logo */}
          <div className="mb-8 flex items-center gap-3">
            <Image
              src="/images/logo.jpg"
              alt="SparkL logo"
              width={40}
              height={40}
              className="rounded-xl object-contain"
            />
            <span className="text-2xl font-black tracking-tight text-white">
              SparkL
            </span>
          </div>

          {/* Secure badge */}
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-blue-500/25 bg-blue-500/10 px-3 py-1">
            <ShieldCheck className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-[11px] font-medium text-blue-400">
              Secure login
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-[26px] font-bold leading-tight text-white">
            Welcome back
          </h1>
          <p className="mt-1.5 mb-8 text-sm text-slate-500">
            Your learning journey continues here.
          </p>

          {/* Login Card */}
          <Link href="/auth/login">
            <div className="group flex items-center gap-4 rounded-2xl border border-[#1e2a4a] bg-[#0D1230] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-600 hover:bg-[#111a3d]">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400">
                <LogIn className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-200">
                  Log in to your account
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Continue where you left off
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-600 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-blue-400" />
            </div>
          </Link>

          {/* Divider */}
          <div className="my-3 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#1e2a4a]" />
            <span className="text-[11px] text-slate-600">or</span>
            <div className="h-px flex-1 bg-[#1e2a4a]" />
          </div>

          {/* Signup Card */}
          <Link href="/auth/signup">
            <div className="group flex items-center gap-4 rounded-2xl border border-[#1e2a4a] bg-[#0D1230] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-600 hover:bg-[#0d1f1a]">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/12 text-emerald-400">
                <UserPlus className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-200">
                  Create a new account
                </p>
                <p className="mt-0.5 text-xs text-slate-500">
                  Join thousands of students on SparkL
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-600 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-emerald-400" />
            </div>
          </Link>

          {/* Footer */}
          <p className="mt-8 text-center text-xs leading-relaxed text-slate-600">
            By continuing, you agree to our{" "}
            <Link
              href="#"
              className="text-blue-500 transition hover:text-blue-400 hover:underline"
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="#"
              className="text-blue-500 transition hover:text-blue-400 hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </p>

        </div>
      </div>
    </AuthLayout>
  );
}