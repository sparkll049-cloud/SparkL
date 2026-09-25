"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  FlaskConical,
  Laptop,
  Megaphone,
  Wrench,
} from "lucide-react";

const topics = [
  {
    icon: Laptop,
    title: "Computer Science",
    description:
      "Programming, software engineering, databases, and computing fundamentals.",
  },
  {
    icon: Wrench,
    title: "Engineering",
    description:
      "Engineering mathematics, technical courses, design, and core fundamentals.",
  },
  {
    icon: Briefcase,
    title: "Business",
    description:
      "Accounting, management, economics, entrepreneurship, and administration.",
  },
  {
    icon: Megaphone,
    title: "Mass Communication",
    description:
      "Media studies, journalism, public relations, and communication courses.",
  },
  {
    icon: FlaskConical,
    title: "Science & Technology",
    description:
      "Applied sciences, technology, laboratory work, and scientific foundations.",
  },
  {
    icon: BookOpen,
    title: "General Studies",
    description:
      "GST, entrepreneurship, communication, and other cross-departmental courses.",
  },
];

export default function TrendingTopics() {
  return (
    <section id="courses" className="relative overflow-hidden bg-white py-20 sm:py-24">
      {/* Subtle background detail */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-blue-100 to-transparent" />
        <div className="absolute -left-40 top-40 h-72 w-72 rounded-full bg-blue-50/70 blur-3xl" />
        <div className="absolute -right-40 bottom-10 h-72 w-72 rounded-full bg-indigo-50/60 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between"
        >
          <div className="max-w-2xl">
            <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-blue-600">
              Explore by subject
            </span>

            <h2 className="mt-4 text-4xl font-black tracking-[-0.04em] text-slate-950 sm:text-5xl">
              Find your course.
              <br />
              <span className="text-blue-600">Find what matters.</span>
            </h2>

            <p className="mt-4 max-w-xl text-base leading-7 text-slate-500 sm:text-lg">
              Explore academic resources across departments and find past
              questions relevant to what you study.
            </p>
          </div>

          <Link
            href="/dashboard/courses"
            className="group inline-flex w-fit shrink-0 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 transition-all duration-300 hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
          >
            View all courses
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </motion.div>

        {/* Topic grid */}
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topics.map((topic, index) => {
            const Icon = topic.icon;

            return (
              <motion.div
                key={topic.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{
                  duration: 0.45,
                  delay: index * 0.06,
                  ease: "easeOut",
                }}
              >
                <Link
                  href="/dashboard/courses"
                  className="group flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_10px_35px_-28px_rgba(15,23,42,0.35)] transition-all duration-300 hover:-translate-y-1 hover:border-blue-100 hover:shadow-[0_20px_45px_-28px_rgba(37,99,235,0.3)] sm:p-6"
                >
                  {/* Icon + arrow */}
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 transition-colors duration-300 group-hover:bg-blue-600">
                      <Icon className="h-5 w-5 text-blue-600 transition-colors duration-300 group-hover:text-white" />
                    </div>

                    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-100 text-slate-300 transition-all duration-300 group-hover:border-blue-100 group-hover:text-blue-600">
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="mt-7">
                    <h3 className="text-lg font-extrabold tracking-[-0.02em] text-slate-950">
                      {topic.title}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {topic.description}
                    </p>
                  </div>

                  {/* Bottom label */}
                  <div className="mt-auto pt-6">
                    <span className="text-xs font-bold text-blue-600">
                      Explore resources
                    </span>
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