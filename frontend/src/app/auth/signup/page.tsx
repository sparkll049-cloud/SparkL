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
} from "lucide-react";

import AuthLayout from "@/components/auth/AuthLayout";
import AuthModal from "@/components/auth/AuthModal";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();

  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const emailValid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const phoneValid =
    /^(\+234|0)?[789][01]\d{8}$/.test(phone);

  const hasMinLength = password.length >= 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialCharacter =
    /[^A-Za-z0-9]/.test(password);

  const passwordsMatch =
    password === confirmPassword &&
    confirmPassword !== "";

  const formValid =
    fullName.trim() !== "" &&
    phoneValid &&
    emailValid &&
    hasMinLength &&
    hasUpperCase &&
    hasNumber &&
    hasSpecialCharacter &&
    passwordsMatch &&
    agreedToTerms;

  const getPasswordStrength = () => {
    let score = 0;

    if (hasMinLength) score++;
    if (hasUpperCase) score++;
    if (hasNumber) score++;
    if (hasSpecialCharacter) score++;

    if (score <= 1) {
      return {
        text: "Weak",
        color: "bg-red-500",
        width: "w-1/4",
      };
    }

    if (score <= 3) {
      return {
        text: "Medium",
        color: "bg-yellow-500",
        width: "w-2/4",
      };
    }

    return {
      text: "Strong",
      color: "bg-green-500",
      width: "w-full",
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!formValid) return;

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone: phone,
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

  return (
  <>
  <AuthLayout>
        <div className="fade-up">
          <h1 className="text-4xl font-bold text-slate-900">
            Create Account
          </h1>

          <p className="mt-2 text-slate-500">
            Join SparkL and start learning together.
          </p>

          <form onSubmit={handleSubmit} className="mt-10 space-y-5">
            {/* Full Name */}

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Full Name
              </label>

              <div className="flex h-14 items-center rounded-xl border border-slate-200 px-4 focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-100">
                <User
                  size={20}
                  className="text-slate-400"
                />

                <input
                  type="text"
                  placeholder="Enter your full name"
                  value={fullName}
                  onChange={(e) =>
                    setFullName(e.target.value)
                  }
                  className="ml-3 w-full bg-transparent outline-none"
                />
              </div>
            </div>

            {/* Phone */}

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Phone Number
              </label>

              <div className="flex h-14 items-center rounded-xl border border-slate-200 px-4 focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-100">
                <Phone
                  size={20}
                  className="text-slate-400"
                />

                <input
                  type="tel"
                  placeholder="08012345678"
                  value={phone}
                  onChange={(e) =>
                    setPhone(e.target.value)
                  }
                  className="ml-3 w-full bg-transparent outline-none"
                />
              </div>

              {phone && !phoneValid && (
                <p className="mt-2 text-sm text-red-500">
                  Enter a valid Nigerian phone number.
                </p>
              )}
            </div>

            {/* Email */}

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Email Address
              </label>

              <div className="flex h-14 items-center rounded-xl border border-slate-200 px-4 focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-100">
                <Mail
                  size={20}
                  className="text-slate-400"
                />

                <input
                  type="email"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  className="ml-3 w-full bg-transparent outline-none"
                />
              </div>

              {email && !emailValid && (
                <p className="mt-2 text-sm text-red-500">
                  Please enter a valid email.
                </p>
              )}
            </div>

            {/* Password */}

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Password
              </label>

              <div className="flex h-14 items-center rounded-xl border border-slate-200 px-4 focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-100">
                <Lock
                  size={20}
                  className="text-slate-400"
                />

                <input
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  className="ml-3 w-full bg-transparent outline-none"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                >
                  {showPassword ? (
                    <EyeOff
                      size={20}
                      className="text-slate-400"
                    />
                  ) : (
                    <Eye
                      size={20}
                      className="text-slate-400"
                    />
                  )}
                </button>
              </div>

              {password && (
                <>
                  <div className="mt-3 h-2 rounded-full bg-slate-200">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${getPasswordStrength().width} ${getPasswordStrength().color}`}
                    />
                  </div>

                  <p className="mt-2 text-sm text-slate-500">
                    Password strength:
                    <span className="ml-1 font-medium">
                      {getPasswordStrength().text}
                    </span>
                  </p>

                  <div className="mt-4 space-y-1 text-sm">
                    <p className={hasMinLength ? "text-green-600" : "text-slate-500"}>
                      ✓ At least 8 characters
                    </p>

                    <p className={hasUpperCase ? "text-green-600" : "text-slate-500"}>
                      ✓ One uppercase letter
                    </p>

                    <p className={hasNumber ? "text-green-600" : "text-slate-500"}>
                      ✓ One number
                    </p>

                    <p className={hasSpecialCharacter ? "text-green-600" : "text-slate-500"}>
                      ✓ One special character
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Confirm Password */}

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Confirm Password
              </label>

              <div className="flex h-14 items-center rounded-xl border border-slate-200 px-4 focus-within:border-blue-600 focus-within:ring-4 focus-within:ring-blue-100">
                <Lock
                  size={20}
                  className="text-slate-400"
                />

                <input
                  type={
                    showConfirmPassword
                      ? "text"
                      : "password"
                  }
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChange={(e) =>
                    setConfirmPassword(
                      e.target.value
                    )
                  }
                  className="ml-3 w-full bg-transparent outline-none"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(
                      !showConfirmPassword
                    )
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff
                      size={20}
                      className="text-slate-400"
                    />
                  ) : (
                    <Eye
                      size={20}
                      className="text-slate-400"
                    />
                  )}
                </button>
              </div>

              {confirmPassword && (
                <p
                  className={`mt-2 text-sm ${
                    passwordsMatch
                      ? "text-green-600"
                      : "text-red-500"
                  }`}
                >
                  {passwordsMatch
                    ? "Passwords match"
                    : "Passwords do not match"}
                </p>
              )}
            </div>

            {/* Terms */}

            <label className="flex items-start gap-3 text-sm text-slate-600">
              <input
                type="checkbox"
                className="mt-1"
                checked={agreedToTerms}
                onChange={(e) =>
                  setAgreedToTerms(e.target.checked)
                }
              />

              <span>
                I agree to the{" "}
                <button
                  type="button"
                  onClick={() =>
                    setShowTerms(true)
                  }
                  className="font-medium text-blue-600 hover:underline"
                >
                  Terms of Service
                </button>{" "}
                and{" "}
                <button
                  type="button"
                  onClick={() =>
                    setShowPrivacy(true)
                  }
                  className="font-medium text-blue-600 hover:underline"
                >
                  Privacy Policy
                </button>
              </span>
            </label>

            {errorMsg && (
              <p className="text-sm text-red-500">{errorMsg}</p>
            )}

            <Button
              type="submit"
              disabled={!formValid || loading}
              className={`h-14 w-full rounded-xl text-base font-semibold ${
                formValid && !loading
                  ? "bg-gradient-to-r from-blue-700 to-blue-500 hover:scale-[1.02]"
                  : "cursor-not-allowed bg-slate-300"
              }`}
            >
              <span className="mr-2">
                {loading ? "Creating Account..." : "Create Account"}
              </span>

              {!loading && <ArrowRight size={18} />}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-500">
            Already have an account?

            <Link
              href="/auth/login"
              className="ml-2 font-semibold text-blue-600 hover:underline"
            >
              Log In
            </Link>
          </p>
        </div>
    </AuthLayout>


  </>
    
  );
}