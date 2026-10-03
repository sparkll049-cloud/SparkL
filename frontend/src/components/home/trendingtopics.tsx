"use client";

import Link from "next/link";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  FlaskConical,
  Laptop,
  Megaphone,
  Sparkles,
  Wrench,
} from "lucide-react";

const topics = [
  {
    icon: Laptop,
    title: "Computer Science",
    description: "Programming, software engineering, databases, and computing fundamentals.",
    color: "blue",
  },
  {
    icon: Wrench,
    title: "Engineering",
    description: "Engineering mathematics, technical courses, design, and core fundamentals.",
    color: "indigo",
  },
  {
    icon: Briefcase,
    title: "Business",
    description: "Accounting, management, economics, entrepreneurship, and administration.",
    color: "violet",
  },
  {
    icon: Megaphone,
    title: "Mass Communication",
    description: "Media studies, journalism, public relations, and communication courses.",
    color: "emerald",
  },
  {
    icon: FlaskConical,
    title: "Science & Technology",
    description: "Applied sciences, technology, laboratory work, and scientific foundations.",
    color: "amber",
  },
  {
    icon: BookOpen,
    title: "General Studies",
    description: "GST, entrepreneurship, communication, and other cross-departmental courses.",
    color: "rose",
  },
];

const colorMap: Record<string, { iconBg: string; iconColor: string; hoverIcon: string; accent: string }> = {
  blue:    { iconBg: "bg-blue-50",    iconColor: "text-blue-600",    hoverIcon: "group-hover:bg-blue-600",    accent: "bg-blue-500"    },
  indigo:  { iconBg: "bg-indigo-50",  iconColor: "text-indigo-600",  hoverIcon: "group-hover:bg-indigo-600",  accent: "bg-indigo-500"  },
  violet:  { iconBg: "bg-violet-50",  iconColor: "text-violet-600",  hoverIcon: "group-hover:bg-violet-600",  accent: "bg-violet-500"  },
  emerald: { iconBg: "bg-emerald-50", iconColor: "text-emerald-600", hoverIcon: "group-hover:bg-emerald-600", accent: "bg-emerald-500" },
  amber:   { iconBg: "bg-amber-50",   iconColor: "text-amber-600",   hoverIcon: "group-hover:bg-amber-600",   accent: "bg-amber-500"   },
  rose:    { iconBg: "bg-rose-50",    iconColor: "text-rose-600",    hoverIcon: "group-hover:bg-rose-600",    accent: "bg-rose-500"    },
};

export default function TrendingTopics() {
  const headerRef = useRef(null);
  const headerInView = useInView(headerRef, { once: true, margin: "-60px" });

  return (
    <section id="courses" className="relative overflow-hidden bg-white py-20 sm:py-28">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-blue-100 to-transparent" />
        <motion.div
          animate={{ opacity: [0.35, 0.6, 0.35], y: [0, 12, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -left-40 top-32 h-80 w-80 rounded-full bg-blue-50/80 blur-3xl"
        />
        <motion.div
          animate={{ opacity: [0.3, 0.5, 0.3], y: [0, -12, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute -right-40 bottom-10 h-80 w-80 rounded-full bg-indigo-50/70 blur-3xl"
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        {/* Header */}
        <motion.div
          ref={headerRef}
          initial={{ opacity: 0, y: 22 }}
          animate={headerInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"
        >
          <div className="max-w-2xl">
            <motion.span
              initial={{ opacity: 0, scale: 0.85 }}
              animate={headerInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ delay: 0.1, duration: 0.45 }}
              className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700"
            >
              <motion.span
                animate={{ rotate: [0, 15, -10, 15, 0], scale: [1, 1.2, 1.1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 4 }}
              >
                <Sparkles className="h-3.5 w-3.5" />
              </motion.span>
              Explore by subject
            </motion.span>

            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              animate={headerInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.15, duration: 0.55 }}
              className="mt-5 text-4xl font-black tracking-[-0.038em] text-slate-950 sm:text-5xl"
            >
              Find your course.
              <br />
              <span className="text-blue-600">Find what matters.</span>
            </motion.h2>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={headerInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.22, duration: 0.5 }}
              className="mt-4 max-w-xl text-base leading-7 text-slate-500 sm:text-lg"
            >
              Explore academic resources across departments and find past
              questions relevant to what you study.
            </motion.p>
          </div>

          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={headerInView ? { opacity: 1, x: 0 } : {}}
            transition={{ delay: 0.3, duration: 0.5 }}
            whileHover={{ scale: 1.04, y: -2 }}
            whileTap={{ scale: 0.97 }}
            transition2={{ type: "spring", stiffness: 400, damping: 20 }}
          >
            <Link
              href="/dashboard/courses"
              className="group inline-flex w-fit shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition-all duration-300 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
            >
              View all courses
              <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </motion.div>

        {/* Topic grid */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((topic, index) => {
            const Icon = topic.icon;
            const c = colorMap[topic.color];

            return (
              <motion.div
                key={topic.title}
                initial={{ opacity: 0, y: 22, scale: 0.96 }}
                whileInView={{ opacity: 1, y: 0, scale: 1 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.5, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -6, scale: 1.02, transition: { duration: 0.22 } }}
                whileTap={{ scale: 0.98 }}
              >
                <Link
                  href="/dashboard/courses"
                  className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_40px_-28px_rgba(15,23,42,0.28)] transition-shadow duration-300 hover:border-blue-100 hover:shadow-[0_24px_50px_-28px_rgba(37,99,235,0.28)] sm:p-6"
                >
                  {/* Accent bar on hover */}
                  <motion.div
                    className={`absolute left-0 top-0 h-0.5 w-full ${c.accent} scale-x-0 transition-transform duration-300 group-hover:scale-x-100`}
                    style={{ originX: 0 }}
                  />

                  {/* Icon + arrow */}
                  <div className="flex items-center justify-between">
                    <motion.div
                      whileHover={{ scale: 1.15, rotate: 8 }}
                      transition={{ type: "spring", stiffness: 300, damping: 18 }}
                      className={`flex h-11 w-11 items-center justify-center rounded-xl ${c.iconBg} ${c.hoverIcon} transition-colors duration-300`}
                    >
                      <Icon className={`h-5 w-5 ${c.iconColor} transition-colors duration-300 group-hover:text-white`} />
                    </motion.div>

                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-100 text-slate-300 transition-all duration-300 group-hover:border-blue-100 group-hover:text-blue-600">
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="mt-7">
                    <h3 className="text-lg font-extrabold tracking-[-0.02em] text-slate-950">{topic.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{topic.description}</p>
                  </div>

                  {/* Bottom */}
                  <div className="mt-auto pt-6">
                    <span className={`text-xs font-bold ${c.iconColor}`}>Explore resources →</span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
