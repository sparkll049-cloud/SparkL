"use client";

import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <main className="min-h-dvh w-full overflow-hidden bg-slate-50">
      <div className="grid min-h-dvh w-full lg:grid-cols-[0.9fr_1.1fr]">
        {/* =====================================================
            LEFT PANEL — DESKTOP
        ===================================================== */}
        <section className="relative hidden min-h-dvh overflow-hidden bg-blue-600 lg:flex">
          {/* Background decoration */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -right-32 -top-32 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

            <div className="absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-blue-800/30 blur-3xl" />

            <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/20 blur-3xl" />

            <div className="absolute right-16 top-24 h-20 w-20 rounded-full border border-white/10" />

            <div className="absolute right-24 top-32 h-10 w-10 rounded-full border border-white/10" />
          </div>

          <div className="relative z-10 flex w-full flex-col px-10 py-9 xl:px-14 xl:py-10">
            {/* Desktop Logo */}
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

            {/* Main Content */}
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
              <div className="mt-8">
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

        {/* =====================================================
            RIGHT PANEL — AUTH
        ===================================================== */}
        <section className="flex min-h-dvh items-center justify-center overflow-y-auto bg-slate-50 px-5 py-5 sm:px-8 sm:py-8 lg:px-10 xl:px-14">
          <div className="w-full max-w-[440px]">
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}