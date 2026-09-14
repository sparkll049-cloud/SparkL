"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Lock, Mail, ArrowRight } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const formValid = email.trim() !== "" && password.trim() !== "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg("");
    if (!formValid) return;
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

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
      router.push(profile?.onboarding_completed ? "/dashboard" : "/onboarding");
    }
  }

  return (
    <div className="min-h-screen bg-[#0A0F2C] flex">

      {/* ── Left panel: branding ── */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-14 overflow-hidden">

        {/* Grid bg */}
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Glow */}
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />

        {/* Logo */}
        <div className="relative">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-[#2563EB] flex items-center justify-center">
              <span className="text-white font-black text-sm">S</span>
            </div>
            <span className="text-white font-bold text-xl tracking-tight">SparkL</span>
          </Link>
        </div>

        {/* Quote block */}
        <div className="relative max-w-sm">
          <p className="text-3xl font-extrabold text-white leading-snug mb-6">
            Every past question you need — in one place.
          </p>
          <p className="text-slate-400 text-sm leading-7">
            Thousands of Nigerian tertiary institution students are already using
            SparkL to prepare smarter. Welcome back.
          </p>

          {/* Stats row */}
          <div className="mt-10 flex gap-10">
            <div>
              <p className="text-2xl font-black text-white">10K+</p>
              <p className="text-xs text-slate-500 mt-1">Students</p>
            </div>
            <div>
              <p className="text-2xl font-black text-white">3K+</p>
              <p className="text-xs text-slate-500 mt-1">Past questions</p>
            </div>
            <div>
              <p className="text-2xl font-black text-white">Free</p>
              <p className="text-xs text-slate-500 mt-1">Always</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="relative text-xs text-slate-600">
          © {new Date().getFullYear()} SparkL. All rights reserved.
        </p>
      </div>

      {/* ── Right panel: form ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-6 py-16 bg-[#060B1F]">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <Link href="/" className="inline-flex items-center gap-3 mb-10 lg:hidden">
            <div className="h-8 w-8 rounded-xl bg-[#2563EB] flex items-center justify-center">
              <span className="text-white font-black text-xs">S</span>
            </div>
            <span className="text-white font-bold text-lg">SparkL</span>
          </Link>

          <h1 className="text-3xl font-extrabold text-white">Welcome back</h1>
          <p className="mt-2 text-slate-400 text-sm">Log in to continue studying.</p>

          <form onSubmit={handleSubmit} className="mt-10 space-y-5">

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Email address
              </label>
              <div className="flex h-13 items-center rounded-xl border border-white/10 bg-white/[0.04] px-4 transition duration-200 focus-within:border-blue-500 focus-within:bg-white/[0.07] focus-within:ring-1 focus-within:ring-blue-500/40">
                <Mail size={18} className="text-slate-500 shrink-0" />
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="ml-3 w-full bg-transparent text-white placeholder:text-slate-600 outline-none text-sm"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-300">Password</label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="flex h-13 items-center rounded-xl border border-white/10 bg-white/[0.04] px-4 transition duration-200 focus-within:border-blue-500 focus-within:bg-white/[0.07] focus-within:ring-1 focus-within:ring-blue-500/40">
                <Lock size={18} className="text-slate-500 shrink-0" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="ml-3 w-full bg-transparent text-white placeholder:text-slate-600 outline-none text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-3 text-sm text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                className="rounded border-white/20 bg-white/5 accent-blue-500"
              />
              Keep me logged in
            </label>

            {/* Error */}
            {errorMsg && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3">
                <p className="text-sm text-red-400">{errorMsg}</p>
              </div>
            )}

            {/* Submit */}
            <Button
              type="submit"
              disabled={!formValid || loading}
              className="w-full h-13 rounded-xl bg-[#2563EB] text-sm font-semibold text-white hover:bg-blue-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? "Logging in..." : "Log in"}
              {!loading && <ArrowRight size={16} />}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500">
            Don't have an account?{" "}
            <Link href="/auth/signup" className="text-blue-400 font-medium hover:text-blue-300 transition-colors">
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}