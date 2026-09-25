"use client";

import { motion } from "framer-motion";
import { BookOpen, FileQuestion, GraduationCap, MessageCircleQuestion } from "lucide-react";

const stats = [
  {
    value: "12K+",
    label: "Students",
    icon: GraduationCap,
  },
  {
    value: "8.5K+",
    label: "Past Questions",
    icon: FileQuestion,
  },
  {
    value: "3.2K+",
    label: "Questions Asked",
    icon: MessageCircleQuestion,
  },
  {
    value: "500+",
    label: "Courses",
    icon: BookOpen,
  },
];

export default function StatsSection() {
  return (
    <section className="bg-white px-5 py-8 sm:px-8 sm:py-10 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_8px_35px_-25px_rgba(15,23,42,0.25)] sm:grid-cols-4"
        >
          {stats.map((stat, index) => {
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className={`flex items-center gap-3 px-5 py-5 sm:justify-center sm:px-6 sm:py-6 ${
                  index === 1
                    ? "border-l border-slate-100"
                    : ""
                } ${
                  index === 2
                    ? "border-t border-slate-100 sm:border-l sm:border-t-0"
                    : ""
                } ${
                  index === 3
                    ? "border-l border-t border-slate-100 sm:border-t-0"
                    : ""
                }`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50">
                  <Icon className="h-4 w-4 text-blue-600" />
                </div>

                <div>
                  <p className="text-xl font-extrabold tracking-[-0.03em] text-blue-600 sm:text-2xl">
                    {stat.value}
                  </p>

                  <p className="mt-0.5 text-xs font-medium text-slate-500 sm:text-sm">
                    {stat.label}
                  </p>
                </div>
              </div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}