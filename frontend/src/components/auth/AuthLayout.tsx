"use client";

import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";

interface AuthLayoutProps {
  children: ReactNode;
}

export default function AuthLayout({
  children,
}: AuthLayoutProps) {
  return (
    <main className="min-h-screen bg-slate-100">
      <div className="grid min-h-screen lg:grid-cols-2">

        {/* LEFT PANEL */}

        <div
          className="
            relative
            hidden
            overflow-hidden
            bg-gradient-to-br
            from-blue-700
            via-blue-600
            to-blue-500
            lg:flex
            flex-col
            justify-between
            p-14
          "
        >
          {/* Decorative circles */}

          <div className="absolute -right-28 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />

          <div className="absolute bottom-0 left-0 h-96 w-96 rounded-full bg-blue-900/20 blur-3xl" />

          {/* Logo */}

          <Link href="/">
            <Image
              src="/images/logo-white.png"
              alt="SparkL"
              width={150}
              height={55}
              priority
            />
          </Link>

          {/* Text */}

          <div className="relative z-10 max-w-md">

            <h1 className="text-6xl font-bold leading-tight text-white">
              Learn.
              <br />
              Connect.
              <br />
              Grow.
            </h1>

            <p className="mt-8 text-lg leading-8 text-blue-100">
              Join a thriving community of students,
              professionals and lifelong learners sharing
              opportunities, knowledge and ideas.
            </p>

          </div>

          {/* Illustration */}

          <div className="relative z-10 flex justify-center">

            <Image
  src="/images/auth-illustration.png"
  priority
              alt="Illustration"
              width={300}
              height={150}
            />

          </div>
        </div>

        {/* RIGHT */}

        <div
          className="
            flex
            items-center
            justify-center
            px-6
            py-12
            lg:px-16
          "
        >
          <div
            className="
              w-full
              max-w-md
              rounded-[32px]
              bg-white
              p-8
              shadow-2xl
            "
          >
            {/* Mobile Logo */}

            <div className="mb-8 flex justify-center lg:hidden">

              <Image
                src="/images/logo.jpg"
                alt="SparkL"
                width={90}
                height={90}
                priority
              />

            </div>

            {children}

          </div>
        </div>
      </div>
    </main>
  );
}