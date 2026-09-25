"use client";

import { motion } from "framer-motion";
import { Quote, Star } from "lucide-react";

const testimonials = [
  {
    quote:
      "SparkL makes it easier to find the resources I need without jumping between different platforms.",
    name: "Student User",
    role: "University Student",
    initials: "SU",
  },
  {
    quote:
      "Being able to ask questions and learn from other students makes studying feel a lot less isolated.",
    name: "Student User",
    role: "University Student",
    initials: "SU",
  },
  {
    quote:
      "Having past questions organized in one place gives me a much better way to prepare for my courses.",
    name: "Student User",
    role: "University Student",
    initials: "SU",
  },
];

export default function Testimonial() {
  return (
    <section className="relative overflow-hidden bg-[#f8f9ff] py-20 sm:py-24">
      {/* Subtle background detail */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-px w-2/3 -translate-x-1/2 bg-gradient-to-r from-transparent via-blue-100 to-transparent" />
        <div className="absolute -left-40 bottom-0 h-72 w-72 rounded-full bg-blue-100/40 blur-3xl" />
        <div className="absolute -right-40 top-20 h-72 w-72 rounded-full bg-indigo-100/40 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mx-auto max-w-2xl text-center"
        >
          <span className="inline-flex items-center rounded-full border border-blue-100 bg-blue-50 px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-blue-600">
            Student experiences
          </span>

          <h2 className="mt-4 text-4xl font-black tracking-[-0.04em] text-slate-950 sm:text-5xl">
            Built around how
            <br />
            <span className="text-blue-600">students learn.</span>
          </h2>

          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-500 sm:text-lg">
            A better way to find academic resources, ask questions, and learn
            alongside other students.
          </p>
        </motion.div>

        {/* Testimonials */}
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {testimonials.map((testimonial, index) => (
            <motion.article
              key={index}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{
                duration: 0.45,
                delay: index * 0.08,
                ease: "easeOut",
              }}
              className="group flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_10px_35px_-28px_rgba(15,23,42,0.35)] transition-all duration-300 hover:-translate-y-1 hover:border-blue-100 hover:shadow-[0_20px_45px_-28px_rgba(37,99,235,0.25)]"
            >
              {/* Quote icon */}
              <div className="flex items-center justify-between">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50">
                  <Quote className="h-4 w-4 text-blue-600" />
                </div>

                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, starIndex) => (
                    <Star
                      key={starIndex}
                      className="h-3.5 w-3.5 fill-blue-500 text-blue-500"
                    />
                  ))}
                </div>
              </div>

              {/* Quote */}
              <blockquote className="mt-6 flex-1 text-[15px] leading-7 text-slate-600">
                “{testimonial.quote}”
              </blockquote>

              {/* User */}
              <div className="mt-7 flex items-center gap-3 border-t border-slate-100 pt-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white">
                  {testimonial.initials}
                </div>

                <div>
                  <p className="text-sm font-bold text-slate-950">
                    {testimonial.name}
                  </p>

                  <p className="mt-0.5 text-xs text-slate-500">
                    {testimonial.role}
                  </p>
                </div>
              </div>
            </motion.article>
          ))}
        </div>

        {/* Bottom statement */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.25, duration: 0.5 }}
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