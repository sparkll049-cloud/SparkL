"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  FileQuestion,
  Lightbulb,
  MessageCircleQuestion,
  PlayCircle,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

const features = [
  {
    icon: FileQuestion,
    title: "Past Questions",
    description:
      "Find past examination questions organized around the courses and subjects you study.",
    label: "Study smarter",
    size: "large",
  },
  {
    icon: CheckCircle2,
    title: "Real Solutions",
    description:
      "Learn from worked solutions and explanations instead of only seeing the final answer.",
    label: "Understand the answer",
    size: "normal",
  },
  {
    icon: PlayCircle,
    title: "Practice Mode",
    description:
      "Turn past questions into focused practice sessions and test what you actually know.",
    label: "Practice",
    size: "normal",
  },
  {
    icon: Bot,
    title: "AI Study Assistant",
    description:
      "Study with SparkL's integrated AI system for explanations, guidance, and help when you're stuck.",
    label: "AI-powered learning",
    size: "large",
  },
  {
    icon: Users,
    title: "Student Community",
    description:
      "Ask academic questions and learn from other students who can share useful explanations and solutions.",
    label: "Learn together",
    size: "normal",
  },
  {
    icon: Target,
    title: "Focused Learning",
    description:
      "Keep your academic resources in one place so you can spend less time searching and more time studying.",
    label: "Stay focused",
    size: "normal",
  },
];

export default function FeatureSection() {
  return (
    <section
      id="features"
      className="relative overflow-hidden bg-[#f8f9ff] py-20 sm:py-24 lg:py-28"
    >
      {/* Background details */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-blue-100 to-transparent" />

        <div className="absolute -left-40 top-24 h-80 w-80 rounded-full bg-blue-100/50 blur-3xl" />

        <div className="absolute -right-40 bottom-10 h-80 w-80 rounded-full bg-indigo-100/50 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mx-auto max-w-3xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-blue-600">
            <Sparkles className="h-3.5 w-3.5" />
            Everything in one place
          </span>

          <h2 className="mt-4 text-4xl font-black tracking-[-0.045em] text-slate-950 sm:text-5xl lg:text-[3.4rem]">
            More than past questions.
            <br />
            <span className="text-blue-600">A smarter way to study.</span>
          </h2>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-500 sm:text-lg sm:leading-8">
            SparkL brings together the resources, tools, and student support
            you need to understand your courses and prepare with confidence.
          </p>
        </motion.div>

        {/* Feature grid */}
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            const isLarge = feature.size === "large";

            return (
              <motion.article
                key={feature.title}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  duration: 0.45,
                  delay: index * 0.06,
                  ease: "easeOut",
                }}
                className={`group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_35px_-28px_rgba(15,23,42,0.3)] transition-all duration-300 hover:-translate-y-1 hover:border-blue-100 hover:shadow-[0_20px_45px_-28px_rgba(37,99,235,0.28)] ${
                  isLarge ? "lg:p-7" : ""
                }`}
              >
                {/* Subtle card glow */}
                <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-blue-50 opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

                <div className="relative">
                  {/* Icon + label */}
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 transition-colors duration-300 group-hover:bg-blue-600">
                      <Icon className="h-5 w-5 text-blue-600 transition-colors duration-300 group-hover:text-white" />
                    </div>

                    <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {feature.label}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="mt-7">
                    <h3 className="text-xl font-extrabold tracking-[-0.025em] text-slate-950">
                      {feature.title}
                    </h3>

                    <p className="mt-2.5 text-sm leading-6 text-slate-500">
                      {feature.description}
                    </p>
                  </div>

                  {/* Bottom indicator */}
                  <div className="mt-7 flex items-center gap-1.5 text-xs font-bold text-blue-600">
                    <span>Explore feature</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1" />
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>

        {/* AI highlight */}
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-5 overflow-hidden rounded-2xl border border-blue-100 bg-blue-600"
        >
          <div className="relative grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-center lg:px-10 lg:py-9">
            {/* Background decoration */}
            <div className="pointer-events-none absolute -right-20 -top-32 h-72 w-72 rounded-full bg-white/10 blur-3xl" />

            <div className="relative flex gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/15">
                <Brain className="h-5 w-5 text-white" />
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-lg font-extrabold text-white sm:text-xl">
                    Study with AI when you're stuck
                  </h3>

                  <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-100">
                    Coming into the experience
                  </span>
                </div>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
                  Get additional academic guidance from SparkL's integrated AI
                  study system while keeping your learning experience focused
                  on understanding, not just answers.
                </p>
              </div>
            </div>

            <Link
              href="/community"
              className="group relative inline-flex w-fit items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-blue-600 transition-all duration-300 hover:-translate-y-0.5 hover:bg-blue-50"
            >
              Start learning
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
}