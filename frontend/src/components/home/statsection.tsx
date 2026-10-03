"use client";

import { motion, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import { BookOpen, FileQuestion, GraduationCap, MessageCircleQuestion } from "lucide-react";

const stats = [
  { value: 100,  suffix: "+", label: "Students",        icon: GraduationCap,         color: "text-blue-600",   iconBg: "bg-blue-50",    accentLine: "bg-blue-500"   },
  { value: 100,  suffix: "+", label: "Past Questions",  icon: FileQuestion,           color: "text-indigo-600", iconBg: "bg-indigo-50",  accentLine: "bg-indigo-500" },
  { value: 3200, suffix: "+", label: "Questions Asked", icon: MessageCircleQuestion,  color: "text-violet-600", iconBg: "bg-violet-50",  accentLine: "bg-violet-500" },
  { value: 50,   suffix: "+", label: "Courses",         icon: BookOpen,               color: "text-emerald-600",iconBg: "bg-emerald-50", accentLine: "bg-emerald-500"},
];

function CountUp({ target, suffix, inView }: { target: number; suffix: string; inView: boolean }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const duration = 1400;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(start);
    }, 16);
    return () => clearInterval(timer);
  }, [inView, target]);

  const display = count >= 1000 ? `${(count / 1000).toFixed(1)}K` : count.toString();
  return <>{display}{suffix}</>;
}

export default function StatsSection() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <section className="bg-white px-5 py-10 sm:px-8 sm:py-12 lg:px-10">
      <div className="mx-auto max-w-6xl">
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_12px_45px_-25px_rgba(15,23,42,0.28)]"
        >
          <div className="grid grid-cols-2 sm:grid-cols-4">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={inView ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: index * 0.1, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  whileHover={{ backgroundColor: "rgba(249,250,251,1)", transition: { duration: 0.2 } }}
                  className={`group relative flex items-center gap-3 px-5 py-6 sm:justify-center sm:px-6 sm:py-8 cursor-default
                    ${index === 1 ? "border-l border-slate-100" : ""}
                    ${index === 2 ? "border-t border-slate-100 sm:border-l sm:border-t-0" : ""}
                    ${index === 3 ? "border-l border-t border-slate-100 sm:border-t-0" : ""}
                  `}
                >
                  {/* Accent line top */}
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={inView ? { scaleX: 1 } : {}}
                    transition={{ delay: index * 0.1 + 0.3, duration: 0.5 }}
                    style={{ originX: 0 }}
                    className={`absolute left-0 top-0 h-0.5 w-full ${stat.accentLine} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                  />

                  <motion.div
                    whileHover={{ scale: 1.15, rotate: 8 }}
                    transition={{ type: "spring", stiffness: 300, damping: 18 }}
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${stat.iconBg}`}
                  >
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </motion.div>

                  <div>
                    <p className={`text-2xl font-extrabold tracking-[-0.03em] ${stat.color} sm:text-3xl`}>
                      <CountUp target={stat.value} suffix={stat.suffix} inView={inView} />
                    </p>
                    <p className="mt-0.5 text-xs font-medium text-slate-500 sm:text-sm">{stat.label}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
