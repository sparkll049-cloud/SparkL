"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Quote, Sparkles, Star } from "lucide-react";

const testimonials = [
  {
    quote: "SparkL makes it easier to find the resources I need without jumping between different platforms.",
    name: "Student User",
    role: "University Student",
    initials: "SU",
    color: "blue",
  },
  {
    quote: "Being able to ask questions and learn from other students makes studying feel a lot less isolated.",
    name: "Student User",
    role: "University Student",
    initials: "SU",
    color: "indigo",
  },
  {
    quote: "Having past questions organized in one place gives me a much better way to prepare for my courses.",
    name: "Student User",
    role: "University Student",
    initials: "SU",
    color: "violet",
  },
];

const avatarColors = ["bg-blue-600", "bg-indigo-600", "bg-violet-600"];

export default function Testimonial() {
  const headerRef = useRef(null);
  const headerInView = useInView(headerRef, { once: true, margin: "-60px" });

  return (
    <section className="relative overflow-hidden bg-slate-50/70 py-20 sm:py-28">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-blue-200 to-transparent" />
        <motion.div
          animate={{ opacity: [0.3, 0.55, 0.3], y: [0, 15, 0] }}
          transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -left-40 bottom-0 h-80 w-80 rounded-full bg-blue-100/50 blur-3xl"
        />
        <motion.div
          animate={{ opacity: [0.25, 0.5, 0.25], y: [0, -15, 0] }}
          transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2 }}
          className="absolute -right-40 top-10 h-80 w-80 rounded-full bg-indigo-100/50 blur-3xl"
        />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: "radial-gradient(circle, #1e40af 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        {/* Header */}
        <motion.div
          ref={headerRef}
          initial={{ opacity: 0, y: 22 }}
          animate={headerInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-2xl text-center"
        >
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
            Student experiences
          </motion.span>

          <motion.h2
            initial={{ opacity: 0, y: 16 }}
            animate={headerInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.15, duration: 0.55 }}
            className="mt-5 text-4xl font-black tracking-[-0.038em] text-slate-950 sm:text-5xl"
          >
            Built around how
            <br />
            <span className="text-blue-600">students learn.</span>
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={headerInView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.22, duration: 0.5 }}
            className="mx-auto mt-5 max-w-xl text-base leading-7 text-slate-500 sm:text-lg"
          >
            A better way to find academic resources, ask questions, and learn
            alongside other students.
          </motion.p>
        </motion.div>

        {/* Cards */}
        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {testimonials.map((t, index) => (
            <motion.article
              key={index}
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.55, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -6, scale: 1.02, transition: { duration: 0.25, ease: "easeOut" } }}
              className="group flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_40px_-28px_rgba(15,23,42,0.3)] transition-shadow duration-300 hover:border-blue-100 hover:shadow-[0_24px_50px_-28px_rgba(37,99,235,0.3)]"
            >
              {/* Top */}
              <div className="flex items-center justify-between">
                <motion.div
                  whileHover={{ scale: 1.15, rotate: -10 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18 }}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50"
                >
                  <Quote className="h-4 w-4 text-blue-600" />
                </motion.div>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 + i * 0.06 + 0.3, duration: 0.3, type: "spring" }}
                    >
                      <Star className="h-3.5 w-3.5 fill-blue-500 text-blue-500" />
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Quote */}
              <blockquote className="mt-6 flex-1 text-[15px] leading-7 text-slate-600">
                &ldquo;{t.quote}&rdquo;
              </blockquote>

              {/* Author */}
              <div className="mt-7 flex items-center gap-3 border-t border-slate-100 pt-5">
                <motion.div
                  whileHover={{ scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 18 }}
                  className={`flex h-10 w-10 items-center justify-center rounded-full ${avatarColors[index]} text-xs font-bold text-white`}
                >
                  {t.initials}
                </motion.div>
                <div>
                  <p className="text-sm font-bold text-slate-950">{t.name}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{t.role}</p>
                </div>
              </div>
            </motion.article>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mt-10 text-center"
        >
          <p className="text-sm font-medium text-slate-400">
            Your feedback helps shape the future of SparkL.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
