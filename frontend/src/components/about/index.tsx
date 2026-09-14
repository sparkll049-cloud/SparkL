"use client";

import Link from "next/link";
import { ArrowRight, Lightbulb, Users, ShieldCheck, Rocket, GraduationCap, BookOpen, Target, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── DATA ────────────────────────────────────────────────────────────────────

const values = [
  {
    icon: Lightbulb,
    title: "Access for all",
    description:
      "Every student deserves quality study materials regardless of their financial situation. SparkL is free to use — always.",
  },
  {
    icon: Users,
    title: "Community first",
    description:
      "We're built on the belief that students learn better together. Every feature we ship strengthens that community.",
  },
  {
    icon: ShieldCheck,
    title: "Verified content",
    description:
      "Every past question on SparkL is reviewed before it goes live. You study with material you can actually trust.",
  },
  {
    icon: Rocket,
    title: "Built to scale",
    description:
      "We started with one institution. But the problem we're solving exists in every polytechnic and university across Nigeria.",
  },
];

const stats = [
  { value: "2023", label: "Year founded" },
  { value: "10K+", label: "Students served" },
  { value: "50+", label: "Departments covered" },
  { value: "Nigeria", label: "Where we're going" },
];

const pillars = [
  {
    icon: GraduationCap,
    title: "Built for Nigerian students",
    description:
      "SparkL is designed around how Nigerian tertiary institution students actually study — practical, exam-focused, and built around past questions.",
  },
  {
    icon: BookOpen,
    title: "Every institution, every level",
    description:
      "Whether you're in ND1 at a polytechnic or 200L at a university, SparkL organizes resources around your exact level and department.",
  },
  {
    icon: Target,
    title: "Exam-focused",
    description:
      "We don't try to replace your lecturers. We help you understand what comes up in exams — and make sure you're ready for it.",
  },
  {
    icon: Globe,
    title: "Expanding across Nigeria",
    description:
      "We're growing institution by institution. If your school isn't on SparkL yet, it will be — and you can help make it happen.",
  },
];

// ─── SECTIONS ────────────────────────────────────────────────────────────────

function AboutHero() {
  return (
    <section className="relative bg-[#0A0F2C] overflow-hidden pt-24 pb-20">
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />
      <div className="absolute top-0 left-1/4 w-[500px] h-[300px] bg-blue-600/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-6 lg:px-12">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold tracking-widest text-blue-400 mb-4 uppercase">
            Who we are
          </p>
          <h1 className="text-5xl font-extrabold leading-tight text-white md:text-6xl">
            Built by students,
            <br />
            for every student.
          </h1>
          <p className="mt-7 text-lg leading-8 text-slate-400 max-w-xl">
            SparkL is a past questions and study platform built specifically
            for Nigerian tertiary institution students — polytechnics,
            universities, and colleges of education. One platform, every
            department, completely free.
          </p>
        </div>
      </div>
    </section>
  );
}

function AboutMission() {
  return (
    <section className="bg-[#0D1333] border-t border-white/10 py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="grid gap-16 lg:grid-cols-2 lg:items-center">

          {/* Left: story */}
          <div>
            <h2 className="text-3xl font-extrabold text-white md:text-4xl mb-8">
              The problem we're solving
            </h2>
            <div className="space-y-5 text-slate-400 text-[15px] leading-8">
              <p>
                Every semester, thousands of Nigerian tertiary institution students
                sit exams with no structured way to prepare. Past questions — the
                single most reliable study tool — are scattered across WhatsApp
                chats, sold in printout shops, or simply unavailable.
              </p>
              <p>
                Students waste hours hunting for materials that should take seconds
                to find. Those without the right connections or money to buy handouts
                are left behind before the exam even starts.
              </p>
              <p>
                SparkL fixes that. One platform, every institution, every department,
                all in one place — free.
              </p>
            </div>

            {/* Pull quote */}
            <blockquote className="mt-10 border-l-2 border-blue-500 pl-6">
              <p className="text-white font-medium text-lg leading-8">
                "We didn't build SparkL to be a startup. We built it because
                students needed it and nobody else was doing it."
              </p>
              <footer className="mt-3 text-sm text-slate-500">— SparkL Team</footer>
            </blockquote>
          </div>

          {/* Right: mission statement card */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10">
            <p className="text-xs font-semibold tracking-widest text-blue-400 uppercase mb-6">
              Our mission
            </p>
            <p className="text-2xl font-bold text-white leading-9 mb-8">
              Make quality exam preparation accessible to every student in Nigeria —
              regardless of their institution, department, level, or budget.
            </p>
            <div className="grid grid-cols-2 gap-6 pt-6 border-t border-white/10">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <p className="text-3xl font-black text-white">{stat.value}</p>
                  <p className="text-sm text-slate-500 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}

function AboutValues() {
  return (
    <section className="bg-[#0A0F2C] py-24 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="mb-14">
          <p className="text-xs font-semibold tracking-widest text-blue-400 uppercase mb-3">
            Our principles
          </p>
          <h2 className="text-3xl font-extrabold text-white md:text-4xl">
            What we stand for
          </h2>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {values.map((v) => {
            const Icon = v.icon;
            return (
              <div
                key={v.title}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-6 hover:bg-white/[0.06] transition-colors duration-200"
              >
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 mb-5">
                  <Icon size={20} />
                </div>
                <h3 className="text-base font-bold text-white mb-3">{v.title}</h3>
                <p className="text-sm leading-7 text-slate-400">{v.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function AboutPillars() {
  return (
    <section className="bg-[#060B1F] py-24 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="mb-14">
          <p className="text-xs font-semibold tracking-widest text-blue-400 uppercase mb-3">
            How we think
          </p>
          <h2 className="text-3xl font-extrabold text-white md:text-4xl">
            Why SparkL is different
          </h2>
          <p className="mt-4 text-slate-400 text-[15px] max-w-lg">
            There are other study platforms. But none of them were built
            specifically around the Nigerian tertiary education system.
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className="rounded-xl border border-white/10 bg-white/[0.03] p-8 flex gap-6"
              >
                <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
                  <Icon size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-3">{pillar.title}</h3>
                  <p className="text-sm leading-7 text-slate-400">{pillar.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function AboutCTA() {
  return (
    <section className="bg-[#0D1333] border-t border-white/10 py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-12">
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 px-10 py-16 text-center">
          <h2 className="text-4xl font-extrabold text-white md:text-5xl mb-6">
            Ready to study smarter?
          </h2>
          <p className="text-slate-400 text-lg max-w-lg mx-auto mb-10">
            Join thousands of students across Nigerian tertiary institutions
            already using SparkL to prepare for exams — for free.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/signup">
              <Button className="group rounded-lg bg-[#2563EB] px-8 py-6 text-base font-semibold hover:bg-blue-500 transition-all duration-200 flex items-center gap-2">
                Create free account
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <Link href="/contact">
              <Button
                variant="outline"
                className="rounded-lg border border-white/20 bg-white/5 px-8 py-6 text-base font-semibold text-white hover:bg-white/10 transition-all duration-200"
              >
                Get in touch
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────

export { AboutHero, AboutMission, AboutValues, AboutPillars, AboutCTA };