"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
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
  const shouldReduceMotion = useReducedMotion();

  /*
   * Animation helpers
   * ----------------------------------------
   * When reduced motion is enabled, everything
   * appears normally without movement.
   */

  const fadeUp = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 18,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.55,
        ease: "easeOut",
      },
    },
  };

  const fadeIn = {
    hidden: {
      opacity: 0,
    },
    visible: {
      opacity: 1,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.5,
        ease: "easeOut",
      },
    },
  };

  const slideRight = {
    hidden: {
      opacity: 0,
      x: shouldReduceMotion ? 0 : 24,
    },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.7,
        ease: "easeOut",
      },
    },
  };

  const staggerContainer = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.09,
      },
    },
  };

  const cardReveal = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 14,
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.45,
        ease: "easeOut",
      },
    },
  };

  return (
    <section className="relative overflow-hidden bg-white">
      {/* =========================================================
          BACKGROUND
      ========================================================= */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-24 h-72 w-72 rounded-full bg-blue-50 blur-3xl" />

        <div className="absolute -right-32 bottom-0 h-72 w-72 rounded-full bg-indigo-50/70 blur-3xl" />

        <div className="absolute left-0 top-1/2 h-px w-24 bg-gradient-to-r from-transparent to-blue-100" />

        <div className="absolute right-0 top-1/3 h-px w-24 bg-gradient-to-l from-transparent to-blue-100" />
      </div>

      <div className="relative mx-auto grid min-h-[calc(100vh-80px)] max-w-7xl items-center gap-12 px-5 py-8 sm:px-8 sm:py-10 lg:grid-cols-[1.02fr_0.98fr] lg:gap-14 lg:px-10 lg:py-12">
        {/* =========================================================
            LEFT — HERO COPY
        ========================================================= */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="relative z-10 max-w-2xl"
        >
          {/* Eyebrow */}
          <motion.div
            variants={fadeUp}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/70 px-3.5 py-1.5 text-sm font-semibold text-blue-700"
          >
            <Sparkles className="h-3.5 w-3.5" />

            <span>Your academic companion</span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            variants={fadeUp}
            className="max-w-3xl text-[3.35rem] font-black leading-[0.98] tracking-[-0.045em] text-slate-950 sm:text-6xl lg:text-[4.35rem]"
          >
            <span className="block">Learn smarter.</span>

            <motion.span
              initial={{
                opacity: 0,
                y: shouldReduceMotion ? 0 : 18,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                delay: shouldReduceMotion ? 0 : 0.18,
                duration: shouldReduceMotion ? 0 : 0.55,
                ease: "easeOut",
              }}
              className="block text-blue-600"
            >
              Grow together.
            </motion.span>
          </motion.h1>

          {/* Description */}
          <motion.p
            variants={fadeUp}
            className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8"
          >
            Find past questions, get help when you’re stuck, and learn from
            other students — all in one place.
          </motion.p>

          {/* =====================================================
              CTA BUTTONS
          ===================================================== */}
          <motion.div
            variants={staggerContainer}
            className="mt-7 flex flex-col gap-3 sm:flex-row"
          >
            {/* Primary CTA */}
            <motion.div variants={fadeUp}>
              <Link
                href="/dashboard/courses"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-[0_10px_25px_-10px_rgba(37,99,235,0.55)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-[0_14px_30px_-10px_rgba(37,99,235,0.6)]"
              >
                Explore Past Questions

                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </motion.div>

            {/* Secondary CTA */}
            <motion.div variants={fadeUp}>
              <Link
                href="/community"
                className="group inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/60 hover:text-blue-600"
              >
                Ask the Community

                <MessageCircleQuestion className="h-4 w-4 transition-transform duration-300 group-hover:scale-105" />
              </Link>
            </motion.div>
          </motion.div>

          {/* =====================================================
              VALUE POINTS
          ===================================================== */}
          <motion.div
            variants={staggerContainer}
            className="mt-7 flex flex-wrap gap-x-6 gap-y-3"
          >
            <motion.div
              variants={fadeUp}
              className="flex items-center gap-2 text-sm text-slate-500"
            >
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
              Past questions
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="flex items-center gap-2 text-sm text-slate-500"
            >
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
              Student community
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="flex items-center gap-2 text-sm text-slate-500"
            >
              <CheckCircle2 className="h-4 w-4 text-blue-600" />
              Academic support
            </motion.div>
          </motion.div>
        </motion.div>

        {/* =========================================================
            RIGHT — PRODUCT PREVIEW
        ========================================================= */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={slideRight}
          className="relative mx-auto w-full max-w-xl"
        >
          <div className="relative">
            {/* =====================================================
                OUTER FRAME
            ===================================================== */}
            <motion.div
              initial={{
                opacity: 0,
                scale: shouldReduceMotion ? 1 : 0.98,
              }}
              animate={{
                opacity: 1,
                scale: 1,
              }}
              transition={{
                delay: shouldReduceMotion ? 0 : 0.15,
                duration: shouldReduceMotion ? 0 : 0.65,
                ease: "easeOut",
              }}
              className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-2.5 shadow-[0_28px_80px_-30px_rgba(15,23,42,0.38)]"
            >
              {/* =================================================
                  DARK PRODUCT INTERFACE
              ================================================= */}
              <div className="overflow-hidden rounded-[1.35rem] bg-slate-950">
                {/* Product header */}
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={fadeIn}
                  transition={{
                    delay: shouldReduceMotion ? 0 : 0.25,
                  }}
                  className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4 sm:px-6"
                >
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
                    <motion.span
                      initial={{
                        opacity: 0,
                        scale: shouldReduceMotion ? 1 : 0.5,
                      }}
                      animate={{
                        opacity: 1,
                        scale: 1,
                      }}
                      transition={{
                        delay: shouldReduceMotion ? 0 : 0.65,
                        duration: shouldReduceMotion ? 0 : 0.3,
                      }}
                      className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                    />

                    <span className="text-[10px] font-medium text-slate-500">
                      Online
                    </span>
                  </div>
                </motion.div>

                {/* =================================================
                    SEARCH
                ================================================= */}
                <motion.div
                  initial={{
                    opacity: 0,
                    y: shouldReduceMotion ? 0 : 8,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  transition={{
                    delay: shouldReduceMotion ? 0 : 0.32,
                    duration: shouldReduceMotion ? 0 : 0.4,
                    ease: "easeOut",
                  }}
                  className="px-5 pt-5 sm:px-6"
                >
                  <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.045] px-4 py-3">
                    <Search className="h-4 w-4 shrink-0 text-slate-500" />

                    <span className="text-xs text-slate-500">
                      Search courses, questions, topics...
                    </span>
                  </div>
                </motion.div>

                {/* =================================================
                    MAIN PRODUCT CARDS
                ================================================= */}
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={staggerContainer}
                  className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6"
                >
                  {/* Past Questions */}
                  <motion.div
                    variants={cardReveal}
                    whileHover={
                      shouldReduceMotion
                        ? undefined
                        : {
                            y: -3,
                            transition: { duration: 0.2 },
                          }
                    }
                    className="rounded-2xl border border-white/[0.05] bg-white/[0.055] p-4 transition-colors duration-300 hover:bg-white/[0.07]"
                  >
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
                  </motion.div>

                  {/* Community */}
                  <motion.div
                    variants={cardReveal}
                    whileHover={
                      shouldReduceMotion
                        ? undefined
                        : {
                            y: -3,
                            transition: { duration: 0.2 },
                          }
                    }
                    className="rounded-2xl bg-blue-600 p-4 shadow-[0_12px_30px_-15px_rgba(37,99,235,0.65)]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                        <Users className="h-4 w-4 text-white" />
                      </div>

                      <span className="text-[10px] font-semibold text-blue-100">
                        Active
                      </span>
                    </div>

                    <p className="mt-5 text-xl font-black text-white">
                      Community
                    </p>

                    <p className="mt-1 max-w-[180px] text-xs leading-5 text-blue-100/80">
                      Ask questions and discuss topics with peers.
                    </p>

                    <div className="mt-5 flex items-center gap-1.5 text-[10px] font-medium text-white">
                      <span>Join discussion</span>

                      <ArrowRight className="h-3 w-3" />
                    </div>
                  </motion.div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
