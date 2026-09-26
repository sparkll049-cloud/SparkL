"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { User, Mail, Phone, Lock, Eye, EyeOff, ArrowRight, Check } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";

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
  const [errorMsg, setErrorMsg] = useState("");

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const phoneValid = /^(\+234|0)?[789][01]\d{8}$/.test(phone);
  const hasMinLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const passwordsMatch = password === confirmPassword && confirmPassword !== "";

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

  const strengthScore = [hasMinLength, hasUpperCase, hasNumber, hasSpecial].filter(Boolean).length;
  const strength =
    strengthScore <= 1
      ? { label: "Weak", color: "bg-red-500", width: "w-1/4" }
      : strengthScore <= 3
      ? { label: "Fair", color: "bg-yellow-400", width: "w-2/4" }
      : { label: "Strong", color: "bg-emerald-500", width: "w-full" };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!formValid) return;
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName, phone } },
    });

    setLoading(false);

    if (error) { setErrorMsg(error.message); return; }
    if (data.user) router.push("/onboarding");
  };

  const Field = ({
    label,
    children,
    hint,
  }: {
    label: string;
    children: React.ReactNode;
    hint?: React.ReactNode;
  }) => (
    <div>
      <label className="block text-sm font-medium text-slate-300 mb-2">{label}</label>
      <div className="flex h-13 items-center rounded-xl border border-white/10 bg-white/[0.04] px-4 transition duration-200 focus-within:border-blue-500 focus-within:bg-white/[0.07] focus-within:ring-1 focus-within:ring-blue-500/40">
        {children}
      </div>
      {hint}
    </div>
  );

  const inputClass = "ml-3 w-full bg-transparent text-white placeholder:text-slate-600 outline-none text-sm";

  return (
    <div className="min-h-screen bg-[#0A0F2C] flex">

      {/* ── Left panel ── */}
      <div className="hidden lg:flex lg:w-[42%] relative flex-col justify-between p-14 overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        <div className="absolute top-1/3 -left-20 w-[400px] h-[400px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />

                <Link
          href="/"
          onClick={closeMenu}
          className="group flex items-center"
          aria-label="SparkL home"
        >
          <Image
            src="/images/logo.jpg"
            alt="SparkL"
            width={58}
            height={58}
            priority
            className="h-12 w-auto object-contain transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </Link>
        <div className="relative">
          <p className="text-3xl font-extrabold text-white leading-snug mb-6">
            The smarter way to prepare for Nigerian tertiary exams.
          </p>
          <ul className="space-y-4">
            {[
              "Access thousands of verified past questions",
              "Organized by department, level, and course",
              "Free — for every student, always",
              "Polytechnics, universities, colleges of education",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-slate-400">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
                  <Check size={11} strokeWidth={3} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-slate-600">
          © {new Date().getFullYear()} SparkL. All rights reserved.
        </p>
      </div>

      {/* ── Right panel: form ── */}
      <div className="w-full lg:w-[58%] flex items-start justify-center px-6 py-14 bg-[#060B1F] overflow-y-auto">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <Link href="/" className="inline-flex items-center gap-3 mb-10 lg:hidden">
            <div className="h-8 w-8 rounded-xl bg-[#2563EB] flex items-center justify-center">
              <span className="text-white font-black text-xs">S</span>
            </div>
            <span className="text-white font-bold text-lg">SparkL</span>
          </Link>

          <h1 className="text-3xl font-extrabold text-white">Create your account</h1>
          

          <form onSubmit={handleSubmit} className="mt-10 space-y-5">

            {/* Full name */}
            <Field label="Full name">
              <User size={18} className="text-slate-500 shrink-0" />
              <input
                type="text"
                placeholder="Your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass}
              />
            </Field>

            {/* Phone */}
            <Field
              label="Phone number"
              hint={
                phone && !phoneValid ? (
                  <p className="mt-2 text-xs text-red-400">Enter a valid Nigerian phone number.</p>
                ) : null
              }
            >
              <Phone size={18} className="text-slate-500 shrink-0" />
              <input
                type="tel"
                placeholder="08012345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputClass}
              />
            </Field>

            {/* Email */}
            <Field
              label="Email address"
              hint={
                email && !emailValid ? (
                  <p className="mt-2 text-xs text-red-400">Enter a valid email address.</p>
                ) : null
              }
            >
              <Mail size={18} className="text-slate-500 shrink-0" />
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </Field>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <div className="flex h-13 items-center rounded-xl border border-white/10 bg-white/[0.04] px-4 transition duration-200 focus-within:border-blue-500 focus-within:bg-white/[0.07] focus-within:ring-1 focus-within:ring-blue-500/40">
                <Lock size={18} className="text-slate-500 shrink-0" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputClass}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-slate-500 hover:text-slate-300 transition-colors">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {password && (
                <div className="mt-3">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex-1 h-1.5 rounded-full bg-white/10">
                      <div className={`h-1.5 rounded-full transition-all duration-500 ${strength.width} ${strength.color}`} />
                    </div>
                    <span className="text-xs text-slate-400 w-10 text-right">{strength.label}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { met: hasMinLength, label: "8+ characters" },
                      { met: hasUpperCase, label: "Uppercase letter" },
                      { met: hasNumber,    label: "Number" },
                      { met: hasSpecial,   label: "Special character" },
                    ].map(({ met, label }) => (
                      <div key={label} className={`flex items-center gap-1.5 text-xs ${met ? "text-emerald-400" : "text-slate-600"}`}>
                        <Check size={10} strokeWidth={3} className={met ? "opacity-100" : "opacity-30"} />
                        {label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm password */}
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Confirm password</label>
              <div className="flex h-13 items-center rounded-xl border border-white/10 bg-white/[0.04] px-4 transition duration-200 focus-within:border-blue-500 focus-within:bg-white/[0.07] focus-within:ring-1 focus-within:ring-blue-500/40">
                <Lock size={18} className="text-slate-500 shrink-0" />
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="text-slate-500 hover:text-slate-300 transition-colors">
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {confirmPassword && (
                <p className={`mt-2 text-xs ${passwordsMatch ? "text-emerald-400" : "text-red-400"}`}>
                  {passwordsMatch ? "Passwords match" : "Passwords do not match"}
                </p>
              )}
            </div>

            {/* ── Terms & policies agreement ── */}
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4 space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Before you continue</p>

              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-white/20 bg-white/5 accent-blue-500 shrink-0"
                  checked={agreedToTerms}
                  onChange={(e) => setAgreedToTerms(e.target.checked)}
                />
                <span className="text-sm text-slate-400 leading-relaxed group-hover:text-slate-300 transition-colors">
                  I have read and agree to the{" "}
                  <Link href="/terms" target="_blank" className="text-blue-400 hover:text-blue-300 font-medium underline underline-offset-2">
                    Terms of Service
                  </Link>
                  ,{" "}
                  <Link href="/privacy-policy" target="_blank" className="text-blue-400 hover:text-blue-300 font-medium underline underline-offset-2">
                    Privacy Policy
                  </Link>
                  , and{" "}
                  <Link href="/content-guidelines" target="_blank" className="text-blue-400 hover:text-blue-300 font-medium underline underline-offset-2">
                    Content Guidelines
                  </Link>
                  . I understand that uploaded content is subject to review.
                </span>
              </label>
            </div>

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
              {loading ? "Creating account..." : "Create account"}
              {!loading && <ArrowRight size={16} />}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-blue-400 font-medium hover:text-blue-300 transition-colors">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
