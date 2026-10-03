"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  ArrowRight,
  BookOpen,
  MessageCircleQuestion,
  Search,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.13 } },
};

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
    accent: "bg-blue-600",
  },
  {
    number: "02",
    icon: BookOpen,
    color: "indigo",
    title: "Practice with past questions",
    description:
      "Work through real exam questions from your school. Track your progress and see exactly where to focus more.",
    detail: "68% complete",
    detailSub: "Keep going — you're doing great",
    accent: "bg-indigo-600",
  },
  {
    number: "03",
    icon: MessageCircleQuestion,
    color: "violet",
    title: "Ask when you're stuck",
    description:
      "Post your question to the student community. Get clear explanations from peers who've been through the same course.",
    detail: "Solution found",
    detailSub: "Community answer • 4 min ago",
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
    accent: "bg-emerald-500",
  },
];

const colorMap: Record<string, { ring: string; badge: string; line: string; iconColor: string; iconBg: string }> = {
  blue:    { ring: "ring-blue-100",    badge: "bg-blue-50 text-blue-700 border-blue-100",       line: "from-blue-200 to-indigo-200",    iconColor: "text-blue-600",    iconBg: "bg-blue-50"    },
  indigo:  { ring: "ring-indigo-100",  badge: "bg-indigo-50 text-indigo-700 border-indigo-100", line: "from-indigo-200 to-violet-200",  iconColor: "text-indigo-600",  iconBg: "bg-indigo-50"  },
  violet:  { ring: "ring-violet-100",  badge: "bg-violet-50 text-violet-700 border-violet-100", line: "from-violet-200 to-emerald-200", iconColor: "text-violet-600",  iconBg: "bg-violet-50"  },
  emerald: { ring: "ring-emerald-100", badge: "bg-emerald-50 text-emerald-700 border-emerald-100", line: "",                            iconColor: "text-emerald-600", iconBg: "bg-emerald-50" },
};

function StepCard({ step, index, isLast }: { step: typeof steps[number]; index: number; isLast: boolean }) {
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
      transition={{ delay: index * 0.08 }}
      className="relative flex gap-6 sm:gap-8"
    >
      {/* Left: icon + line */}
      <div className="flex flex-col items-center">
        <motion.div
          initial={{ scale: 0.4, opacity: 0, rotate: -25 }}
          animate={inView ? { scale: 1, opacity: 1, rotate: 0 } : {}}
          transition={{ delay: index * 0.08 + 0.1, duration: 0.5, type: "spring", stiffness: 260, damping: 18 }}
          whileHover={{ scale: 1.12, rotate: 5, transition: { duration: 0.2 } }}
          className={`flex h-12 w-12 shrink-0 cursor-default items-center justify-center rounded-2xl ring-4 ${colors.ring} ${colors.iconBg} shadow-sm`}
        >
          <Icon className={`h-5 w-5 ${colors.iconColor}`} />
        </motion.div>

        {!isLast && (
          <motion.div
            initial={{ scaleY: 0, opacity: 0 }}
            animate={inView ? { scaleY: 1, opacity: 1 } : {}}
            transition={{ delay: index * 0.08 + 0.35, duration: 0.6, ease: "easeOut" }}
            style={{ originY: 0 }}
            className={`mt-3 w-0.5 flex-1 bg-gradient-to-b ${colors.line} min-h-[3rem]`}
          />
        )}
      </div>

      {/* Right: content */}
      <div className="pb-12 sm:pb-14">
        <motion.span
          initial={{ opacity: 0, x: -12 }}
          animate={inView ? { opacity: 1, x: 0 } : {}}
          transition={{ delay: index * 0.08 + 0.15, duration: 0.4 }}
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${colors.badge}`}
        >
          Step {step.number}
        </motion.span>

        <motion.h3
          initial={{ opacity: 0, y: 12 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: index * 0.08 + 0.2, duration: 0.5 }}
          className="mt-3 text-xl font-black tracking-tight text-slate-900 sm:text-2xl"
        >
          {step.title}
        </motion.h3>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: index * 0.08 + 0.25, duration: 0.5 }}
          className="mt-2 max-w-lg text-sm leading-6 text-slate-500 sm:text-base sm:leading-7"
        >
          {step.description}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
          transition={{ delay: index * 0.08 + 0.32, duration: 0.45 }}
          whileHover={{ scale: 1.02, x: 3, transition: { duration: 0.2 } }}
          className="mt-4 inline-flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5 shadow-sm"
        >
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity, delay: index * 0.5 }}
            className={`h-2 w-2 rounded-full ${step.accent}`}
          />
          <div>
            <p className="text-xs font-bold text-slate-800">{step.detail}</p>
            <p className="text-[10px] text-slate-400">{step.detailSub}</p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

export default function HowItWorks() {
  const headerRef = useRef(null);
  const headerInView = useInView(headerRef, { once: true, margin: "-60px" });

  return (
    <section className="relative overflow-hidden bg-white py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0">
        <motion.div
          animate={{ opacity: [0.4, 0.65, 0.4], x: [0, 15, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -right-40 top-0 h-96 w-96 rounded-full bg-blue-50/70 blur-3xl"
        />
        <motion.div
          animate={{ opacity: [0.3, 0.55, 0.3], x: [0, -15, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute -left-40 bottom-0 h-96 w-96 rounded-full bg-indigo-50/60 blur-3xl"
        />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: "radial-gradient(circle, #1e40af 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-5xl px-5 sm:px-8 lg:px-10">
        {/* Header */}
        <motion.div
          ref={headerRef}
          initial="hidden"
          animate={headerInView ? "visible" : "hidden"}
          variants={stagger}
          className="mb-16 max-w-2xl"
        >
          <motion.div
            variants={fadeUp}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50/70 px-4 py-2 text-sm font-semibold text-blue-700"
          >
            <motion.span
              animate={{ rotate: [0, 15, -10, 15, 0], scale: [1, 1.2, 1.1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 4 }}
            >
              <Sparkles className="h-4 w-4" />
            </motion.span>
            How it works
          </motion.div>

          <motion.h2
            variants={fadeUp}
            className="text-4xl font-black leading-[1.05] tracking-[-0.038em] text-slate-950 sm:text-5xl"
          >
            From stuck to{" "}
            <span className="text-blue-600">sorted</span>
            <br />
            in four steps.
          </motion.h2>

          <motion.p
            variants={fadeUp}
            className="mt-5 text-base leading-7 text-slate-500 sm:text-lg sm:leading-8"
          >
            SparkL is built around how students actually study — searching,
            practising, asking, and understanding.
          </motion.p>
        </motion.div>

        {/* Steps */}
        <div>
          {steps.map((step, i) => (
            <StepCard key={step.number} step={step} index={i} isLast={i === steps.length - 1} />
          ))}
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mt-4 flex flex-col items-start gap-5 overflow-hidden rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 to-indigo-50/60 px-6 py-7 sm:flex-row sm:items-center sm:justify-between sm:px-8"
        >
          <div className="flex items-start gap-4">
            <motion.div
              animate={{ scale: [1, 1.08, 1], rotate: [0, -5, 5, 0] }}
              transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 shadow-[0_8px_20px_-6px_rgba(37,99,235,0.5)]"
            >
              <Users className="h-5 w-5 text-white" />
            </motion.div>
            <div>
              <p className="text-sm font-bold text-slate-900">Join thousands of Nigerian students</p>
              <p className="mt-0.5 text-xs text-slate-500">Already using SparkL to study smarter every day.</p>
            </div>
          </div>

          <motion.a
            href="/dashboard/courses"
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="group inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-[0_8px_20px_-8px_rgba(37,99,235,0.55)] hover:bg-blue-700"
          >
            Get started free
            <motion.span
              animate={{ x: [0, 4, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
            >
              <ArrowRight className="h-4 w-4" />
            </motion.span>
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
}
