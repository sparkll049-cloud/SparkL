"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileQuestion,
  GraduationCap,
  MessageCircleQuestion,
  Search,
  Sparkles,
  Users,
} from "lucide-react";

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-white">
      {/* Subtle background detail */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-24 h-72 w-72 rounded-full bg-blue-50 blur-3xl" />
        <div className="absolute -right-32 bottom-0 h-72 w-72 rounded-full bg-indigo-50/70 blur-3xl" />

        <div className="absolute left-0 top-1/2 h-px w-24 bg-gradient-to-r from-transparent to-blue-100" />
        <div className="absolute right-0 top-1/3 h-px w-24 bg-gradient-to-l from-transparent to-blue-100" />
      </div>

      <div className="relative mx-auto grid min-h-[calc(100vh-80px)] max-w-7xl items-center gap-12 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14 lg:px-10 lg:py-12">
        {/* LEFT — HERO COPY */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, ease: "easeOut" }}
          className="relative z-10 max-w-2xl"
        >
          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08, duration: 0.4 }}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/70 px-3.5 py-1.5 text-sm font-semibold text-blue-700"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Your academic companion
          </motion.div>

          {/* Heading */}
          <h1 className="max-w-3xl text-[3.35rem] font-black leading-[0.98] tracking-[-0.045em] text-slate-950 sm:text-6xl lg:text-[4.35rem]">
            Learn smarter.
            <br />
            <span className="text-blue-600">Grow together.</span>
          </h1>

          {/* Description */}
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Find past questions, get help when you’re stuck, and learn from
            other students — all in one place.
          </p>

          {/* CTA */}
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/dashboard/courses"
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-[0_10px_25px_-10px_rgba(37,99,235,0.55)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-[0_14px_30px_-10px_rgba(37,99,235,0.6)]"
            >
              Explore Past Questions
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>

            <Link
              href="/community"
              className="group inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/60 hover:text-blue-600"
            >
              Ask the Community
              <MessageCircleQuestion className="h-4 w-4 transition-transform duration-300 group-hover:scale-105" />
            </Link>
          </div>

          {/* Value points */}
          <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
              Past questions
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-500">
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
              Student community
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-500">
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
              Academic support
            </div>
          </div>
        </motion.div>

        {/* RIGHT — PRODUCT PREVIEW */}
        <motion.div
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.65, delay: 0.12, ease: "easeOut" }}
          className="relative mx-auto w-full max-w-xl"
        >
          <div className="relative">
            {/* Light outer frame */}
            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-2.5 shadow-[0_28px_80px_-30px_rgba(15,23,42,0.38)]">
              {/* DARK PRODUCT INTERFACE */}
              <div className="overflow-hidden rounded-[1.35rem] bg-slate-950">
                {/* Product header */}
                <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4 sm:px-6">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
                      <GraduationCap className="h-4 w-4 text-white" />
                    </div>

                    <div>
                      <p className="text-xs font-bold text-white">SparkL</p>
                      <p className="text-[10px] text-slate-500">
                        Student workspace
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    <span className="text-[10px] font-medium text-slate-500">
                      Online
                    </span>
                  </div>
                </div>

                {/* Search */}
                <div className="px-5 pt-5 sm:px-6">
                  <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.045] px-4 py-3">
                    <Search className="h-4 w-4 shrink-0 text-slate-500" />

                    <span className="text-xs text-slate-500">
                      Search courses, questions, topics...
                    </span>
                  </div>
                </div>

                {/* Main cards */}
                <div className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6">
                  {/* Past Questions */}
                  <div className="rounded-2xl border border-white/[0.05] bg-white/[0.055] p-4 transition-colors duration-300 hover:bg-white/[0.07]">
                    <div className="flex items-center justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/15">
                        <FileQuestion className="h-4 w-4 text-blue-400" />
                      </div>

                      <span className="text-[10px] font-semibold text-emerald-400">
                        Available
                      </span>
                    </div>

                    <p className="mt-5 text-xl font-black text-white">
                      Past Questions
                    </p>

                    <p className="mt-1 max-w-[180px] text-xs leading-5 text-slate-500">
                      Practice with questions from your courses.
                    </p>

                    <div className="mt-5 flex items-center gap-1.5 text-[10px] font-medium text-blue-400">
                      <span>Browse collection</span>
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>

                  {/* Community */}
                  <div className="rounded-2xl bg-blue-600 p-4 shadow-[0_12px_30px_-15px_rgba(37,99,235,0.65)]">
                    <div className="flex items-center justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                        <Users className="h-4 w-4 text-white" />
                      </div>

                      <span className="text-[10px] font-semibold text-blue-100">
                        Community
                      </span>
                    </div>

                    <p className="mt-5 text-xl font-black text-white">
                      Ask & Learn
                    </p>

                    <p className="mt-1 max-w-[180px] text-xs leading-5 text-blue-100">
                      Get help from students who understand.
                    </p>

                    <div className="mt-5 flex items-center gap-1.5 text-[10px] font-medium text-white">
                      <span>Join the discussion</span>
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  </div>

                  {/* Continue studying */}
                  <div className="rounded-2xl border border-white/[0.05] bg-white/[0.055] p-4 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.07]">
                          <BookOpen className="h-4 w-4 text-blue-400" />
                        </div>

                        <div>
                          <p className="text-xs font-bold text-white">
                            Continue studying
                          </p>

                          <p className="mt-0.5 text-[11px] text-slate-500">
                            MTH 201 • Engineering Mathematics
                          </p>
                        </div>
                      </div>

                      <span className="hidden text-[10px] font-medium text-slate-500 sm:block">
                        Practice
                      </span>
                    </div>

                    <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: "68%" }}
                        transition={{
                          delay: 0.7,
                          duration: 0.9,
                          ease: "easeOut",
                        }}
                        className="h-full rounded-full bg-blue-500"
                      />
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                      <span>68% complete</span>
                      <span>Keep going</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Single floating notification */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.45 }}
              className="absolute -right-3 top-16 hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_16px_40px_-18px_rgba(15,23,42,0.35)] sm:block"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </div>

                <div>
                  <p className="text-xs font-bold text-slate-900">
                    Solution found
                  </p>

                  <p className="mt-0.5 text-[10px] text-slate-500">
                    Community answer
                  </p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Supporting label */}
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-slate-400">
            <div className="h-px w-8 bg-slate-200" />
            <span>Everything you need to study better</span>
            <div className="h-px w-8 bg-slate-200" />
          </div>
        </motion.div>
      </div>
    </section>
  );
}