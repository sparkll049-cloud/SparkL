"use client";

import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="min-h-dvh w-full overflow-hidden bg-[#07091A]">
      <div className="grid min-h-dvh w-full lg:grid-cols-[0.9fr_1.1fr]">
        {/* =======================================================
            LEFT PANEL — DESKTOP
        ======================================================= */}
        <section className="relative hidden min-h-dvh overflow-hidden bg-blue-600 lg:flex">
          {/* Background decoration */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

            <div className="absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-blue-800/30 blur-3xl" />

            <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/20 blur-3xl" />

            <div className="absolute right-16 top-24 h-20 w-20 rounded-full border border-white/10" />

            <div className="absolute right-24 top-32 h-10 w-10 rounded-full border border-white/10" />
          </div>

          {/* Content */}
          <div className="relative z-10 flex w-full flex-col px-10 py-9 xl:px-14 xl:py-10">
            {/* Logo */}
            <Link
              href="/"
              className="group inline-flex w-fit items-center"
              aria-label="SparkL home"
            >
              <Image
                src="/images/logo-white.png"
                alt="SparkL"
                width={125}
                height={46}
                priority
                className="h-auto w-[118px] object-contain transition-transform duration-300 group-hover:scale-[1.02]"
              />
            </Link>

            {/* Main content */}
            <div className="my-auto max-w-lg py-8">
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-blue-100">
                Your academic journey
              </p>

              <h1 className="text-5xl font-black leading-[0.98] tracking-[-0.045em] text-white xl:text-6xl">
                Learn.
                <br />
                Connect.
                <br />
                Grow.
              </h1>

              <p className="mt-6 max-w-md text-[15px] leading-7 text-blue-100 xl:text-base">
                Everything you need to find academic resources, ask questions,
                and learn alongside other students.
              </p>

              {/* Illustration */}
              <div className="mt-8 flex items-center">
                <Image
                  src="/images/auth-illustration.png"
                  alt=""
                  width={300}
                  height={150}
                  priority
                  className="h-auto w-[220px] object-contain xl:w-[260px]"
                />
              </div>
            </div>

            {/* Bottom */}
            <div className="flex items-center justify-between border-t border-white/10 pt-5">
              <p className="text-xs text-blue-100/70">
                Built for students, by students.
              </p>

              <div className="h-2 w-2 rounded-full bg-blue-200/60" />
            </div>
          </div>
        </section>

        {/* =======================================================
            RIGHT PANEL — AUTH CONTENT
        ======================================================= */}
        <section className="relative flex min-h-dvh items-center justify-center overflow-y-auto bg-[#07091A] px-5 py-7 sm:px-8 lg:px-10 xl:px-14">
          {/* Subtle background decoration */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -right-40 -top-40 h-80 w-80 rounded-full bg-blue-600/10 blur-3xl" />

            <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-blue-600/5 blur-3xl" />

            <div className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-blue-500/20 to-transparent" />
          </div>

          {/* Auth content */}
          <div className="relative z-10 w-full max-w-[440px]">
            {/* Mobile logo */}
            <div className="mb-7 flex justify-center lg:hidden">
              <Link href="/" aria-label="SparkL home">
                <Image
                  src="/images/logo.jpg"
                  alt="SparkL"
                  width={46}
                  height={46}
                  priority
                  className="h-11 w-11 rounded-xl object-cover"
                />
              </Link>
            </div>

            {children}
          </div>
        </section>
      </div>
    </main>
  );
}