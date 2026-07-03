"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
} from "lucide-react";

import AuthLayout from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <AuthLayout>
      <div className="fade-up">

        {/* Logo */}

        <h1 className="text-4xl font-bold text-slate-900">
          Welcome back
        </h1>

        <p className="mt-2 text-slate-500">
          Log in to your SparkL account.
        </p>

        {/* Form */}

        <form className="mt-10 space-y-6">

          {/* Email */}

          <div>

            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Email address
            </label>

            <div
              className="
                flex
                h-14
                items-center
                rounded-xl
                border
                border-slate-200
                bg-white
                px-4
                transition
                duration-300
                focus-within:border-blue-600
                focus-within:ring-4
                focus-within:ring-blue-100
              "
            >

              <Mail
                size={20}
                className="text-slate-400"
              />

              <input
                type="email"
                placeholder="Enter your email"
                className="
                  ml-3
                  w-full
                  border-none
                  bg-transparent
                  outline-none
                "
              />

            </div>

          </div>

          {/* Password */}

          <div>

            <label className="mb-2 block text-sm font-semibold text-slate-700">
              Password
            </label>

            <div
              className="
                flex
                h-14
                items-center
                rounded-xl
                border
                border-slate-200
                bg-white
                px-4
                transition
                duration-300
                focus-within:border-blue-600
                focus-within:ring-4
                focus-within:ring-blue-100
              "
            >

              <Lock
                size={20}
                className="text-slate-400"
              />

              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                className="
                  ml-3
                  w-full
                  border-none
                  bg-transparent
                  outline-none
                "
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

          </div>

          {/* Remember + Forgot */}

          <div className="flex items-center justify-between">

            <label className="flex items-center gap-2 text-sm text-slate-600">

              <input
                type="checkbox"
                className="rounded"
              />

              Remember me

            </label>

            <Link
              href="#"
              className="
                text-sm
                font-medium
                text-blue-600
                hover:underline
              "
            >
              Forgot password?
            </Link>

          </div>

          {/* Login Button */}

          <Button
            className="
              h-14
              w-full
              rounded-xl
              bg-gradient-to-r
              from-blue-700
              to-blue-500
              text-base
              font-semibold
              transition-all
              duration-300
              hover:scale-[1.02]
            "
          >

            <span className="mr-2">
              Log in
            </span>

            <ArrowRight size={18} />

          </Button>

        </form>

        {/* Divider */}

        <div className="my-8 flex items-center">

          <div className="h-px flex-1 bg-slate-200" />

          <span className="mx-4 text-sm text-slate-400">
            or continue with
          </span>

          <div className="h-px flex-1 bg-slate-200" />

        </div>

        {/* Bottom */}

        <p className="mt-8 text-center text-sm text-slate-500">

          Don't have an account?

          <Link
            href="/auth/signup"
            className="ml-2 font-semibold text-blue-600 hover:underline"
          >
            Sign up
          </Link>

        </p>

      </div>
    </AuthLayout>
  );
}