"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  FileQuestion,
  MessageCircleQuestion,
  UserPlus,
} from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Create your account",
    description: "Set up your student profile and get started with SparkL.",
    icon: UserPlus,
  },
  {
    number: "02",
    title: "Find what you need",
    description: "Explore past questions, courses, and academic resources.",
    icon: FileQuestion,
  },
  {
    number: "03",
    title: "Ask & learn",
    description: "Ask questions, share solutions, and learn with other students.",
    icon: MessageCircleQuestion,
  },
  {
    number: "04",
    title: "Keep improving",
    description: "Practice consistently and build confidence in your courses.",
    icon: BookOpen,
  },
];

export default function HowItWorks() {
  return (
    <section className="relative overflow-hidden bg-[#f8f9ff] py-16 sm:py-20 lg:py-24">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-blue-100 to-transparent" />
        <div className="absolute -left-32 bottom-0 h-64 w-64 rounded-full bg-blue-100/40 blur-3xl" />
        <div className="absolute -right-32 top-20 h-64 w-64 rounded-full bg-indigo-100/40 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        {/* Section heading */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-blue-600">
            Simple by design
          </span>

          <h2 className="mt-4 text-4xl font-black tracking-[-0.04em] text-slate-950 sm:text-5xl">
            How It Works
          </h2>

          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-500 sm:text-lg">
            Everything you need to make studying more focused, connected, and
            productive.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="relative mt-12 lg:mt-14">
          {/* Connecting line — desktop */}
          <div className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-[2.35rem] hidden h-px bg-gradient-to-r from-blue-100 via-blue-200 to-blue-100 lg:block" />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
            {steps.map((step, index) => {
              const Icon = step.icon;

              return (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{
                    duration: 0.45,
                    delay: index * 0.08,
                    ease: "easeOut",
                  }}
                  className="group relative rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_35px_-25px_rgba(15,23,42,0.25)] transition-all duration-300 hover:-translate-y-1 hover:border-blue-100 hover:shadow-[0_18px_40px_-25px_rgba(37,99,235,0.25)] sm:p-6"
                >
                  {/* Number + icon */}
                  <div className="relative z-10 flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 shadow-sm shadow-blue-600/20">
                      <Icon className="h-5 w-5 text-white" />
                    </div>

                    <span className="text-sm font-black tracking-widest text-blue-100 transition-colors duration-300 group-hover:text-blue-200">
                      {step.number}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="mt-7">
                    <h3 className="text-lg font-extrabold tracking-[-0.02em] text-slate-950">
                      {step.title}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {step.description}
                    </p>
                  </div>

                  {/* Bottom action cue */}
                  <div className="mt-5 flex items-center gap-1.5 text-xs font-bold text-blue-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <span>Step {index + 1}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}