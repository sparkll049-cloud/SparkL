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

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] },
  },
};

const staggerContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.09, delayChildren: 0.08 },
  },
};

const previewContainer = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.25 },
  },
};

const previewItem = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

export default function HeroSection() {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden bg-white">
      {/* ── BACKGROUND ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Animated gradient orbs */}
        <motion.div
          animate={shouldReduceMotion ? {} : {
            opacity: [0.4, 0.65, 0.4],
            scale: [0.95, 1.08, 0.95],
            x: [0, 20, 0],
          }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -left-40 top-10 h-96 w-96 rounded-full bg-blue-100/70 blur-3xl"
        />
        <motion.div
          animate={shouldReduceMotion ? {} : {
            opacity: [0.3, 0.55, 0.3],
            scale: [0.95, 1.1, 0.95],
            x: [0, -20, 0],
          }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
          className="absolute -right-40 -top-10 h-96 w-96 rounded-full bg-indigo-100/60 blur-3xl"
        />
        <motion.div
          animate={shouldReduceMotion ? {} : {
            opacity: [0.2, 0.4, 0.2],
            scale: [1, 1.15, 1],
          }}
          transition={{ duration: 13, repeat: Infinity, ease: "easeInOut", delay: 3 }}
          className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-violet-100/40 blur-3xl"
        />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.018]"
          style={{
            backgroundImage:
              "linear-gradient(#1e40af 1px, transparent 1px), linear-gradient(90deg, #1e40af 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="relative mx-auto flex min-h-[calc(100vh-80px)] max-w-7xl flex-col justify-center px-5 py-16 sm:px-8 sm:py-20 lg:grid lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:px-10 lg:py-0">

        {/* ── LEFT — COPY ── */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="relative z-10 max-w-2xl"
        >
          {/* Eyebrow pill */}
          <motion.div
            variants={fadeUp}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm"
          >
            <motion.span
              animate={shouldReduceMotion ? {} : {
                rotate: [0, 15, -10, 15, 0],
                scale: [1, 1.2, 1.1, 1.2, 1],
              }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
            >
              <Sparkles className="h-4 w-4 text-blue-600" />
            </motion.span>
            Your academic companion
          </motion.div>

          {/* Heading */}
          <motion.h1
            variants={fadeUp}
            className="text-[3.5rem] font-black leading-[0.95] tracking-[-0.045em] text-slate-950 sm:text-6xl lg:text-[4.5rem] xl:text-[5rem]"
          >
            <motion.span
              className="block"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            >
              Learn smarter.
            </motion.span>
            <motion.span
              className="block text-blue-600"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.22, ease: [0.22, 1, 0.36, 1] }}
            >
              Grow together.
            </motion.span>
          </motion.h1>

          {/* Description */}
          <motion.p
            variants={fadeUp}
            className="mt-6 max-w-xl text-base leading-7 text-slate-500 sm:text-lg sm:leading-8"
          >
            Find past questions, get help when you&apos;re stuck, and learn from
            other students — all in one place.
          </motion.p>

          {/* CTAs */}
          <motion.div
            variants={fadeUp}
            className="mt-8 flex flex-col gap-3 sm:flex-row"
          >
            <motion.div
              whileHover={shouldReduceMotion ? {} : { scale: 1.03, y: -2 }}
              whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <Link
                href="/dashboard/courses"
                className="group inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-bold text-white shadow-[0_10px_30px_-8px_rgba(37,99,235,0.6)] transition-all duration-300 hover:bg-blue-700 hover:shadow-[0_16px_35px_-8px_rgba(37,99,235,0.65)]"
              >
                Explore Past Questions
                <motion.span
                  animate={shouldReduceMotion ? {} : { x: [0, 4, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
                >
                  <ArrowRight className="h-4 w-4" />
                </motion.span>
              </Link>
            </motion.div>

            <motion.div
              whileHover={shouldReduceMotion ? {} : { scale: 1.03, y: -2 }}
              whileTap={shouldReduceMotion ? {} : { scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <Link
                href="/community"
                className="group inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-bold text-slate-700 shadow-sm transition-all duration-300 hover:border-blue-200 hover:bg-blue-50/60 hover:text-blue-600"
              >
                Ask the Community
                <MessageCircleQuestion className="h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
              </Link>
            </motion.div>
          </motion.div>

          {/* Value points */}
          <motion.div
            variants={fadeUp}
            className="mt-7 flex flex-wrap gap-x-6 gap-y-3"
          >
            {["Past questions", "Student community", "Academic support"].map((item, i) => (
              <motion.div
                key={item}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 0.1, duration: 0.4 }}
                className="flex items-center gap-2 text-sm text-slate-500"
              >
                <motion.div
                  animate={shouldReduceMotion ? {} : { scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, delay: i * 0.4, repeat: Infinity, repeatDelay: 4 }}
                >
                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                </motion.div>
                {item}
              </motion.div>
            ))}
          </motion.div>
        </motion.div>

        {/* ── RIGHT — PRODUCT PREVIEW ── */}
        <motion.div
          initial={{ opacity: 0, x: 50, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ duration: 0.85, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto mt-14 w-full max-w-xl lg:mt-0"
        >
          {/* Glow behind card */}
          <motion.div
            animate={shouldReduceMotion ? {} : {
              opacity: [0.3, 0.6, 0.3],
              scale: [0.95, 1.05, 0.95],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute inset-0 -z-10 rounded-[2rem] bg-blue-400/20 blur-2xl"
          />

          <div className="relative">
            {/* Outer frame */}
            <motion.div
              animate={shouldReduceMotion ? {} : {
                y: [0, -6, 0],
              }}
              transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-2.5 shadow-[0_32px_90px_-30px_rgba(15,23,42,0.4)]"
            >
              {/* Dark interface */}
              <div className="overflow-hidden rounded-[1.35rem] bg-slate-950">

                {/* Header */}
                <motion.div
                  variants={previewItem}
                  initial="hidden"
                  animate="visible"
                  className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4 sm:px-6"
                >
                  <div className="flex items-center gap-3">
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
                      animate={{ scale: 1, opacity: 1, rotate: 0 }}
                      transition={{ delay: 0.5, duration: 0.5, type: "spring", stiffness: 260, damping: 20 }}
                      className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600"
                    >
                      <GraduationCap className="h-4 w-4 text-white" />
                    </motion.div>
                    <div>
                      <p className="text-xs font-bold text-white">SparkL</p>
                      <p className="text-[10px] text-slate-500">Student workspace</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <motion.span
                      animate={shouldReduceMotion ? {} : { opacity: [1, 0.3, 1], scale: [1, 0.8, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                      className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                    />
                    <span className="text-[10px] font-medium text-slate-500">Online</span>
                  </div>
                </motion.div>

                {/* Search */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.42, duration: 0.4 }}
                  className="px-5 pt-5 sm:px-6"
                >
                  <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.045] px-4 py-3">
                    <Search className="h-4 w-4 shrink-0 text-slate-500" />
                    <span className="text-xs text-slate-500">
                      Search courses, questions, topics...
                    </span>
                  </div>
                </motion.div>

                {/* Cards */}
                <motion.div
                  variants={previewContainer}
                  initial="hidden"
                  animate="visible"
                  className="grid gap-3 p-5 sm:grid-cols-2 sm:p-6"
                >
                  {/* Past Questions card */}
                  <motion.div
                    variants={previewItem}
                    whileHover={shouldReduceMotion ? {} : { y: -4, scale: 1.02, transition: { duration: 0.2 } }}
                    className="rounded-2xl border border-white/[0.05] bg-white/[0.055] p-4 transition-colors duration-300 hover:bg-white/[0.08]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/15">
                        <FileQuestion className="h-4 w-4 text-blue-400" />
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-400">Available</span>
                    </div>
                    <p className="mt-5 text-xl font-black text-white">Past Questions</p>
                    <p className="mt-1 max-w-[180px] text-xs leading-5 text-slate-500">
                      Practice with questions from your courses.
                    </p>
                    <div className="mt-5 flex items-center gap-1.5 text-[10px] font-medium text-blue-400">
                      <span>Browse collection</span>
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  </motion.div>

                  {/* Community card */}
                  <motion.div
                    variants={previewItem}
                    whileHover={shouldReduceMotion ? {} : { y: -4, scale: 1.02, transition: { duration: 0.2 } }}
                    className="rounded-2xl bg-blue-600 p-4 shadow-[0_12px_30px_-15px_rgba(37,99,235,0.65)]"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                        <Users className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-[10px] font-semibold text-blue-100">Community</span>
                    </div>
                    <p className="mt-5 text-xl font-black text-white">Ask & Learn</p>
                    <p className="mt-1 max-w-[180px] text-xs leading-5 text-blue-100">
                      Get help from students who understand.
                    </p>
                    <div className="mt-5 flex items-center gap-1.5 text-[10px] font-medium text-white">
                      <span>Join the discussion</span>
                      <ArrowRight className="h-3 w-3" />
                    </div>
                  </motion.div>

                  {/* Continue studying */}
                  <motion.div
                    variants={previewItem}
                    whileHover={shouldReduceMotion ? {} : { y: -3, transition: { duration: 0.2 } }}
                    className="rounded-2xl border border-white/[0.05] bg-white/[0.055] p-4 sm:col-span-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.07]">
                          <BookOpen className="h-4 w-4 text-blue-400" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-white">Continue studying</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">MTH 201 • Engineering Mathematics</p>
                        </div>
                      </div>
                      <span className="hidden text-[10px] font-medium text-slate-500 sm:block">Practice</span>
                    </div>
                    <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/[0.08]">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: "68%" }}
                        transition={{ delay: 1.1, duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
                        className="h-full rounded-full bg-blue-500"
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                      <span>68% complete</span>
                      <span>Keep going</span>
                    </div>
                  </motion.div>
                </motion.div>
              </div>
            </motion.div>

            {/* Floating notification */}
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.85, x: 10 }}
              animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
              transition={{ delay: 1.2, duration: 0.6, type: "spring", stiffness: 200, damping: 20 }}
              whileHover={shouldReduceMotion ? {} : { y: -3, scale: 1.03, transition: { duration: 0.2 } }}
              className="absolute -right-3 top-14 hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_16px_40px_-18px_rgba(15,23,42,0.35)] sm:block"
            >
              <div className="flex items-center gap-3">
                <motion.div
                  animate={shouldReduceMotion ? {} : { scale: [1, 1.15, 1] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 2 }}
                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50"
                >
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                </motion.div>
                <div>
                  <p className="text-xs font-bold text-slate-900">Solution found</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">Community answer</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Supporting label */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4, duration: 0.6 }}
            className="mt-5 text-center text-[11px] text-slate-400"
          >
            Trusted by students across Nigerian universities
          </motion.p>
        </motion.div>
      </div>
    </section>
  );
}
