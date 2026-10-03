"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  MessageCircleQuestion,
  Search,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

/* ============================================================
   ANIMATION VARIANTS
============================================================ */

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

/* ============================================================
   DATA
============================================================ */

const steps = [
  {
    number: "01",
    icon: Search,
    color: "blue",
    title: "Search your course",
    description:
      "Type your course code or topic — MTH 201, CHM 101, whatever you need. SparkL surfaces the right past questions instantly.",
    detail: "MTH 201 • Engineering Mathematics",
    detailSub: "847 past questions available",
    iconBg: "bg-blue-600/10",
    iconColor: "text-blue-600",
    numberColor: "text-blue-100",
    accent: "bg-blue-600",
  },
  {
    number: "02",
    icon: BookOpen,
    color: "indigo",
    title: "Practice with past questions",
    description:
      "Work through real exam questions from your school. Track your progress and see where you need to focus more.",
    detail: "68% complete",
    detailSub: "Keep going — you're doing great",
    iconBg: "bg-indigo-600/10",
    iconColor: "text-indigo-600",
    numberColor: "text-indigo-100",
    accent: "bg-indigo-600",
  },
  {
    number: "03",
    icon: MessageCircleQuestion,
    color: "violet",
    title: "Ask when you're stuck",
    description:
      "Post your question to the student community. Get explanations from peers who've been through the same course.",
    detail: "Solution found",
    detailSub: "Community answer • 4 min ago",
    iconBg: "bg-violet-600/10",
    iconColor: "text-violet-600",
    numberColor: "text-violet-100",
    accent: "bg-violet-600",
  },
  {
    number: "04",
    icon: Zap,
    color: "emerald",
    title: "Study smarter, not harder",
    description:
      "SparkL's AI study assistant explains difficult concepts and guides you to understand — not just memorise answers.",
    detail: "AI Study Assistant",
    detailSub: "Coming soon to SparkL",
    iconBg: "bg-emerald-600/10",
    iconColor: "text-emerald-600",
    numberColor: "text-emerald-100",
    accent: "bg-emerald-500",
  },
];

const colorMap: Record<
  string,
  { ring: string; badge: string; badgeText: string; line: string }
> = {
  blue: {
    ring: "ring-blue-100",
    badge: "bg-blue-50 text-blue-700 border-blue-100",
    badgeText: "text-blue-700",
    line: "bg-blue-200",
  },
  indigo: {
    ring: "ring-indigo-100",
    badge: "bg-indigo-50 text-indigo-700 border-indigo-100",
    badgeText: "text-indigo-700",
    line: "bg-indigo-200",
  },
  violet: {
    ring: "ring-violet-100",
    badge: "bg-violet-50 text-violet-700 border-violet-100",
    badgeText: "text-violet-700",
    line: "bg-violet-200",
  },
  emerald: {
    ring: "ring-emerald-100",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-100",
    badgeText: "text-emerald-700",
    line: "bg-emerald-200",
  },
};

/* ============================================================
   STEP CARD
============================================================ */

function StepCard({
  step,
  index,
  isLast,
}: {
  step: (typeof steps)[number];
  index: number;
  isLast: boolean;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const colors = colorMap[step.color];
  const Icon = step.icon;

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={fadeUp}
      transition={{ delay: index * 0.1 }}
      className="relative flex gap-5 sm:gap-7"
    >
      {/* ── Left column: number + connector line ── */}
      <div className="flex flex-col items-center">
        {/* Step number bubble */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={inView ? { scale: 1, opacity: 1 } : {}}
          transition={{
            delay: index * 0.1 + 0.1,
            duration: 0.4,
            ease: [0.22, 1, 0.36, 1],
          }}
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-4 ${colors.ring} bg-white shadow-sm`}
        >
          <Icon className={`h-5 w-5 ${step.iconColor}`} />
        </motion.div>

        {/* Connector line */}
        {!isLast && (
          <motion.div
            initial={{ scaleY: 0 }}
            animate={inView ? { scaleY: 1 } : {}}
            transition={{
              delay: index * 0.1 + 0.3,
              duration: 0.5,
              ease: "easeOut",
            }}
            style={{ originY: 0 }}
            className={`mt-3 w-px flex-1 ${colors.line} min-h-[2.5rem]`}
          />
        )}
      </div>

      {/* ── Right column: content ── */}
      <div className="pb-10 sm:pb-12">
        {/* Step badge */}
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${colors.badge}`}
        >
          Step {step.number}
        </span>

        <h3 className="mt-3 text-xl font-black tracking-tight text-slate-900 sm:text-2xl">
          {step.title}
        </h3>

        <p className="mt-2 max-w-lg text-sm leading-6 text-slate-500 sm:text-base sm:leading-7">
          {step.description}
        </p>

        {/* Mini product callout */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: index * 0.1 + 0.25, duration: 0.45 }}
          className="mt-4 inline-flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5"
        >
          <div className={`h-2 w-2 rounded-full ${step.accent}`} />
          <div>
            <p className="text-xs font-bold text-slate-800">{step.detail}</p>
            <p className="text-[10px] text-slate-400">{step.detailSub}</p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

/* ============================================================
   MAIN EXPORT
============================================================ */

export default function HowItWorks() {
  const headerRef = useRef(null);
  const headerInView = useInView(headerRef, { once: true, margin: "-60px" });

  return (
    <section className="relative overflow-hidden bg-white py-20 sm:py-28">
      {/* ── Background decoration ── */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -right-40 top-0 h-96 w-96 rounded-full bg-blue-50/60 blur-3xl" />
        <div className="absolute -left-40 bottom-0 h-96 w-96 rounded-full bg-indigo-50/50 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-5xl px-5 sm:px-8 lg:px-10">
        {/* ── Section header ── */}
        <motion.div
          ref={headerRef}
          initial="hidden"
          animate={headerInView ? "visible" : "hidden"}
          variants={stagger}
          className="mb-14 max-w-2xl sm:mb-16"
        >
          <motion.div
            variants={fadeUp}
            className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/70 px-3.5 py-1.5 text-sm font-semibold text-blue-700"
          >
            <Sparkles className="h-3.5 w-3.5" />
            How it works
          </motion.div>

          <motion.h2
            variants={fadeUp}
            className="text-4xl font-black leading-[1.05] tracking-[-0.035em] text-slate-950 sm:text-5xl"
          >
            From stuck to{" "}
            <span className="text-blue-600">sorted</span>
            <br />
            in four steps.
          </motion.h2>

          <motion.p
            variants={fadeUp}
            className="mt-4 text-base leading-7 text-slate-500 sm:text-lg sm:leading-8"
          >
            SparkL is built around how students actually study — searching,
            practising, asking, and understanding.
          </motion.p>
        </motion.div>

        {/* ── Steps ── */}
        <div>
          {steps.map((step, i) => (
            <StepCard
              key={step.number}
              step={step}
              index={i}
              isLast={i === steps.length - 1}
            />
          ))}
        </div>

        {/* ── Bottom CTA ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          className="mt-4 flex flex-col items-start gap-4 rounded-2xl border border-blue-100 bg-blue-50/60 px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-8"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600">
              <Users className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">
                Join thousands of Nigerian students
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Already using SparkL to study smarter every day.
              </p>
            </div>
          </div>

          <a
            href="/dashboard/courses"
            className="group inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_20px_-8px_rgba(37,99,235,0.5)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-blue-700"
          >
            Get started free
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
